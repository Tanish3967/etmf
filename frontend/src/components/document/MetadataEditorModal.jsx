import React, { useState } from 'react';
import api from '../../api';

export default function MetadataEditorModal({ doc, onClose, onSaved }) {
  const [title, setTitle] = useState(doc?.title || '');
  const [effectiveDate, setEffectiveDate] = useState(doc?.effective_date || '');
  const [expiryDate, setExpiryDate] = useState(doc?.expiry_date || '');
  const [country, setCountry] = useState(doc?.country || 'USA');
  const [confidential, setConfidential] = useState(Boolean(doc?.confidential));
  const [reasonForChange, setReasonForChange] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (doc?.status === 'Approved' && !reasonForChange.trim()) {
      setError('21 CFR Part 11 / ALCOA+ requirement: Reason for change is mandatory for approved records.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/documents/${doc.id}/metadata`, {
        title,
        effectiveDate,
        expiryDate,
        country,
        confidential,
        reasonForChange: reasonForChange.trim() || undefined,
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update metadata.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: 520, background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>⚙️ Document Metadata &amp; Properties (§8.10.23)</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Document ID: <strong>{doc?.id}</strong> ({doc?.artifact_code || 'TMF'})</div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 18, color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        <form onSubmit={handleSave} style={{ padding: 24 }}>
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Document Title *</label>
            <input className="modern-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Effective Date</label>
              <input type="date" className="modern-input" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Expiration Date</label>
              <input type="date" className="modern-input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Applicable Country</label>
              <input className="modern-input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. USA, GBR, DEU" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Confidentiality</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
                Confidential / Restricted
              </label>
            </div>
          </div>

          {doc?.status === 'Approved' && (
            <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                Reason for Change (21 CFR Part 11 ALCOA+) *
              </label>
              <textarea 
                className="modern-input" 
                rows={2} 
                value={reasonForChange} 
                onChange={(e) => setReasonForChange(e.target.value)}
                placeholder="Regulatory justification required for modifying approved documents..."
                required 
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Updating Metadata...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
