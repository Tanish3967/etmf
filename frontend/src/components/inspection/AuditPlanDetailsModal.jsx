import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import SubmitCapaResponseModal from './SubmitCapaResponseModal';

export default function AuditPlanDetailsModal({ planId, onClose, onRefresh }) {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'participants' | 'documents' | 'responses'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // New Participant Form
  const [newParticipant, setNewParticipant] = useState({
    user_name: '',
    role: 'Auditor'
  });
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [participantError, setParticipantError] = useState('');

  // Active CAPA response target
  const [activeCapaFinding, setActiveCapaFinding] = useState(null);

  const loadPlanDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/qc/plans/${planId}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit plan details.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadPlanDetails();
  }, [loadPlanDetails]);

  const handleUpdateStatus = async (newStatus) => {
    setStatusUpdating(true);
    try {
      await api.patch(`/qc/plans/${planId}`, { status: newStatus });
      await loadPlanDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update plan status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    if (!newParticipant.user_name.trim()) {
      setParticipantError('Participant name or user ID is required.');
      return;
    }

    setAddingParticipant(true);
    setParticipantError('');

    try {
      await api.post(`/qc/plans/${planId}/participants`, {
        user_name: newParticipant.user_name.trim(),
        role: newParticipant.role,
        notification_sent: true
      });
      setNewParticipant({ user_name: '', role: 'Auditor' });
      await loadPlanDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'DUPLICATE_PARTICIPANT') {
        setParticipantError(`Participant is already assigned with role ${newParticipant.role} for this plan.`);
      } else {
        setParticipantError(err.response?.data?.error || 'Failed to assign participant.');
      }
    } finally {
      setAddingParticipant(false);
    }
  };

  const plan = data?.plan;
  const participants = data?.participants || [];
  const documents = data?.documents || [];
  const responses = data?.responses || [];

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
          width: 820,
          maxWidth: '92vw',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {plan?.title || 'Audit Plan Workspace'}
              </h3>
              {plan?.status && (
                <span className={`badge ${
                  plan.status === 'Active' ? 'badge-success' :
                  plan.status === 'Completed' ? 'badge-info' : 'badge-warning'
                }`}>
                  {plan.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>
              Protocol: <strong style={{ color: '#38bdf8' }}>{plan?.study_id || 'N/A'}</strong> • Lead Auditor: <strong>{plan?.lead_auditor || 'N/A'}</strong>
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Sub-Tabs Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          padding: '0 24px'
        }}>
          {[
            { key: 'overview', label: 'Overview & Scope' },
            { key: 'participants', label: `Participants (${participants.length})` },
            { key: 'documents', label: `Audited Documents (${documents.length})` },
            { key: 'responses', label: `CAPA Responses (${responses.length})` }
          ].map(tab => (
            <div
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              style={{
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: activeSubTab === tab.key ? 700 : 500,
                color: activeSubTab === tab.key ? '#0284c7' : '#64748b',
                borderBottom: activeSubTab === tab.key ? '3px solid #0284c7' : '3px solid transparent',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* Body Area */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              Loading audit plan workspace...
            </div>
          ) : error ? (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: 16, borderRadius: 8 }}>
              {error}
            </div>
          ) : (
            <>
              {/* SUB-TAB 1: OVERVIEW */}
              {activeSubTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    background: '#f8fafc',
                    padding: 16,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>SCHEDULE HORIZON</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                        {plan?.start_date} to {plan?.end_date}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>LEAD AUDITOR</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                        {plan?.lead_auditor}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>TOTAL DOCUMENTS AUDITED</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                        {documents.length} Records
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>PARTICIPATING MEMBERS</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                        {participants.length} Active Members
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      SCOPE DESCRIPTION &amp; REGULATORY TARGETS (§11 a)
                    </div>
                    <div style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: 14,
                      fontSize: 13,
                      color: '#334155',
                      lineHeight: 1.5
                    }}>
                      {plan?.scope_description || 'No specific scope limitations specified; audit encompasses all active trial binders.'}
                    </div>
                  </div>

                  {/* Plan Lifecycle Management */}
                  <div style={{
                    background: '#f1f5f9',
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Plan Status Lifecycle</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Transition plan status across audit lifecycle stages</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {plan?.status !== 'Active' && (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={statusUpdating}
                          onClick={() => handleUpdateStatus('Active')}
                          style={{ fontSize: 11.5, padding: '5px 12px', background: '#059669', borderColor: '#059669' }}
                        >
                          Activate Plan
                        </button>
                      )}
                      {plan?.status !== 'Completed' && (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={statusUpdating}
                          onClick={() => handleUpdateStatus('Completed')}
                          style={{ fontSize: 11.5, padding: '5px 12px', background: '#4338ca', borderColor: '#4338ca' }}
                        >
                          Mark Completed
                        </button>
                      )}
                      {plan?.status !== 'Draft' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={statusUpdating}
                          onClick={() => handleUpdateStatus('Draft')}
                          style={{ fontSize: 11.5, padding: '5px 12px' }}
                        >
                          Set to Draft
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: PARTICIPANTS */}
              {activeSubTab === 'participants' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {/* Add Participant Form */}
                  <form onSubmit={handleAddParticipant} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                      + Assign New Audit Participant (§11 a)
                    </div>

                    {participantError && (
                      <div style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        marginBottom: 10
                      }}>
                        {participantError}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                          USER NAME / EMAIL *
                        </label>
                        <input
                          type="text"
                          className="modern-input"
                          placeholder="e.g. Lead Monitor David Miller"
                          value={newParticipant.user_name}
                          onChange={e => setNewParticipant(p => ({ ...p, user_name: e.target.value }))}
                          style={{ width: '100%', fontSize: 12.5 }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                          AUDIT ROLE *
                        </label>
                        <select
                          className="modern-input"
                          value={newParticipant.role}
                          onChange={e => setNewParticipant(p => ({ ...p, role: e.target.value }))}
                          style={{ width: '100%', fontSize: 12.5 }}
                        >
                          <option value="Auditor">Auditor</option>
                          <option value="Auditee">Auditee</option>
                          <option value="Lead Auditor">Lead Auditor</option>
                          <option value="Observer">Observer</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={addingParticipant}
                        className="btn-primary"
                        style={{ fontSize: 12, padding: '8px 14px', background: '#0284c7' }}
                      >
                        {addingParticipant ? 'Assigning...' : 'Assign Participant'}
                      </button>
                    </div>
                  </form>

                  {/* Participants Table */}
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Participant Name</th>
                        <th>Assigned Role</th>
                        <th>Assigned Date</th>
                        <th>Notification Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map(part => (
                        <tr key={part.id}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{part.user_name}</td>
                          <td>
                            <span className={`badge ${
                              part.role === 'Lead Auditor' ? 'badge-primary' :
                              part.role === 'Auditee' ? 'badge-warning' : 'badge-info'
                            }`}>
                              {part.role}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>
                            {part.assigned_at ? new Date(part.assigned_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td>
                            <span className="badge badge-success">
                              {part.notification_sent ? '✓ Notified' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {participants.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                            No participants assigned yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUB-TAB 3: AUDITED DOCUMENTS */}
              {activeSubTab === 'documents' && (
                <div>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Document Title</th>
                        <th style={{ width: 100 }}>Status</th>
                        <th>Findings / Observations</th>
                        <th>Auditor</th>
                        <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map(docItem => (
                        <tr key={docItem.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {docItem.document_title || docItem.document_id}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              Artifact: <strong style={{ color: '#0284c7' }}>{docItem.artifact_code || 'N/A'}</strong> (v{docItem.document_version || '1.0'})
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${
                              docItem.status === 'Conformant' ? 'badge-success' :
                              docItem.status === 'Deficient' ? 'badge-danger' : 'badge-warning'
                            }`}>
                              {docItem.status}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: '#334155' }}>
                            {docItem.findings || <span style={{ color: '#059669' }}>Fully conformant</span>}
                            {docItem.auditee_response && (
                              <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
                                <strong>CAPA:</strong> {docItem.auditee_response}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>
                            {docItem.audited_by || 'QA Lead'}
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                              {docItem.audited_at ? new Date(docItem.audited_at).toLocaleDateString() : ''}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {docItem.status === 'Deficient' && !docItem.auditee_response ? (
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => setActiveCapaFinding(docItem)}
                                style={{ fontSize: 11, padding: '4px 8px', background: '#d97706', borderColor: '#d97706' }}
                              >
                                Submit CAPA
                              </button>
                            ) : docItem.auditee_response ? (
                              <span className="badge badge-success" style={{ fontSize: 10 }}>CAPA Logged</span>
                            ) : (
                              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Conformant</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {documents.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                            No documents have been quality checked under this audit plan yet.<br />
                            Use the document context menu <em>&ldquo;Quality Check (Audit Plan)&rdquo;</em> to audit documents.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUB-TAB 4: CAPA RESPONSES */}
              {activeSubTab === 'responses' && (
                <div>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Document &amp; Finding</th>
                        <th>Auditee Response</th>
                        <th>CAPA Reference</th>
                        <th>Responded By</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responses.map(resp => (
                        <tr key={resp.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {resp.document_title || resp.document_id || 'Document Item'}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b' }}>
                              Finding Ref: {resp.finding_id ? resp.finding_id.slice(0, 8) : 'QC-FINDING'}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: '#334155', maxWidth: 260 }}>
                            {resp.auditee_response}
                          </td>
                          <td>
                            {resp.capa_reference ? (
                              <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>
                                {resp.capa_reference}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 11 }}>N/A</span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>
                            {resp.responded_by_name || resp.responded_by || 'Auditee'}
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                              {resp.responded_at ? new Date(resp.responded_at).toLocaleDateString() : ''}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-success">
                              {resp.status || 'Submitted'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {responses.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                            No CAPA responses have been logged for this plan yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close Workspace
          </button>
        </div>
      </div>

      {/* Embedded Submit CAPA Response Modal */}
      {activeCapaFinding && (
        <SubmitCapaResponseModal
          planId={planId}
          finding={activeCapaFinding}
          onClose={() => setActiveCapaFinding(null)}
          onSubmitted={() => {
            setActiveCapaFinding(null);
            loadPlanDetails();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
