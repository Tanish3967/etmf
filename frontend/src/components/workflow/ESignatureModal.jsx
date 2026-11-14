import React, { useState } from 'react';
import api from '../../api';

const SIGNATURE_MEANINGS = [
  "I approve this document for clinical trial conduct (Approval)",
  "I have authored and reviewed this document for compliance (Author / Reviewer)",
  "I verify the accuracy, authenticity, and completeness of this record (QC Verification)",
  "I acknowledge receipt and regulatory acceptance of this file (Acknowledgement)"
];

export default function ESignatureModal({ doc, user, onClose, onSigned }) {
  const [password, setPassword] = useState('');
  const [meaning, setMeaning] = useState(SIGNATURE_MEANINGS[0]);
  const [comment, setComment] = useState('Approved following clinical QA review.');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  const handleSign = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Password re-authentication is mandatory under 21 CFR Part 11.');
      return;
    }

    setSigning(true);
    setError('');

    try {
      const res = await api.post(`/workflow/${doc.id}/transition`, {
        nextState: 'Approved',
        comment,
        credentials: {
          password,
          meaning
        }
      });

      alert(`Electronic Signature successfully stamped!\nSignature ID: ${res.data.esigId || 'ESIG-STAMPED'}\nStatus: Approved`);
      if (onSigned) onSigned(res.data.document);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Electronic signature authorization failed. Please check your password.');
    } finally {
      setSigning(false);
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
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
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
          width: 540,
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 800
            }}>
              ✍️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                21 CFR Part 11 Electronic Signature
              </h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Legally Binding Identity &amp; Approval Attestation
              </div>
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Body */}
        <form onSubmit={handleSign} style={{ padding: 24 }}>
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

          {/* Document Summary Box */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 12.5
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>Target Document:</span>
              <strong style={{ color: '#0f172a' }}>{doc?.title || 'Clinical Document'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>Artifact Code / Version:</span>
              <span style={{ fontWeight: 600, color: '#0ea5e9' }}>{doc?.artifact_code || '02.01.01'} (v{doc?.version || '1.0'})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Signer Identity:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{user?.name || 'Authorized Signer'} ({user?.role || 'TMF Manager'})</span>
            </div>
          </div>

          {/* Meaning Dropdown */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              LEGAL MEANING OF SIGNATURE (§11.50) *
            </label>
            <select
              className="modern-input"
              value={meaning}
              onChange={e => setMeaning(e.target.value)}
              style={{ width: '100%', fontSize: 12.5 }}
            >
              {SIGNATURE_MEANINGS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Comment Field */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              AUDIT TRAIL COMMENT / NOTES
            </label>
            <input
              className="modern-input"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="e.g. Approved following review against GCP standards"
              style={{ width: '100%' }}
            />
          </div>

          {/* Re-Authentication Password */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 18
          }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 6 }}>
              🔒 CONFIRM IDENTITY (PASSWORD RE-AUTHENTICATION) *
            </label>
            <input
              type="password"
              className="modern-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your login password to sign"
              required
              autoFocus
              style={{ width: '100%', background: '#fff' }}
            />
            <div style={{ fontSize: 11, color: '#15803d', marginTop: 6, lineHeight: 1.4 }}>
              Pursuant to 21 CFR Part 11, your signature incorporates a cryptographic SHA-256 seal linked to your user record and current IP address.
            </div>
          </div>

          {/* Regulatory Declaration */}
          <div style={{
            fontSize: 11,
            color: '#64748b',
            lineHeight: 1.4,
            marginBottom: 20,
            padding: '8px 12px',
            background: '#f8fafc',
            borderRadius: 6,
            borderLeft: '3px solid #0ea5e9'
          }}>
            I understand that by executing this electronic signature, I certify that I am the individual named above and that this signature is legally binding.
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={signing || !password}
              className="btn-primary"
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              {signing ? 'Verifying & Stamping...' : '✍️ Execute Electronic Signature'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
