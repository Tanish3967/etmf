import React, { useState } from 'react';
import api from '../../api';

export default function ResolveFindingModal({ query, onClose, onResolved }) {
  const [resolutionText, setResolutionText] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!query || !resolutionText.trim()) return;

    setSavingResolution(true);
    try {
      await api.patch(`/qc/${query.id}`, {
        status: 'Closed',
        audit_comments: resolutionText.trim()
      });
      alert('QC finding resolved and recorded in ALCOA+ audit trail.');
      onResolved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update QC finding.');
    } finally {
      setSavingResolution(false);
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
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Resolve QC Finding</h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {query.document_name}
            </div>
          </div>
          <span style={{ fontSize: 18, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        <form onSubmit={handleResolve} style={{ padding: 20 }}>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12,
            color: '#334155',
            marginBottom: 16
          }}>
            <strong style={{ color: '#0f172a' }}>Defect Query:</strong> {query.query_text}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              ALCOA+ RESOLUTION JUSTIFICATION *
            </label>
            <textarea
              className="modern-input"
              rows={4}
              value={resolutionText}
              onChange={e => setResolutionText(e.target.value)}
              placeholder="Describe corrective actions taken (e.g. Corrected signature page uploaded, verified against source record)..."
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
              disabled={savingResolution || !resolutionText.trim()}
              className="btn-primary"
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              {savingResolution ? 'Closing...' : 'Close & Record in Audit Trail'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
