import React, { useState } from 'react';
import api from '../../api';

export const WF_TRANSITIONS = {
  'Draft': ['Pending Review'],
  'Pending Review': ['Review Complete', 'More Info Requested', 'Rejected'],
  'More Info Requested': ['Pending Review'],
  'Review Complete': ['Pending Approval'],
  'Pending Approval': ['Approved', 'Rejected'],
  'Rejected': ['Draft'],
  'Approved': ['Superseded'],
  'Published': ['Superseded']
};

export const SLA_MAP = {
  'Pending Review': '5 Working Days (QC Review)',
  'Review Complete': '2 Working Days',
  'Pending Approval': '3 Working Days (Signoff)',
  'More Info Requested': '5 Working Days'
};

export default function WorkflowAdvanceModal({ doc, user, onClose, onAdvanced, onRequireESig }) {
  const currentStatus = doc?.status || 'Draft';
  const allowedNext = WF_TRANSITIONS[currentStatus] || ['Draft'];
  const [selectedNext, setSelectedNext] = useState(allowedNext[0] || '');
  const [comment, setComment] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');

  const handleAdvance = async (e) => {
    e.preventDefault();
    if (!selectedNext) return;

    // If next state is Approved, route to Part 11 Electronic Signature dialog
    if (selectedNext === 'Approved') {
      onClose();
      if (onRequireESig) onRequireESig(doc);
      return;
    }

    setAdvancing(true);
    setError('');

    try {
      const res = await api.post(`/workflow/${doc.id}/transition`, {
        nextState: selectedNext,
        comment: comment.trim() || `Workflow transitioned to ${selectedNext}`
      });

      alert(`Workflow advanced successfully!\nNew Status: ${res.data.document?.status || selectedNext}`);
      if (onAdvanced) onAdvanced(res.data.document);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to advance document workflow.');
    } finally {
      setAdvancing(false);
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
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 500,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              ⚡ Advance Document Workflow
            </h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Clinevo eTMF 4.3 §8.11 — State Machine Lifecycle
            </div>
          </div>
          <span style={{ fontSize: 18, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Body */}
        <form onSubmit={handleAdvance} style={{ padding: 20 }}>
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

          {/* Current Status Box */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CURRENT STATE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{doc?.title || 'Document Record'}</div>
            </div>
            <span className="badge badge-warning" style={{ fontSize: 13, padding: '4px 10px' }}>
              {currentStatus}
            </span>
          </div>

          {/* Next State Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              TARGET WORKFLOW STATE *
            </label>
            <select
              className="modern-input"
              value={selectedNext}
              onChange={e => setSelectedNext(e.target.value)}
              style={{ width: '100%', fontSize: 13 }}
            >
              {allowedNext.map(st => (
                <option key={st} value={st}>
                  ➔ {st} {st === 'Approved' ? '(Requires 21 CFR Part 11 e-Sign)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* SLA Indicator */}
          {SLA_MAP[selectedNext] && (
            <div style={{
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 11.5,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>⏱️</span>
              <span>Target Turnaround SLA: <strong>{SLA_MAP[selectedNext]}</strong></span>
            </div>
          )}

          {/* Transition Comment */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              TRANSITION AUDIT COMMENT
            </label>
            <textarea
              className="modern-input"
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Provide context for this workflow transition (stored permanently in ALCOA+ audit log)"
              style={{ width: '100%', resize: 'none' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={advancing || !selectedNext}
              className="btn-primary"
              style={{ background: selectedNext === 'Approved' ? '#059669' : '#0284c7' }}
            >
              {selectedNext === 'Approved' ? 'Proceed to Electronic Signature ➔' : (advancing ? 'Advancing...' : 'Advance Workflow')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
