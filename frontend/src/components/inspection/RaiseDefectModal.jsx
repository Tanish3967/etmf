import React, { useState } from 'react';
import api from '../../api';

export default function RaiseDefectModal({ onClose, onCreated }) {
  const [newDefect, setNewDefect] = useState({ documentId: 'doc-001', text: '', severity: 'Major' });
  const [creating, setCreating] = useState(false);

  const handleCreateDefect = async (e) => {
    e.preventDefault();
    if (!newDefect.text.trim()) return;

    setCreating(true);
    try {
      await api.post('/qc', {
        document_id: newDefect.documentId,
        query_text: newDefect.text.trim(),
        severity: newDefect.severity
      });
      alert('New QC defect query created and assigned.');
      onCreated();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create QC finding.');
    } finally {
      setCreating(false);
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
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(3px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 500,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>+ Raise New QC Defect Query</h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Clinevo eTMF 4.3 §9 — Quality Control Findings
            </div>
          </div>
          <span style={{ fontSize: 18, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        <form onSubmit={handleCreateDefect} style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              TARGET DOCUMENT ID *
            </label>
            <input
              className="modern-input"
              value={newDefect.documentId}
              onChange={e => setNewDefect({ ...newDefect, documentId: e.target.value })}
              style={{ width: '100%' }}
              placeholder="e.g. doc-001"
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              DEFECT SEVERITY *
            </label>
            <select
              className="modern-input"
              value={newDefect.severity}
              onChange={e => setNewDefect({ ...newDefect, severity: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="Critical">Critical (Immediate audit risk)</option>
              <option value="Major">Major (GCP finding)</option>
              <option value="Medium">Medium (Discrepancy)</option>
              <option value="Minor">Minor (Formatting / Typo)</option>
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              DEFECT QUERY DESCRIPTION *
            </label>
            <textarea
              className="modern-input"
              rows={3}
              value={newDefect.text}
              onChange={e => setNewDefect({ ...newDefect, text: e.target.value })}
              placeholder="Detail the non-conformance, missing attachment, or signature defect..."
              required
              style={{ width: '100%', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newDefect.text.trim()}
              className="btn-primary"
            >
              {creating ? 'Logging Defect...' : 'Log QC Defect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
