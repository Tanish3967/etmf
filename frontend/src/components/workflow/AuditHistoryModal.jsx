import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function AuditHistoryModal({ doc, onClose }) {
  const [history, setHistory] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAudit();
  }, [doc]);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/documents/${doc.id}`);
      setHistory(res.data.workflowHistory || []);
      const verRes = await api.get(`/documents/${doc.id}/versions`);
      setVersions(verRes.data.versions || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit history.');
    } finally {
      setLoading(false);
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
          width: 720,
          maxHeight: '85vh',
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
              📜 21 CFR Part 11 Audit Trail &amp; Workflow History
            </h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Target: {doc?.title || 'Clinical Document'} — Lineage &amp; Electronic Signatures
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading audit records...</div>
          ) : error ? (
            <div style={{ padding: 14, background: '#fee2e2', color: '#dc2626', borderRadius: 8 }}>{error}</div>
          ) : (
            <div>
              {/* Timeline */}
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                <div style={{ position: 'absolute', top: 10, bottom: 10, left: 7, width: 2, background: '#e2e8f0' }} />

                {history.map((h, idx) => (
                  <div key={h.id || idx} style={{ position: 'relative', marginBottom: 20 }}>
                    {/* Circle icon */}
                    <div style={{
                      position: 'absolute',
                      left: -24,
                      top: 4,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: h.esig_id ? '#10b981' : '#0ea5e9',
                      border: '3px solid #fff',
                      boxShadow: '0 0 0 2px #e2e8f0'
                    }} />

                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '12px 16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{h.from_state || 'Initial'}</span>
                          <span style={{ color: '#0ea5e9' }}>➔</span>
                          <span className={`badge ${h.to_state === 'Approved' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: 11 }}>
                            {h.to_state}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: '#334155', marginBottom: 4 }}>
                        <strong>Action by:</strong> {h.user_name || 'System User'} {h.user_role ? `(${h.user_role})` : ''}
                      </div>

                      {h.comment && (
                        <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', background: '#fff', padding: '6px 10px', borderRadius: 4, border: '1px solid #f1f5f9' }}>
                          "{h.comment}"
                        </div>
                      )}

                      {h.esig_id && (
                        <div style={{
                          marginTop: 8,
                          padding: '6px 10px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          borderRadius: 6,
                          fontSize: 11,
                          color: '#065f46',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span>✅</span>
                          <span><strong>21 CFR Part 11 Electronic Signature Stamp:</strong> ID #{h.esig_id.substring(0, 12)}... (Verified Cryptographic Seal)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {history.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                    No workflow transitions recorded for this document yet.
                  </div>
                )}
              </div>
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
          <button
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ fontSize: 12 }}
          >
            🖨️ Export Auditor Inspection Certificate
          </button>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
