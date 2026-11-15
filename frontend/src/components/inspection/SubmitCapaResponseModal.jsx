import React, { useState } from 'react';
import api from '../../api';

export default function SubmitCapaResponseModal({ planId, finding, onClose, onSubmitted }) {
  const [response, setResponse] = useState('');
  const [capaRef, setCapaRef] = useState('');
  const [status, setStatus] = useState('Responded');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!response.trim()) {
      setError('Auditee response and corrective action explanation are mandatory.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post(`/qc/plans/${planId}/responses`, {
        document_id: finding?.document_id,
        finding_id: finding?.id,
        auditee_response: response.trim(),
        capa_reference: capaRef.trim() || undefined,
        status
      });

      if (onSubmitted) {
        onSubmitted();
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit auditee response.');
    } finally {
      setSubmitting(false);
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
          width: 520,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              🛡️ Submit Auditee CAPA Response
            </h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Clinevo eTMF 4.3 §11 b — Corrective &amp; Preventive Action Logging (21 CFR Part 11)
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
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

          {/* Finding Reference Summary */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>Target Document:</span>
              <strong style={{ color: '#0f172a' }}>{finding?.document_title || finding?.title || finding?.document_id}</strong>
            </div>
            {finding?.artifact_code && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Artifact Code:</span>
                <span style={{ color: '#0284c7', fontWeight: 600 }}>{finding.artifact_code}</span>
              </div>
            )}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0' }}>
              <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: 2 }}>Auditor Deficiency Finding:</div>
              <div style={{ color: '#334155', fontStyle: 'italic', background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid #f1f5f9' }}>
                &ldquo;{finding?.findings || 'Non-conformance identified during QC audit'}&rdquo;
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              AUDITEE CORRECTIVE &amp; PREVENTIVE ACTION (CAPA) RESPONSE *
            </label>
            <textarea
              className="modern-input"
              rows={4}
              value={response}
              onChange={e => setResponse(e.target.value)}
              placeholder="Detail the root cause analysis, immediate correction, and preventive procedures implemented..."
              style={{ width: '100%', resize: 'none' }}
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, marginBottom: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                CAPA TRACKING REFERENCE NUMBER
              </label>
              <input
                type="text"
                className="modern-input"
                value={capaRef}
                onChange={e => setCapaRef(e.target.value)}
                placeholder="e.g. CAPA-2026-QC-0089"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                RESPONSE STATUS
              </label>
              <select
                className="modern-input"
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{ width: '100%', fontSize: 12.5 }}
              >
                <option value="Responded">Responded</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !response.trim()}
              className="btn-primary"
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              {submitting ? 'Submitting CAPA...' : '✓ Submit CAPA Response'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
