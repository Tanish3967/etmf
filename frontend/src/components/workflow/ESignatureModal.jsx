import React, { useState, useEffect } from 'react';
import api from '../../api';

const DEFAULT_SIGNATURE_MEANINGS = [
  { id: 'def-1', reason_code: 'APPROVAL', description: 'I approve this document for clinical trial conduct (Approval)' },
  { id: 'def-2', reason_code: 'AUTH_REVIEW', description: 'I have authored and reviewed this document for compliance (Author / Reviewer)' },
  { id: 'def-3', reason_code: 'QC_VERIFY', description: 'I verify the accuracy, authenticity, and completeness of this record (QC Verification)' },
  { id: 'def-4', reason_code: 'ACKNOWLEDGE', description: 'I acknowledge receipt and regulatory acceptance of this file (Acknowledgement)' }
];

export default function ESignatureModal({ doc, user, onClose, onSigned, queue, onOpenNextDoc }) {
  const [username, setUsername] = useState(user?.username || user?.email || '');
  const [password, setPassword] = useState('');
  const [reasons, setReasons] = useState(DEFAULT_SIGNATURE_MEANINGS);
  const [selectedReason, setSelectedReason] = useState(DEFAULT_SIGNATURE_MEANINGS[0].description);
  const [isCustomReason, setIsCustomReason] = useState(false);
  const [customReasonText, setCustomReasonText] = useState('');
  const [comment, setComment] = useState('Approved following clinical QA review.');
  const [acknowledged, setAcknowledged] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  // Queue Prompt States (§8.10.16)
  const [signedResult, setSignedResult] = useState(null);
  const [nextDocInQueue, setNextDocInQueue] = useState(null);

  // Fetch dynamic signature reason templates
  useEffect(() => {
    let active = true;
    async function loadReasons() {
      try {
        // Try workflow endpoint first (accessible to all authenticated roles), fallback to admin endpoint
        let res;
        try {
          res = await api.get('/workflow/signature-reasons');
        } catch {
          res = await api.get('/admin/signature-reasons');
        }

        if (active && res?.data?.reasons?.length > 0) {
          const list = res.data.reasons.map(r => ({
            id: r.id,
            reason_code: r.reason_code,
            description: r.description,
            role_required: r.role_required
          }));
          setReasons(list);
          const matching = list.find(r => !r.role_required || r.role_required === 'ANY' || r.role_required === user?.role);
          setSelectedReason((matching || list[0]).description);
        }
      } catch {
        // Fallback silently to default Part 11 meanings on 403 or network error
      }
    }
    loadReasons();
    return () => {
      active = false;
    };
  }, [user?.role]);

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

    const effectiveMeaning = isCustomReason ? customReasonText.trim() : selectedReason;
    if (!effectiveMeaning) {
      setError('A valid legal meaning / reason for signature is required (§11.50).');
      return;
    }

    setSigning(true);
    setError('');

    try {
      const targetState = doc?.targetState || (doc?.status === 'Pending Signoff' ? 'Signed Off' : 'Approved');
      const res = await api.post(`/workflow/${doc.id}/transition`, {
        nextState: targetState,
        workflowType: doc?.workflow_type,
        comment,
        credentials: {
          username: username.trim(),
          password,
          meaning: effectiveMeaning
        }
      });

      const updatedDocument = res.data.document || { ...doc, status: targetState };
      const esigId = res.data.esigId || 'ESIG-STAMPED';

      // Find next document in review queue
      let nextDoc = null;
      if (queue && queue.length > 0) {
        const idx = queue.findIndex(d => d.id === doc.id);
        if (idx >= 0 && idx < queue.length - 1) {
          nextDoc = queue[idx + 1];
        } else {
          nextDoc = queue.find(d => d.id !== doc.id && ['Pending Review', 'Under Review', 'Pending Approval', 'Pending Signoff'].includes(d.status)) || null;
        }
      } else {
        try {
          const taskRes = await api.get('/workflow/tasks');
          const tasks = taskRes.data?.tasks || [];
          nextDoc = tasks.find(t => t.id !== doc.id && ['Pending Review', 'Under Review', 'Pending Approval', 'Pending Signoff'].includes(t.status)) || null;
        } catch {
          // Non-critical queue fetch fallback
        }
      }

      setSignedResult({ esigId, targetState, updatedDocument });
      setNextDocInQueue(nextDoc);
      if (onSigned) onSigned(updatedDocument);
    } catch (err) {
      setError(err.response?.data?.error || 'Electronic signature authorization failed. Please check your credentials.');
    } finally {
      setSigning(false);
    }
  };

  const handleFinish = () => {
    onClose();
  };

  const handleAdvanceToNext = () => {
    onClose();
    if (onOpenNextDoc && nextDocInQueue) {
      onOpenNextDoc(nextDocInQueue);
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

        {/* Success / Next Document Queue Prompt Screen */}
        {signedResult ? (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              background: '#d1fae5',
              color: '#059669',
              fontSize: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              ✓
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Electronic Signature Executed Successfully
            </h3>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
              Cryptographically Stamped &amp; Bound in ALCOA+ Audit Trail (§11.70)
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 12.5,
              textAlign: 'left',
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Signature Identifier:</span>
                <strong style={{ color: '#0ea5e9', fontFamily: 'monospace' }}>{signedResult.esigId}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Lifecycle State:</span>
                <span className="badge badge-success">{signedResult.targetState}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Signer:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{user?.name || username}</span>
              </div>
            </div>

            {/* Next Document Queue Prompt (§8.10.16) */}
            {nextDocInQueue ? (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '14px 16px',
                textAlign: 'left',
                marginBottom: 24
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    📋 Next Document in Review Queue
                  </span>
                  <span className="badge badge-warning" style={{ fontSize: 11 }}>
                    {nextDocInQueue.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                  {nextDocInQueue.title}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Artifact: <strong style={{ color: '#0ea5e9' }}>{nextDocInQueue.artifact_code || 'N/A'}</strong> • Zone: <strong>{nextDocInQueue.zone || '01'}</strong>
                </div>
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 12,
                color: '#64748b',
                marginBottom: 24
              }}>
                🎉 All assigned documents in this review queue have been processed!
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={handleFinish} className="btn-secondary">
                Close / Return to List
              </button>
              {nextDocInQueue && (
                <button
                  type="button"
                  onClick={handleAdvanceToNext}
                  className="btn-primary"
                  style={{ background: '#0284c7' }}
                >
                  Advance to Next Document ➔
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Signature Credentials Form */
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

            {/* Dynamic Signature Reasons Dropdown (§11.50) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                LEGAL MEANING OF SIGNATURE (§11.50) *
              </label>
              <select
                className="modern-input"
                value={isCustomReason ? '__CUSTOM__' : selectedReason}
                onChange={e => {
                  if (e.target.value === '__CUSTOM__') {
                    setIsCustomReason(true);
                  } else {
                    setIsCustomReason(false);
                    setSelectedReason(e.target.value);
                  }
                }}
                style={{ width: '100%', fontSize: 12.5 }}
              >
                {reasons.map(r => (
                  <option key={r.id || r.reason_code} value={r.description}>
                    {r.reason_code ? `[${r.reason_code}] ` : ''}{r.description} {r.role_required && r.role_required !== 'ANY' ? `(Role: ${r.role_required})` : ''}
                  </option>
                ))}
                <option value="__CUSTOM__">✍️ Other / Custom Legal Attestation Reason...</option>
              </select>

              {isCustomReason && (
                <textarea
                  className="modern-input"
                  rows={2}
                  value={customReasonText}
                  onChange={e => setCustomReasonText(e.target.value)}
                  placeholder="Enter specific legal justification / reason for electronic signature..."
                  style={{ width: '100%', marginTop: 8, fontSize: 12.5, resize: 'none' }}
                  required
                />
              )}
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

            {/* Dual-Component Re-Authentication */}
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

            {/* Part 11 Legal Binding Acknowledgment */}
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
        )}
      </div>
    </div>
  );
}
