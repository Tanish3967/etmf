import React, { useState } from 'react';
import api from '../../api';

const SIGNATURE_MEANINGS = [
  "I approve this document for clinical trial conduct (Approval)",
  "I have authored and reviewed this document for compliance (Author / Reviewer)",
  "I verify the accuracy, authenticity, and completeness of this record (QC Verification)",
  "I acknowledge receipt and regulatory acceptance of this file (Acknowledgement)"
];

export default function ESignatureModal({ doc, user, onClose, onSigned }) {
  const [username, setUsername] = useState(user?.username || user?.email || '');
  const [password, setPassword] = useState('');
  const [meaning, setMeaning] = useState(SIGNATURE_MEANINGS[0]);
  const [comment, setComment] = useState('Approved following clinical QA review.');
  const [acknowledged, setAcknowledged] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  const handleSign = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('User ID / Username is required for dual-component re-authentication (21 CFR §11.200).');
      return;
    }
    if (!password) {
      setError('Password re-authentication is mandatory under 21 CFR Part 11.');
      return;
    }
    if (!acknowledged) {
      setError('You must confirm the 21 CFR Part 11 legal binding acknowledgment before signing.');
      return;
    }

    setSigning(true);
    setError('');

    try {
      const res = await api.post(`/workflow/${doc.id}/transition`, {
        nextState: 'Approved',
        comment,
        credentials: {
          username: username.trim(),
          password,
          meaning
        }
      });

      alert(`Electronic Signature successfully stamped!\nSignature ID: ${res.data.esigId || 'ESIG-STAMPED'}\nStatus: Approved`);
      if (onSigned) onSigned(res.data.document);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Electronic signature authorization failed. Please check your credentials.');
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
          width: 560,
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
                Dual-Component Identification &amp; Legally Binding Attestation (§11.200)
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
          <div style={{ marginBottom: 14 }}>
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
          <div style={{ marginBottom: 14 }}>
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

          {/* Dual-Component Re-Authentication (Username & Password) */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 16
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 10 }}>
              🔒 DUAL-COMPONENT RE-AUTHENTICATION (21 CFR §11.200) *
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                USER ID / USERNAME *
              </label>
              <input
                type="text"
                className="modern-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your user ID or email"
                required
                style={{ width: '100%', background: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                PASSWORD *
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
            </div>

            <div style={{ fontSize: 10.5, color: '#15803d', marginTop: 8, lineHeight: 1.4 }}>
              Pursuant to 21 CFR §11.70, your signature will be cryptographically bound via SHA-256 to the document binary digest, your identity, and timestamp.
            </div>
          </div>

          {/* Part 11 Legal Binding Acknowledgment Checkbox */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 16,
            padding: '10px 12px',
            background: '#f8fafc',
            borderRadius: 6,
            borderLeft: '3px solid #0ea5e9'
          }}>
            <input
              type="checkbox"
              id="part11-ack"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              style={{ marginTop: 2, cursor: 'pointer' }}
              required
            />
            <label htmlFor="part11-ack" style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.4, cursor: 'pointer', fontWeight: 500 }}>
              I confirm that my electronic signature is the legally binding equivalent of my traditional handwritten signature pursuant to 21 CFR Part 11.
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={signing || !username.trim() || !password || !acknowledged}
              className="btn-primary"
              style={{ background: '#059669', borderColor: '#059669', opacity: (signing || !username.trim() || !password || !acknowledged) ? 0.6 : 1 }}
            >
              {signing ? 'Verifying & Stamping...' : '✍️ Execute Electronic Signature'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
