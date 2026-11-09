import React, { useState } from 'react';
import api from '../../api';

export default function RedactionModal({ doc, onClose, onRedacted }) {
  const [zones, setZones] = useState([
    { id: 1, label: 'Subject PII (Name/DOB)', applied: true },
    { id: 2, label: 'Financial / Commercial Terms', applied: false },
    { id: 3, label: 'Investigator Personal Signature', applied: false },
  ]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(false);

  const toggleZone = (id) => {
    setZones(zones.map(z => z.id === id ? { ...z, applied: !z.applied } : z));
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.patch(`/documents/${doc.id}/redact`, {
        regions: zones.filter(z => z.applied).map(z => z.label),
      });
      setSuccess(true);
      if (onRedacted) onRedacted();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      alert('Failed to redact document: ' + (err.response?.data?.error || err.message));
    } finally {
      setApplying(false);
      setShowConfirm(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: 700, maxHeight: '90vh', background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>⬛ Document Redaction Tool (§8.10.14)</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Target: <strong>{doc?.title}</strong> ({doc?.id})</div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 18, color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Body Canvas Preview */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          {success && (
            <div style={{ background: '#d1fae5', border: '1px solid #10b981', color: '#065f46', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
              ✓ The redacted document has been permanently committed and audit-logged.
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24, minHeight: 280, position: 'relative' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: 15, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
              {doc?.title || 'Clinical Study Document'}
            </h4>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.8 }}>
              This clinical evaluation was conducted under ICH-GCP guidelines at clinical study site. 
              The principal investigator {zones[0].applied ? <span style={{ background: '#000', color: '#000', padding: '0 40px', borderRadius: 2 }}>REDACTED</span> : <strong style={{ color: '#0284c7' }}>Dr. Sarah Chen, MD (DOB: 12/04/1978)</strong>} oversaw trial execution.
            </p>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.8 }}>
              Subject compensation and site milestone funding were allocated per contract schedule {zones[1].applied ? <span style={{ background: '#000', color: '#000', padding: '0 50px', borderRadius: 2 }}>REDACTED</span> : <span style={{ background: '#fef08a', padding: '0 4px' }}>USD $450,000 disbursement per milestone</span>}.
            </p>
            <div style={{ marginTop: 24, padding: 12, border: '1px dashed #cbd5e1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Signature Block Zone:</span>
              {zones[2].applied ? <span style={{ background: '#000', color: '#000', padding: '4px 60px', borderRadius: 2 }}>REDACTED</span> : <span style={{ fontSize: 12, fontStyle: 'italic', color: '#0f172a' }}>[Verified Digital Signature Placeholder]</span>}
            </div>
          </div>

          <div style={{ marginTop: 18, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Redaction Zones</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {zones.map(z => (
                <label key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={z.applied} onChange={() => toggleZone(z.id)} />
                  <span>{z.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Selected: <strong>{zones.filter(z => z.applied).length} zones</strong>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={onClose} disabled={applying}>Cancel</button>
            <button className="btn-primary" style={{ background: '#dc2626', borderColor: '#b91c1c' }} onClick={() => setShowConfirm(true)} disabled={applying || zones.filter(z => z.applied).length === 0}>
              Apply Permanent Redaction
            </button>
          </div>
        </div>

        {/* Confirm Modal */}
        {showConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 24, borderRadius: 10, maxWidth: 400, boxShadow: '0 20px 30px rgba(0,0,0,0.2)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>⚠️ Apply Redaction</h4>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                This action will permanently black out the selected zones in the document rendition. This operation cannot be undone and will be logged in the 21 CFR Part 11 audit trail.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn-secondary" onClick={() => setShowConfirm(false)} disabled={applying}>Cancel</button>
                <button className="btn-primary" style={{ background: '#dc2626' }} onClick={handleApply} disabled={applying}>
                  {applying ? 'Applying...' : 'Confirm Redaction'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
