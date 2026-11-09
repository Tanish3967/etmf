import React, { useState } from 'react';
import api from '../../api';

export default function RaiseQueryModal({ doc, onClose, onQueryRaised }) {
  const [queryType, setQueryType] = useState('Content Issue');
  const [severity, setSeverity] = useState('Major');
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/queries', {
        documentId: doc.id,
        studyId: doc.study_id || 'study-001',
        queryType,
        severity,
        text: text.trim(),
        dueDate: dueDate || undefined,
      });
      if (onQueryRaised) onQueryRaised();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to raise query.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: 520, background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>❓ Raise Document Query (§8.10.25)</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Target: <strong>{doc?.title}</strong> ({doc?.id})</div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 18, color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Query Type *</label>
              <select className="modern-input" value={queryType} onChange={(e) => setQueryType(e.target.value)} required>
                <option value="Content Issue">Content Issue / Discrepancy</option>
                <option value="Missing Signature">Missing Signature</option>
                <option value="Incorrect Version">Incorrect Version</option>
                <option value="Metadata Error">Metadata / Date Error</option>
                <option value="Illegible Document">Illegible / Poor Scan Quality</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Severity Level *</label>
              <select className="modern-input" value={severity} onChange={(e) => setSeverity(e.target.value)} required>
                <option value="Critical">Critical (Immediate Audit Risk)</option>
                <option value="Major">Major (QC Requirement)</option>
                <option value="Minor">Minor (Formatting / Administrative)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Resolution Due Date</label>
            <input type="date" className="modern-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Query Question / Clarification *</label>
            <textarea
              className="modern-input"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe the discrepancy or required action for the author/site team..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ background: '#0284c7' }} disabled={saving || !text.trim()}>
              {saving ? 'Raising Query...' : 'Submit Query'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
