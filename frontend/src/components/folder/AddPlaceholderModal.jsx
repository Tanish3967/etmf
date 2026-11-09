import React, { useState } from 'react';
import api from '../../api';

export default function AddPlaceholderModal({ node, studyId = 'study-001', onClose, onCreated }) {
  const [artifactCode, setArtifactCode] = useState(node?.code ? `${node.code}.01` : '02.01.01');
  const [artifactName, setArtifactName] = useState(node?.name ? `Expected ${node.name}` : 'Expected Document Record');
  const [zone, setZone] = useState(node?.zoneCode || node?.code || '02');
  const [section, setSection] = useState(node?.code || '02.01');
  const [expectedDate, setExpectedDate] = useState('2026-12-31');
  const [isMandatory, setIsMandatory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!artifactCode.trim() || !artifactName.trim()) {
      setError('Artifact Code and Name are required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.post('/folders/placeholders', {
        study_id: studyId,
        artifact_code: artifactCode,
        artifact_name: artifactName,
        zone: String(zone),
        section: String(section),
        expected_by_date: expectedDate,
        is_mandatory: isMandatory
      });
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create expected placeholder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.6)',
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
          width: 520,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              + Add Expected Placeholder (EDL)
            </h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Clinevo eTMF 4.3 §8.8 — Expected Document Milestone Placeholder
            </div>
          </div>
          <span style={{ fontSize: 18, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              marginBottom: 16
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                ARTIFACT CODE *
              </label>
              <input
                className="modern-input"
                value={artifactCode}
                onChange={e => setArtifactCode(e.target.value)}
                placeholder="e.g. 02.01.01"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                EXPECTED BY DATE
              </label>
              <input
                type="date"
                className="modern-input"
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              ARTIFACT NAME / TITLE *
            </label>
            <input
              className="modern-input"
              value={artifactName}
              onChange={e => setArtifactName(e.target.value)}
              placeholder="e.g. Master Informed Consent Form v1.0"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                ZONE CODE
              </label>
              <input
                className="modern-input"
                value={zone}
                onChange={e => setZone(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                SECTION CODE
              </label>
              <input
                className="modern-input"
                value={section}
                onChange={e => setSection(e.target.value)}
              />
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Mandatory Artifact</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Impacts study completeness calculation in EDL audit</div>
            </div>
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={e => setIsMandatory(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating Placeholder...' : 'Save Placeholder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
