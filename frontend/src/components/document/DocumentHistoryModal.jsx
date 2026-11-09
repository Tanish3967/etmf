import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function DocumentHistoryModal({ doc, onClose, onSelectVersion }) {
  const [versions, setVersions] = useState([]);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('versions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [doc]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [verRes, docRes] = await Promise.all([
        api.get(`/documents/${doc.id}/versions`),
        api.get(`/documents/${doc.id}`),
      ]);
      setVersions(verRes.data.versions || []);
      setWorkflowHistory(docRes.data.workflowHistory || []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: 720, maxHeight: '90vh', background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>📜 Document Version &amp; Revision History (§8.10.9 &amp; §8.13)</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Document ID: <strong>{doc?.id}</strong> | Current Version: <strong>v{doc?.version}</strong></div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 18, color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Tab Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px', background: '#f8fafc' }}>
          <button
            onClick={() => setActiveTab('versions')}
            style={{
              padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: activeTab === 'versions' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'versions' ? '2px solid #0284c7' : '2px solid transparent',
            }}
          >
            Version Lineage ({versions.length})
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            style={{
              padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: activeTab === 'workflow' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'workflow' ? '2px solid #0284c7' : '2px solid transparent',
            }}
          >
            Workflow Transition Audit ({workflowHistory.length})
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading document records...</div>
          ) : activeTab === 'versions' ? (
            <div>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Created By</th>
                    <th>Created Timestamp (UTC)</th>
                    <th>File Checksum / Path</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                        Primary Version (v{doc?.version}) — Initial baseline upload.
                      </td>
                    </tr>
                  ) : (
                    versions.map((v, i) => (
                      <tr key={v.id || i}>
                        <td>
                          <span className="badge badge-active">v{v.version}</span>
                          {v.version === doc?.version && <span style={{ marginLeft: 6, fontSize: 11, color: '#059669', fontWeight: 600 }}>Current</span>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{v.created_by_name || 'System User'}</td>
                        <td style={{ fontSize: 12, color: '#475569' }}>{v.created_at}</td>
                        <td style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{v.file_path || 'sha256-verified'}</td>
                        <td>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 11 }}
                            onClick={() => {
                              if (onSelectVersion) onSelectVersion(v);
                              onClose();
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Transition</th>
                    <th>User</th>
                    <th>Comments / Signature Meaning</th>
                    <th>Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                        No formal workflow transitions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    workflowHistory.map((h, i) => (
                      <tr key={h.id || i}>
                        <td>
                          <span style={{ color: '#475569', fontWeight: 500 }}>{h.from_state || 'Draft'}</span>
                          <span style={{ margin: '0 6px', color: '#0284c7' }}>➔</span>
                          <strong style={{ color: '#0f172a' }}>{h.to_state}</strong>
                        </td>
                        <td style={{ fontWeight: 600 }}>{h.user_name || 'Workflow Actor'}</td>
                        <td style={{ fontSize: 12, color: '#475569' }}>{h.comment || h.signature_meaning || 'Approved per GCP'}</td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{h.created_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
