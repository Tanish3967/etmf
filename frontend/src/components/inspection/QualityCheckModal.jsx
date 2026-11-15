import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function QualityCheckModal({ doc, user, onClose, onChecked }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [status, setStatus] = useState('Conformant');
  const [findings, setFindings] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDuplicateAudit, setIsDuplicateAudit] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadPlans() {
      setLoadingPlans(true);
      try {
        const res = await api.get('/qc/plans');
        if (!active) return;
        const allPlans = res.data?.plans || [];
        setPlans(allPlans);

        // Prefer active plans first
        const activePlans = allPlans.filter(p => p.status === 'Active');
        if (activePlans.length > 0) {
          setSelectedPlanId(activePlans[0].id);
        } else if (allPlans.length > 0) {
          setSelectedPlanId(allPlans[0].id);
        }
      } catch (err) {
        if (active) {
          setError(err.response?.data?.error || 'Failed to load active audit plans.');
        }
      } finally {
        if (active) setLoadingPlans(false);
      }
    }
    loadPlans();
    return () => {
      active = false;
    };
  }, []);

  const handleRecordQC = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) {
      setError('An Audit Plan must be selected to perform a formal quality check (§11.4.4).');
      return;
    }
    if (status === 'Deficient' && !findings.trim()) {
      setError('Findings / observations are mandatory when designating a document as Deficient.');
      return;
    }

    setSubmitting(true);
    setError('');
    setIsDuplicateAudit(false);

    try {
      const res = await api.post('/qc/check', {
        plan_id: selectedPlanId,
        document_id: doc.id,
        status,
        findings: findings.trim()
      });

      if (onChecked) {
        onChecked(res.data.audit_record);
      }
      onClose();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'DUPLICATE_AUDIT') {
        setIsDuplicateAudit(true);
        setError('⚠️ DUPLICATE AUDIT BLOCKED: This document has already been audited under the selected plan. Under Clinevo §11.4.4 & 21 CFR Part 11, each document can only be audited once per audit plan.');
      } else {
        setError(err.response?.data?.error || 'Failed to record document quality check.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

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
              fontSize: 18
            }}>
              ✅
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Document Quality Check &amp; Audit Plan Binding
              </h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Clinevo eTMF 4.3 §8.10.17 &amp; §11.4.4 — GCP / ALCOA+ Audit Log Binding
              </div>
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Body */}
        <form onSubmit={handleRecordQC} style={{ padding: 24 }}>
          {/* Duplicate Audit or Error Banner */}
          {error && (
            <div style={{
              background: isDuplicateAudit ? '#fffbeb' : '#fee2e2',
              color: isDuplicateAudit ? '#b45309' : '#dc2626',
              border: `1px solid ${isDuplicateAudit ? '#fde68a' : '#fca5a5'}`,
              padding: '12px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              marginBottom: 16,
              lineHeight: 1.4
            }}>
              {error}
            </div>
          )}

          {/* Document Summary Card */}
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
              <span style={{ fontWeight: 600, color: '#0ea5e9' }}>
                {doc?.artifact_code || 'N/A'} (v{doc?.version || '1.0'})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Auditor Identity:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                {user?.name || user?.username || 'Lead Auditor'}
              </span>
            </div>
          </div>

          {/* Plan Selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              TARGET QUALITY AUDIT PLAN (§11 a) *
            </label>
            {loadingPlans ? (
              <div style={{ fontSize: 12, color: '#64748b', padding: 8 }}>Loading available audit plans...</div>
            ) : plans.length > 0 ? (
              <>
                <select
                  className="modern-input"
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  style={{ width: '100%', fontSize: 12.5 }}
                  required
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.status}] {p.title} ({p.study_id}) — Lead: {p.lead_auditor}
                    </option>
                  ))}
                </select>
                {selectedPlan && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Schedule: {selectedPlan.start_date} to {selectedPlan.end_date} • {selectedPlan.document_count || 0} docs previously audited
                  </div>
                )}
              </>
            ) : (
              <div style={{
                background: '#fffbeb',
                color: '#b45309',
                border: '1px solid #fde68a',
                padding: '10px 12px',
                borderRadius: 6,
                fontSize: 12
              }}>
                No active audit plans found for this study. Please schedule an audit plan in the Quality Control Center first.
              </div>
            )}
          </div>

          {/* Conformity Status Radio Group */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              QUALITY CONFORMITY OUTCOME *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div
                onClick={() => setStatus('Conformant')}
                style={{
                  border: status === 'Conformant' ? '2px solid #059669' : '1px solid #e2e8f0',
                  background: status === 'Conformant' ? '#f0fdf4' : '#fff',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'Conformant'}
                    onChange={() => setStatus('Conformant')}
                    style={{ cursor: 'pointer' }}
                  />
                  <strong style={{ color: '#059669', fontSize: 13 }}>Conformant</strong>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  Adheres to GCP, ALCOA+, and completeness requirements.
                </div>
              </div>

              <div
                onClick={() => setStatus('Deficient')}
                style={{
                  border: status === 'Deficient' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                  background: status === 'Deficient' ? '#fef2f2' : '#fff',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'Deficient'}
                    onChange={() => setStatus('Deficient')}
                    style={{ cursor: 'pointer' }}
                  />
                  <strong style={{ color: '#dc2626', fontSize: 13 }}>Deficient</strong>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  Non-conformances identified requiring auditee CAPA.
                </div>
              </div>
            </div>
          </div>

          {/* Findings Textarea */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              FINDINGS / AUDIT OBSERVATIONS {status === 'Deficient' ? '*' : '(OPTIONAL)'}
            </label>
            <textarea
              className="modern-input"
              rows={3}
              value={findings}
              onChange={e => setFindings(e.target.value)}
              placeholder={status === 'Deficient'
                ? "Describe identified deficiencies (e.g. Missing signature on protocol amendment, version mismatch in footer)..."
                : "Enter optional verification remarks (e.g. All signatures verified, scanned resolution meets ALCOA+)..."
              }
              style={{ width: '100%', resize: 'none' }}
              required={status === 'Deficient'}
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              Note: Once audited under this plan, this document will be locked against deletion or inactivation (§11.4.3).
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPlanId || (status === 'Deficient' && !findings.trim())}
              className="btn-primary"
              style={{
                background: status === 'Deficient' ? '#dc2626' : '#059669',
                borderColor: status === 'Deficient' ? '#dc2626' : '#059669'
              }}
            >
              {submitting ? 'Recording Audit Check...' : `✓ Record ${status} Quality Check`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
