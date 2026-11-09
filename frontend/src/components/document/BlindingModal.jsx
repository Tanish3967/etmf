import React, { useState } from 'react';
import api from '../../api';

export default function BlindingModal({ doc, onClose, onUpdated }) {
  const isBlinded = Boolean(doc?.is_blinded);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleToggle = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Regulatory justification is mandatory for blinding/unblinding clinical documents.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/documents/${doc.id}/blind`, {
        blind: !isBlinded,
        reason: reason.trim(),
      });
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update blinding status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: 480, background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
              {isBlinded ? '👁️ Unblind Document (§8.10.12)' : '🔒 Blind Document (§8.10.3)'}
            </h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Target: <strong>{doc?.title}</strong> ({doc?.id})</div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 18, color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        <form onSubmit={handleToggle} style={{ padding: 24 }}>
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ background: isBlinded ? '#eff6ff' : '#fffbeb', border: `1px solid ${isBlinded ? '#bfdbfe' : '#fde68a'}`, padding: 14, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: isBlinded ? '#1e40af' : '#92400e', marginBottom: 4 }}>
              Current Status: {isBlinded ? '🔒 Blinded (Access Restricted)' : '🔓 Unblinded (Standard Access)'}
            </div>
            <div style={{ fontSize: 12, color: isBlinded ? '#3b82f6' : '#b45309', lineHeight: 1.5 }}>
              {isBlinded
                ? 'Unblinding will make this document accessible to general study personnel with standard view privileges.'
                : 'Blinding will restrict access exclusively to users with the explicit "Access Blinded Docs" privilege in their user group.'}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              Regulatory Reason for {isBlinded ? 'Unblinding' : 'Blinding'} *
            </label>
            <textarea
              className="modern-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Enter justification for ${isBlinded ? 'unblinding' : 'blinding'} this clinical record...`}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              type="submit"
              className="btn-primary"
              style={{ background: isBlinded ? '#0284c7' : '#d97706', borderColor: isBlinded ? '#0369a1' : '#b45309' }}
              disabled={saving}
            >
              {saving ? 'Processing...' : isBlinded ? 'Confirm Unblind' : 'Confirm Blind Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
