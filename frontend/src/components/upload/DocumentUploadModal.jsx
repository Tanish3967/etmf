import React, { useState, useRef } from 'react';
import api from '../../api';

export default function DocumentUploadModal({ currentFolderNode, onClose, onUploaded }) {
  const [fileList, setFileList] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-extract DIA code if present in filename (e.g. "02.01.01_Protocol.pdf" -> "02.01.01")
  const parseFilenameMetadata = (file) => {
    const rawName = file.name.replace(/\.[^/.]+$/, "");
    const codeMatch = file.name.match(/(\d{2}\.\d{2}(?:\.\d{2})?)/);
    const code = codeMatch ? codeMatch[1] : (currentFolderNode?.code || "02.01.01");
    const zoneCode = code.split('.')[0] || "02";
    const sectionCode = code.split('.').slice(0, 2).join('.') || "02.01";

    return {
      file,
      title: rawName.replace(/_/g, " "),
      artifactCode: code,
      zone: zoneCode,
      section: sectionCode,
      version: "1.0",
      studyId: "study-001",
      country: "USA",
      confidential: false,
      mandatory: true,
      status: "pending" // 'pending' | 'uploading' | 'done' | 'error'
    };
  };

  const handleFilesAdded = (incomingFiles) => {
    const newItems = Array.from(incomingFiles).map(parseFilenameMetadata);
    setFileList(prev => [...prev, ...newItems]);
    if (fileList.length === 0 && newItems.length > 0) {
      setSelectedIndex(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const updateSelectedMeta = (field, value) => {
    setFileList(prev => {
      const updated = [...prev];
      if (updated[selectedIndex]) {
        updated[selectedIndex] = { ...updated[selectedIndex], [field]: value };
      }
      return updated;
    });
  };

  const removeFile = (idx) => {
    setFileList(prev => prev.filter((_, i) => i !== idx));
    if (selectedIndex >= idx && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleRunAIOrchestrator = async (index) => {
    const item = fileList[index];
    if (!item) return;
    setOrchestrating(true);
    try {
      const docId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const res = await api.post('/ai/orchestrate', {
        documentId: docId,
        fileName: item.file.name,
        documentText: `${item.title} ${item.file.name}`,
        studyId: item.studyId || 'study-001'
      });
      const data = res.data;
      setFileList(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            docId,
            title: data.metadata?.document_title || updated[index].title,
            artifactCode: data.dia_classification?.artifact_code || updated[index].artifactCode,
            zone: data.dia_classification?.zone_code || updated[index].zone,
            section: data.dia_classification?.section_code || updated[index].section,
            confidence: data.dia_classification?.confidence_score,
            qcFlags: data.smart_qc_flags || [],
            orchestratedStatus: data.assigned_status,
            routingCondition: data.routing_condition,
            manualTriageRequired: data.manual_triage_required
          };
        }
        return updated;
      });
    } catch (err) {
      console.error('AI Orchestration failed:', err);
    } finally {
      setOrchestrating(false);
    }
  };

  const handleUploadAll = async () => {
    if (fileList.length === 0) return;

    setUploading(true);
    setError('');

    let successCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const item = fileList[i];
      setUploadProgress(prev => ({ ...prev, [i]: 20 }));

      const formData = new FormData();
      formData.append('file', item.file);

      const metadata = {
        studyId: item.studyId || "study-001",
        artifactCode: item.artifactCode || "02.01.01",
        artifactName: item.title,
        zone: item.zone || "02",
        section: item.section || "02.01",
        title: item.title,
        version: item.version || "1.0",
        country: item.country || "USA",
        confidential: Boolean(item.confidential),
        mandatory: Boolean(item.mandatory),
        status: item.orchestratedStatus || "Draft"
      };

      formData.append('data', JSON.stringify(metadata));

      try {
        setUploadProgress(prev => ({ ...prev, [i]: 60 }));
        await api.post('/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setUploadProgress(prev => ({ ...prev, [i]: 100 }));
        successCount++;
      } catch (err) {
        console.error(`Upload failed for ${item.file.name}:`, err);
        setUploadProgress(prev => ({ ...prev, [i]: -1 }));
      }
    }

    setUploading(false);
    alert(`Batch ingestion completed!\n${successCount} of ${fileList.length} files successfully filed into eTMF.`);
    if (onUploaded) onUploaded();
    onClose();
  };

  const currentItem = fileList[selectedIndex];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 860,
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              📥 Document Ingestion &amp; Batch Intake
            </h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Clinevo eTMF 4.3 §8.6 — Multi-File Upload &amp; DIA Reference Model Auto-Classifier
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 12.5 }}>
              {error}
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#0284c7' : '#cbd5e1'}`,
              background: isDragging ? '#e0f2fe' : '#f8fafc',
              borderRadius: 12,
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: 20
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={e => {
                if (e.target.files) handleFilesAdded(e.target.files);
              }}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.msg,.eml,.txt,.zip"
            />
            <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              Drag &amp; drop clinical documents here, or click to browse
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Supports PDF, Word, Excel, MSG, EML, ZIP archives (up to 500 MB per file)
            </div>
          </div>

          {/* File Queue & Metadata Two-Column Grid */}
          {fileList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
              {/* Queue List */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#475569' }}>
                  FILE QUEUE ({fileList.length})
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {fileList.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    const progress = uploadProgress[idx];
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedIndex(idx)}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #f1f5f9',
                          background: isSelected ? '#e0f2fe' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                          <div style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0284c7' : '#1e293b' }}>
                            {item.file.name}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            {(item.file.size / 1024).toFixed(1)} KB • {item.artifactCode}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {progress === 100 && <span style={{ color: '#059669', fontSize: 12 }}>✓</span>}
                          {progress === -1 && <span style={{ color: '#dc2626', fontSize: 12 }}>✕</span>}
                          <span
                            onClick={e => { e.stopPropagation(); removeFile(idx); }}
                            style={{ color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                          >
                            ×
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metadata Configuration Pane for Selected Item */}
              {currentItem && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9', marginBottom: 12 }}>
                    METADATA &amp; DIA CLASSIFICATION FOR: {currentItem.file.name}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      DOCUMENT TITLE *
                    </label>
                    <input
                      className="modern-input"
                      value={currentItem.title}
                      onChange={e => updateSelectedMeta('title', e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        ARTIFACT CODE (DIA v3.2) *
                      </label>
                      <input
                        className="modern-input"
                        value={currentItem.artifactCode}
                        onChange={e => updateSelectedMeta('artifactCode', e.target.value)}
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        VERSION NUMBER
                      </label>
                      <input
                        className="modern-input"
                        value={currentItem.version}
                        onChange={e => updateSelectedMeta('version', e.target.value)}
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        TARGET STUDY
                      </label>
                      <input
                        className="modern-input"
                        value={currentItem.studyId}
                        onChange={e => updateSelectedMeta('studyId', e.target.value)}
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        COUNTRY
                      </label>
                      <input
                        className="modern-input"
                        value={currentItem.country}
                        onChange={e => updateSelectedMeta('country', e.target.value)}
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={currentItem.confidential}
                        onChange={e => updateSelectedMeta('confidential', e.target.checked)}
                      />
                      Confidential / Blinded
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={currentItem.mandatory}
                        onChange={e => updateSelectedMeta('mandatory', e.target.checked)}
                      />
                      Mandatory Milestone
                    </label>
                  </div>

                  {/* AI Orchestrator Trigger & Status Card */}
                  <div style={{ marginTop: 14, padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16 }}>🤖</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>Gemini 1.5 Document Orchestrator</span>
                      </div>
                      <button
                        onClick={() => handleRunAIOrchestrator(selectedIndex)}
                        disabled={orchestrating}
                        style={{
                          padding: '5px 12px',
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {orchestrating ? 'Analyzing...' : 'Auto-Classify & QC'}
                      </button>
                    </div>

                    {currentItem.confidence !== undefined && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: currentItem.confidence >= 0.85 ? '#dcfce7' : '#fef3c7',
                            color: currentItem.confidence >= 0.85 ? '#15803d' : '#92400e'
                          }}>
                            {Math.round(currentItem.confidence * 100)}% Confidence
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
                            Target: <strong style={{ color: '#0284c7' }}>{currentItem.orchestratedStatus}</strong> ({currentItem.routingCondition})
                          </span>
                        </div>

                        {currentItem.qcFlags && currentItem.qcFlags.length > 0 && (
                          <div style={{ padding: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, color: '#b91c1c' }}>
                            <strong>⚠️ Smart QC Findings (Auto-raising Open Queries):</strong>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              {currentItem.qcFlags.map((flag, idx) => (
                                <li key={idx}>{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {fileList.length} document(s) in queue • Ingestion creates initial 'Draft' ALCOA+ audit entries
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={uploading}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUploadAll}
              disabled={uploading || fileList.length === 0}
              className="btn-primary"
            >
              {uploading ? 'Ingesting Batch...' : `Upload ${fileList.length} Document(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
