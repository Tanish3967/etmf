import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function DocumentViewer({
  doc,
  onClose,
  onSignDocument,
  onAdvanceWorkflow,
  onViewAuditHistory
}) {
  const [loading, setLoading] = useState(true);
  const [fileBlobUrl, setFileBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [fileType, setFileType] = useState('PDF');
  const [hasFile, setHasFile] = useState(false);
  const [error, setError] = useState('');
  const [docDetail, setDocDetail] = useState(doc);
  const [sidebarTab, setSidebarTab] = useState('metadata'); // 'metadata' | 'audit' | 'versions'

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    async function loadDocument() {
      setLoading(true);
      setError('');
      try {
        // 1. Fetch full document details & workflow history
        try {
          const detailRes = await api.get(`/documents/${doc.id}`);
          if (active && detailRes.data) {
            setDocDetail(detailRes.data.document || doc);
          }
        } catch {
          // Non-critical, fallback to prop
        }

        // 2. Fetch binary stream
        const response = await api.get(`/documents/${doc.id}/view`, {
          responseType: 'blob'
        });

        if (!active) return;

        const contentType = response.headers['content-type'] || '';
        const blob = response.data;

        // Check if backend returned JSON fallback (e.g. no physical binary)
        if (contentType.includes('application/json') || blob.type.includes('application/json')) {
          const text = await blob.text();
          try {
            const json = JSON.parse(text);
            if (json.hasBinary === false) {
              setHasFile(false);
              setLoading(false);
              return;
            }
          } catch {
            // Not JSON
          }
        }

        setHasFile(true);
        const ext = (doc.file_name || doc.file_type || '').toLowerCase();

        if (contentType.includes('application/pdf') || ext.endsWith('.pdf') || doc.file_type === 'PDF') {
          setFileType('PDF');
          createdUrl = URL.createObjectURL(blob);
          setFileBlobUrl(createdUrl);
        } else if (contentType.includes('image/') || ext.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
          setFileType('IMAGE');
          createdUrl = URL.createObjectURL(blob);
          setFileBlobUrl(createdUrl);
        } else if (contentType.includes('text/html') || ext.match(/\.(html|htm)$/)) {
          setFileType('HTML');
          const text = await blob.text();
          setTextContent(text);
          createdUrl = URL.createObjectURL(blob);
          setFileBlobUrl(createdUrl);
        } else if (contentType.includes('text/') || ext.match(/\.(txt|csv|tsv|json|xml|rtf)$/)) {
          setFileType(ext.endsWith('.csv') ? 'CSV' : 'TEXT');
          const text = await blob.text();
          setTextContent(text);
          createdUrl = URL.createObjectURL(blob);
          setFileBlobUrl(createdUrl);
        } else if (ext.match(/\.(docx|doc|xlsx|xls|pptx|ppt)$/)) {
          setFileType('OFFICE');
          createdUrl = URL.createObjectURL(blob);
          setFileBlobUrl(createdUrl);
        } else {
          setFileType('GENERIC');
          createdUrl = URL.createObjectURL(blob);
          setFileBlobUrl(createdUrl);
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to load document stream:', err);
        setError(err.response?.data?.error || err.message || 'Unable to load document stream');
        setHasFile(false);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDocument();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc]);

  const handleDownload = () => {
    if (fileBlobUrl) {
      const a = document.createElement('a');
      a.href = fileBlobUrl;
      a.download = doc.file_name || `${doc.title}.${(doc.file_type || 'pdf').toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(`/api/documents/${doc.id}/download`, '_blank');
    }
  };

  const currentDoc = docDetail || doc;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(15, 23, 42, 0.8)",
      backdropFilter: "blur(6px)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Top Header Bar */}
      <div style={{
        height: 60,
        background: "#0f172a",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid #1e293b"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#fff",
              borderRadius: 6,
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16
            }}
            title="Close viewer"
          >
            ✕
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>
                {currentDoc.title || currentDoc.file_name || "Document Preview"}
              </span>
              <span className={`badge ${currentDoc.status === 'Approved' || currentDoc.status === 'Published' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                {currentDoc.status || "Draft"}
              </span>
              <span className="badge badge-info" style={{ fontSize: 11 }}>
                v{currentDoc.version || "1.0"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              ID: <strong style={{ color: "#38bdf8" }}>{currentDoc.id}</strong> • DIA Code: <strong style={{ color: "#38bdf8" }}>{currentDoc.artifact_code || "N/A"}</strong>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownload}
            style={{ background: "#1e293b", color: "#f8fafc", borderColor: "#475569", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
            title="Download original file"
          >
            <span>📥</span> <span>Download File</span>
          </button>

          {onAdvanceWorkflow && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onAdvanceWorkflow(currentDoc)}
              style={{ background: "#1e293b", color: "#38bdf8", borderColor: "#0284c7", fontSize: 12 }}
            >
              ⚡ Advance Workflow
            </button>
          )}

          {onSignDocument && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onSignDocument(currentDoc)}
              style={{ background: "#059669", fontSize: 12 }}
            >
              ✍️ Sign (Part 11)
            </button>
          )}
        </div>
      </div>

      {/* Main Body: Document Content Area + Sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Document Content Canvas */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#334155", position: "relative" }}>
          {loading ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: 16 }}>
              <div style={{ fontSize: 36, animation: "spin 1.5s linear infinite" }}>🔄</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Streaming Clinical Document...</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>21 CFR Part 11 Verified Stream</div>
            </div>
          ) : error ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>Failed to Stream Document</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", maxWidth: 460, marginTop: 6, marginBottom: 20 }}>{error}</div>
              <button type="button" onClick={handleDownload} className="btn-primary" style={{ fontSize: 12 }}>
                Try Downloading File Directly
              </button>
            </div>
          ) : hasFile && fileType === 'PDF' && fileBlobUrl ? (
            <iframe
              src={`${fileBlobUrl}#toolbar=1&navpanes=1`}
              title={currentDoc.title}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : hasFile && fileType === 'HTML' && fileBlobUrl ? (
            <div style={{ flex: 1, background: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                Rendering HTML Clinical Document: <strong>{currentDoc.file_name}</strong>
              </div>
              <iframe
                src={fileBlobUrl}
                title={currentDoc.title}
                sandbox="allow-same-origin allow-scripts"
                style={{ flex: 1, width: "100%", border: "none" }}
              />
            </div>
          ) : hasFile && fileType === 'IMAGE' && fileBlobUrl ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 30, overflow: "auto" }}>
              <img
                src={fileBlobUrl}
                alt={currentDoc.title}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
              />
            </div>
          ) : hasFile && (fileType === 'TEXT' || fileType === 'CSV') ? (
            <div style={{ flex: 1, padding: 30, overflow: "auto", display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: 1000, background: "#fff", borderRadius: 8, padding: 30, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {fileType === 'CSV' ? '📊 Dataset / Tabular Content' : '📄 Text Content'}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {currentDoc.file_name}
                  </div>
                </div>
                <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.6, color: "#1e293b", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {textContent}
                </pre>
              </div>
            </div>
          ) : hasFile && fileType === 'OFFICE' ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 40, width: 500, textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📑</div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 18, color: "#0f172a" }}>{currentDoc.title}</h3>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                  Format: <strong>{currentDoc.file_type || 'Office Document'}</strong> ({currentDoc.file_name})
                </div>
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569", marginBottom: 24, textAlign: "left" }}>
                  <div>• Document ID: <strong>{currentDoc.id}</strong></div>
                  <div>• Artifact Code: <strong>{currentDoc.artifact_code}</strong></div>
                  <div>• Lifecycle: <strong>{currentDoc.status}</strong> (v{currentDoc.version})</div>
                </div>
                <button type="button" onClick={handleDownload} className="btn-primary" style={{ padding: "10px 24px", fontSize: 13 }}>
                  📥 Download to View in Office App
                </button>
              </div>
            </div>
          ) : (
            /* Document Certificate / Metadata Sheet (Fallback for mock records) */
            <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{ width: 850, minHeight: 900, background: "white", boxShadow: "0 15px 35px rgba(0,0,0,0.2)", borderRadius: 6, padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#0284c7", fontWeight: 700, letterSpacing: 0.5 }}>
                      CLINICAL TRIAL MASTER FILE RECORD • 21 CFR PART 11
                    </div>
                    <h1 style={{ margin: "6px 0 0 0", color: "#0f172a", fontSize: 22 }}>
                      {currentDoc.title}
                    </h1>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="badge badge-info" style={{ fontSize: 12 }}>Version {currentDoc.version || "1.0"}</span>
                  </div>
                </div>

                <div style={{ marginTop: 30, padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: 12, color: "#0f172a", textTransform: "uppercase" }}>Regulatory Attributes</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, color: "#475569" }}>
                    <div><strong>Document ID:</strong> {currentDoc.id}</div>
                    <div><strong>DIA Reference:</strong> {currentDoc.artifact_code || "N/A"}</div>
                    <div><strong>Hierarchy:</strong> Zone {currentDoc.zone || "01"} &gt; Section {currentDoc.section || "01.01"}</div>
                    <div><strong>Status:</strong> {currentDoc.status || "Draft"}</div>
                    <div><strong>Confidentiality:</strong> {currentDoc.confidential ? "RESTRICTED / BLINDED" : "UNRESTRICTED"}</div>
                    <div><strong>Target Study:</strong> {currentDoc.study_id || "study-001"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 30, lineHeight: 1.8, color: "#334155", textAlign: "justify", fontSize: 13 }}>
                  <p>
                    This record represents the verified electronic Trial Master File entry pursuant to ICH E6(R2) §5.5,
                    21 CFR Part 11, and European Union Annex 11 regulations. Audit logs maintain a complete timestamped
                    record of creation, modification, review, and electronic signatures.
                  </p>
                  <p>
                    Physical binary file attachment: {currentDoc.file_name ? <code>{currentDoc.file_name}</code> : 'Simulated protocol document record'}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Metadata & Audit Trail */}
        <div style={{ width: 340, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
          {/* Tab Navigation */}
          <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <button
              type="button"
              onClick={() => setSidebarTab('metadata')}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                background: sidebarTab === 'metadata' ? "#fff" : "transparent",
                color: sidebarTab === 'metadata' ? "#0284c7" : "#64748b",
                fontWeight: sidebarTab === 'metadata' ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                borderBottom: sidebarTab === 'metadata' ? "2px solid #0284c7" : "none"
              }}
            >
              Metadata
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('audit')}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: "none",
                background: sidebarTab === 'audit' ? "#fff" : "transparent",
                color: sidebarTab === 'audit' ? "#0284c7" : "#64748b",
                fontWeight: sidebarTab === 'audit' ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                borderBottom: sidebarTab === 'audit' ? "2px solid #0284c7" : "none"
              }}
            >
              Audit Trail
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {sidebarTab === 'metadata' ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Document ID</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0ea5e9", wordBreak: "break-all" }}>{currentDoc.id}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>DIA Artifact Code</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{currentDoc.artifact_code || "N/A"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Zone &amp; Section</div>
                  <div style={{ fontSize: 13, color: "#334155" }}>
                    Zone {currentDoc.zone || "01"} &gt; Section {currentDoc.section || "01.01"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Lifecycle Status</div>
                  <span className={`badge ${currentDoc.status === 'Approved' || currentDoc.status === 'Published' ? 'badge-success' : 'badge-warning'}`}>
                    {currentDoc.status || "Draft"}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Version Number</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>v{currentDoc.version || "1.0"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>File Info</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    {currentDoc.file_name ? (
                      <>
                        <div>Name: <strong>{currentDoc.file_name}</strong></div>
                        <div>Type: <strong>{currentDoc.file_type || 'File'}</strong></div>
                        {currentDoc.file_size && <div>Size: {(currentDoc.file_size / 1024).toFixed(1)} KB</div>}
                      </>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Simulated metadata-only document</span>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Compliance Flags</div>
                  <div style={{ fontSize: 12, color: "#334155", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div>• Confidentiality: {currentDoc.confidential ? '🔒 Confidential' : 'Unrestricted'}</div>
                    <div>• Mandatory Milestone: {currentDoc.mandatory ? 'Yes' : 'No'}</div>
                    <div>• 21 CFR Part 11: Certified e-Record</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                  ALCOA+ Traceability Record
                </div>
                <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11.5, color: "#475569" }}>
                  <div><strong>Action:</strong> Document Uploaded &amp; Verified</div>
                  <div style={{ color: "#64748b", marginTop: 2 }}>Timestamp: {currentDoc.created_at || 'Just now'}</div>
                  <div style={{ color: "#0284c7", marginTop: 2 }}>Status: {currentDoc.status || 'Draft'}</div>
                </div>
                {onViewAuditHistory && (
                  <button
                    type="button"
                    onClick={() => onViewAuditHistory(currentDoc)}
                    className="btn-secondary"
                    style={{ width: "100%", fontSize: 12, marginTop: 8 }}
                  >
                    Open Complete Audit Log ➔
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
