import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function LinkDocumentModal({ doc, onClose, onLinked }) {
  const [allDocs, setAllDocs] = useState([]);
  const [existingLinks, setExistingLinks] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [relationship, setRelationship] = useState('Related Document');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [doc]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [docsRes, detailRes] = await Promise.all([
        api.get('/documents'),
        api.get(`/documents/${doc.id}`),
      ]);
      setAllDocs((docsRes.data.documents || []).filter(d => d.id !== doc.id));
      setExistingLinks(detailRes.data.links || []);
    } catch (err) {
      console.error('Failed to load linking data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    if (!selectedTargetId) return;
    setSaving(true);
    try {
      await api.post(`/documents/${doc.id}/links`, {
        targetId: selectedTargetId,
        relationship,
      });
      setSelectedTargetId('');
      if (onLinked) onLinked();
      await loadData();
    } catch (err) {
      alert('Failed to link document: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (linkId) => {
    if (!confirm('Are you sure you want to remove this document link?')) return;
    try {
      await api.delete(`/documents/${doc.id}/links/${linkId}`);
      if (onLinked) onLinked();
      await loadData();
    } catch (err) {
      alert('Failed to remove link: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: 680, maxHeight: '90vh', background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>🔗 Link / Delink Documents (§10 &amp; §8.10.20)</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Main Document: <strong>{doc?.title}</strong> ({doc?.id})</div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 18, color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Linked Documents List */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Currently Linked Documents ({existingLinks.length})</div>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Loading linked records...</div>
            ) : existingLinks.length === 0 ? (
              <div style={{ background: '#f8fafc', padding: 16, textAlign: 'center', borderRadius: 8, color: '#94a3b8', fontSize: 13 }}>
                No cross-referenced documents linked to this record.
              </div>
            ) : (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Linked Document</th>
                    <th>Artifact Code</th>
                    <th>Relationship</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {existingLinks.map(l => (
                    <tr key={l.link_id || l.id}>
                      <td style={{ fontWeight: 600 }}>{l.title}</td>
                      <td>{l.artifact_code || '—'}</td>
                      <td><span className="badge badge-active">{l.relationship || 'Related'}</span></td>
                      <td>
                        <button onClick={() => handleUnlink(l.link_id || l.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Delink
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* New Link Form */}
          <form onSubmit={handleLink} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Add New Document Relationship</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Select Target Document *</label>
                <select className="modern-input" value={selectedTargetId} onChange={(e) => setSelectedTargetId(e.target.value)} required>
                  <option value="">-- Choose document to cross-reference --</option>
                  {allDocs.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.artifact_code ? `[${d.artifact_code}] ` : ''}{d.title} (v{d.version})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Relationship Type</label>
                <select className="modern-input" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                  <option value="Related Document">Related Document</option>
                  <option value="Protocol Amendment">Protocol Amendment</option>
                  <option value="Supporting Evidence">Supporting Evidence</option>
                  <option value="Ethics Approval">Ethics Approval</option>
                  <option value="Translation">Certified Translation</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={saving || !selectedTargetId}>
                {saving ? 'Linking...' : '+ Link Document'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
