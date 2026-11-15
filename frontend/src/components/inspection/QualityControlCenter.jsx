import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import ResolveFindingModal from './ResolveFindingModal';
import RaiseDefectModal from './RaiseDefectModal';
import CreateAuditPlanModal from './CreateAuditPlanModal';
import AuditPlanDetailsModal from './AuditPlanDetailsModal';
import SubmitCapaResponseModal from './SubmitCapaResponseModal';

export default function QualityControlCenter() {
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'activities' | 'queries' | 'analytics'

  // Data States
  const [plans, setPlans] = useState([]);
  const [queries, setQueries] = useState([]);
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States for Tab 1 (Audit Plans)
  const [planStudyFilter, setPlanStudyFilter] = useState('All');
  const [planStatusFilter, setPlanStatusFilter] = useState('All');
  const [planSearch, setPlanSearch] = useState('');

  // States for Tab 2 (Monitor Audit Activities & CAPA)
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [activityPlanDetails, setActivityPlanDetails] = useState(null);
  const [activityStatusFilter, setActivityStatusFilter] = useState('All');
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Filter States for Tab 3 (Defect Queries)
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal States
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [inspectingPlanId, setInspectingPlanId] = useState(null);
  const [showRaiseQueryModal, setShowRaiseQueryModal] = useState(false);
  const [resolvingQuery, setResolvingQuery] = useState(null);
  const [activeCapaFinding, setActiveCapaFinding] = useState(null);

  // Load All QC Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, queriesRes, studiesRes] = await Promise.allSettled([
        api.get('/qc/plans'),
        api.get('/qc'),
        api.get('/studies')
      ]);

      const loadedPlans = plansRes.status === 'fulfilled' ? (plansRes.value.data?.plans || []) : [];
      const loadedQueries = queriesRes.status === 'fulfilled' ? (queriesRes.value.data?.queries || []) : [];
      const loadedStudies = studiesRes.status === 'fulfilled' ? (studiesRes.value.data?.studies || []) : [];

      setPlans(loadedPlans);
      setQueries(loadedQueries);
      setStudies(loadedStudies);

      // Default selected plan for Tab 2
      if (loadedPlans.length > 0 && !selectedPlanId) {
        const active = loadedPlans.find(p => p.status === 'Active');
        setSelectedPlanId((active || loadedPlans[0]).id);
      }
    } catch (err) {
      console.error('Failed to load Quality Control Center data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load detailed plan data for Tab 2 when selectedPlanId changes
  const loadSelectedPlanActivity = useCallback(async () => {
    if (!selectedPlanId) {
      setActivityPlanDetails(null);
      return;
    }
    setLoadingActivity(true);
    try {
      const res = await api.get(`/qc/plans/${selectedPlanId}`);
      setActivityPlanDetails(res.data);
    } catch (err) {
      console.error('Failed to load plan activities:', err);
      setActivityPlanDetails(null);
    } finally {
      setLoadingActivity(false);
    }
  }, [selectedPlanId]);

  useEffect(() => {
    if (activeTab === 'activities' && selectedPlanId) {
      loadSelectedPlanActivity();
    }
  }, [activeTab, selectedPlanId, loadSelectedPlanActivity]);

  // KPI Engine Computations
  const activePlansCount = plans.filter(p => p.status === 'Active').length;
  const totalAuditedDocs = plans.reduce((acc, p) => acc + (p.document_count || 0), 0);

  // Gather audited docs from activityPlanDetails or fallback across plans
  const currentPlanDocs = activityPlanDetails?.documents || [];
  const conformantCount = currentPlanDocs.filter(d => d.status === 'Conformant').length;
  const deficientCount = currentPlanDocs.filter(d => d.status === 'Deficient').length;
  const openQueriesCount = queries.filter(q => q.status === 'Open').length;
  const totalDeficiencies = deficientCount + openQueriesCount;

  const totalEvaluated = conformantCount + deficientCount;
  const qcConformityRate = totalEvaluated > 0
    ? Math.round((conformantCount / totalEvaluated) * 100)
    : 100;

  // Tab 1: Filtered Plans
  const filteredPlans = plans.filter(p => {
    if (planStudyFilter !== 'All' && p.study_id !== planStudyFilter) return false;
    if (planStatusFilter !== 'All' && p.status !== planStatusFilter) return false;
    if (planSearch.trim()) {
      const q = planSearch.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchLead = (p.lead_auditor || '').toLowerCase().includes(q);
      const matchStudy = (p.study_id || '').toLowerCase().includes(q);
      if (!matchTitle && !matchLead && !matchStudy) return false;
    }
    return true;
  });

  // Tab 2: Filtered Audited Documents
  const filteredActivities = (activityPlanDetails?.documents || []).filter(d => {
    if (activityStatusFilter === 'All') return true;
    if (activityStatusFilter === 'Responded') return Boolean(d.auditee_response);
    return d.status === activityStatusFilter;
  });

  // Tab 3: Filtered Defect Queries
  const filteredQueries = queries.filter(q => {
    if (severityFilter !== 'All' && q.severity !== severityFilter) return false;
    if (statusFilter !== 'All' && q.status !== statusFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            Quality Control &amp; Compliance Center
          </h1>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Clinevo eTMF 4.3 §11 &amp; §9 — Quality Control, Audit Plans, Auditee CAPA &amp; ALCOA+ Findings
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-primary"
            onClick={() => setShowCreatePlanModal(true)}
            style={{ background: '#0284c7' }}
          >
            + Schedule Audit Plan
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowRaiseQueryModal(true)}
            style={{ background: '#0f172a' }}
          >
            + Raise Defect Query
          </button>
        </div>
      </div>

      {/* Aggregate Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {[
          { label: 'ACTIVE AUDIT PLANS', value: activePlansCount, color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' },
          { label: 'TOTAL AUDITED DOCS', value: totalAuditedDocs, color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },
          { label: 'CONFORMANT DOCUMENTS', value: conformantCount, color: '#059669', bg: '#d1fae5', border: '#a7f3d0' },
          { label: 'OPEN DEFICIENCIES', value: totalDeficiencies, color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
          { label: 'QC CONFORMITY RATE', value: `${qcConformityRate}%`, color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' }
        ].map(kpi => (
          <div
            key={kpi.label}
            style={{
              background: kpi.bg,
              border: `1px solid ${kpi.border}`,
              borderRadius: 10,
              padding: '16px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* 4-Tab Navigation Bar */}
      <div className="glass-panel" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          padding: '0 20px'
        }}>
          {[
            { key: 'plans', label: `1. Audit Plans (§11 a) [${plans.length}]` },
            { key: 'activities', label: '2. Monitor Audit Activities & CAPA (§11 b)' },
            { key: 'queries', label: `3. Defect Queries / ALCOA+ Triage (§9) [${queries.length}]` },
            { key: 'analytics', label: '4. QC Analytics & Metrics (§8.14.15)' }
          ].map(tab => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '14px 20px',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? '#0284c7' : '#64748b',
                borderBottom: activeTab === tab.key ? '3px solid #0284c7' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* Tab 1: Audit Plans */}
        {activeTab === 'plans' && (
          <div style={{ padding: 20 }}>
            {/* Filter Toolbar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <input
                type="text"
                className="modern-input"
                placeholder="Search plans by title, lead auditor, or study..."
                value={planSearch}
                onChange={e => setPlanSearch(e.target.value)}
                style={{ flex: 1, fontSize: 12.5 }}
              />

              <select
                className="modern-input"
                value={planStudyFilter}
                onChange={e => setPlanStudyFilter(e.target.value)}
                style={{ width: 180, fontSize: 12.5 }}
              >
                <option value="All">All Studies</option>
                {studies.map(s => (
                  <option key={s.id} value={s.id}>{s.protocol_number || s.id}</option>
                ))}
              </select>

              <select
                className="modern-input"
                value={planStatusFilter}
                onChange={e => setPlanStatusFilter(e.target.value)}
                style={{ width: 150, fontSize: 12.5 }}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading Audit Plans...</div>
            ) : (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Status</th>
                    <th>Audit Plan Title</th>
                    <th>Protocol / Study</th>
                    <th>Lead Auditor</th>
                    <th>Schedule Horizon</th>
                    <th style={{ width: 110 }}>Audited Docs</th>
                    <th style={{ width: 110 }}>Participants</th>
                    <th style={{ width: 150, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map(plan => (
                    <tr key={plan.id}>
                      <td>
                        <span className={`badge ${
                          plan.status === 'Active' ? 'badge-success' :
                          plan.status === 'Completed' ? 'badge-info' : 'badge-warning'
                        }`}>
                          {plan.status}
                        </span>
                      </td>
                      <td>
                        <div
                          onClick={() => setInspectingPlanId(plan.id)}
                          style={{ fontWeight: 700, color: '#0284c7', cursor: 'pointer' }}
                        >
                          {plan.title}
                        </div>
                        {plan.scope_description && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {plan.scope_description}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>
                        {plan.study_id}
                      </td>
                      <td style={{ fontSize: 12.5, color: '#0f172a' }}>
                        {plan.lead_auditor}
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>
                        {plan.start_date} to {plan.end_date}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          {plan.document_count || 0} Docs
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: 11 }}>
                          {plan.participant_count || 0} Members
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setInspectingPlanId(plan.id)}
                          style={{ fontSize: 11.5, padding: '4px 10px' }}
                        >
                          🔍 Audit Workspace
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPlans.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#94a3b8' }}>
                        No audit plans found matching selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Monitor Audit Activities & CAPA */}
        {activeTab === 'activities' && (
          <div style={{ padding: 20 }}>
            {/* Plan Selector & Filter Ribbon */}
            <div style={{
              display: 'flex',
              gap: 14,
              marginBottom: 16,
              alignItems: 'center',
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  SELECT AUDIT PLAN (§11 b)
                </label>
                <select
                  className="modern-input"
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  style={{ width: '100%', fontSize: 12.5 }}
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.status}] {p.title} ({p.study_id}) — Lead: {p.lead_auditor}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: 200 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  FINDING STATUS
                </label>
                <select
                  className="modern-input"
                  value={activityStatusFilter}
                  onChange={e => setActivityStatusFilter(e.target.value)}
                  style={{ width: '100%', fontSize: 12.5 }}
                >
                  <option value="All">All Audit Findings</option>
                  <option value="Conformant">Conformant Only</option>
                  <option value="Deficient">Deficient (Open)</option>
                  <option value="Responded">Responded / CAPA Logged</option>
                </select>
              </div>
            </div>

            {/* Plan Summary Banner */}
            {activityPlanDetails?.plan && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                    Active Audit Workspace: {activityPlanDetails.plan.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                    Lead Auditor: <strong>{activityPlanDetails.plan.lead_auditor}</strong> • Study: <strong>{activityPlanDetails.plan.study_id}</strong> • Horizon: <strong>{activityPlanDetails.plan.start_date} to {activityPlanDetails.plan.end_date}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setInspectingPlanId(selectedPlanId)}
                  style={{ fontSize: 11, padding: '4px 10px', background: '#fff' }}
                >
                  Full Plan Details ➔
                </button>
              </div>
            )}

            {/* Audited Documents Table */}
            {loadingActivity ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                Loading audited documents &amp; findings...
              </div>
            ) : (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Audited Document Record</th>
                    <th style={{ width: 110 }}>Audit Status</th>
                    <th>Findings / Observations</th>
                    <th>Audited By</th>
                    <th>Auditee CAPA Response</th>
                    <th style={{ width: 150, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {item.document_title || item.document_id}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Artifact: <strong style={{ color: '#0284c7' }}>{item.artifact_code || 'N/A'}</strong> (v{item.document_version || '1.0'})
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          item.status === 'Conformant' ? 'badge-success' :
                          item.status === 'Deficient' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#334155' }}>
                        {item.findings || <span style={{ color: '#059669' }}>Fully conformant / GCP compliant</span>}
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>
                        {item.audited_by || 'QA Lead'}
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          {item.audited_at ? new Date(item.audited_at).toLocaleDateString() : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: '#334155', maxWidth: 220 }}>
                        {item.auditee_response ? (
                          <div>
                            <div>{item.auditee_response}</div>
                            {item.capa_reference && (
                              <div style={{ fontSize: 10.5, color: '#0284c7', fontFamily: 'monospace', marginTop: 2 }}>
                                Ref: {item.capa_reference}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending Response</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.status === 'Deficient' && !item.auditee_response ? (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => setActiveCapaFinding(item)}
                            style={{ fontSize: 11, padding: '4px 8px', background: '#d97706', borderColor: '#d97706' }}
                          >
                            Submit CAPA Response
                          </button>
                        ) : item.auditee_response ? (
                          <span className="badge badge-success" style={{ fontSize: 10 }}>CAPA Logged</span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Conformant</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredActivities.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: '#94a3b8' }}>
                        No audited documents found for this plan matching status criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Defect Queries (Section 9) — Preserved 100% */}
        {activeTab === 'queries' && (
          <div>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 14 }}>
              <select
                className="modern-input"
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                style={{ width: 180, fontSize: 12.5 }}
              >
                <option value="All">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="Major">Major</option>
                <option value="Medium">Medium</option>
                <option value="Minor">Minor</option>
              </select>

              <select
                className="modern-input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 160, fontSize: 12.5 }}
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div style={{ padding: 20 }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading QC records...</div>
              ) : (
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>Severity</th>
                      <th style={{ width: 100 }}>Status</th>
                      <th>Document Record</th>
                      <th>QC Finding / Query Text</th>
                      <th>Logged By</th>
                      <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueries.map(q => (
                      <tr key={q.id}>
                        <td>
                          <span className={`badge ${
                            q.severity === 'Critical' ? 'badge-danger' :
                            q.severity === 'Major' ? 'badge-warning' : 'badge-info'
                          }`}>
                            {q.severity}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${q.status === 'Closed' || q.status === 'Resolved' ? 'badge-success' : 'badge-warning'}`}>
                            {q.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>
                          {q.document_name || 'Document Item'}
                        </td>
                        <td style={{ fontSize: 12.5, color: '#334155' }}>
                          {q.query_text}
                          {q.audit_comments && (
                            <div style={{ fontSize: 11, color: '#059669', fontStyle: 'italic', marginTop: 4 }}>
                              Resolution: {q.audit_comments}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>
                          {q.created_by_name || 'QA Reviewer'}
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            {new Date(q.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {q.status === 'Open' ? (
                            <button
                              className="btn-primary"
                              onClick={() => setResolvingQuery(q)}
                              style={{ fontSize: 11, padding: '4px 10px', background: '#059669', borderColor: '#059669' }}
                            >
                              ✓ Resolve
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredQueries.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                          No QC queries match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: QC Analytics & Metrics (§8.14.15) */}
        {activeTab === 'analytics' && (
          <div style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>
              Quality Control Visual Analytics (§8.14.15 &amp; §11)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* QC Conformity Rate Chart */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 24,
                textAlign: 'center'
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 16px 0' }}>
                  Audited Document Conformity Rate
                </h4>
                <div style={{
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background: `conic-gradient(#10b981 0% ${qcConformityRate}%, #ef4444 ${qcConformityRate}% 100%)`,
                  margin: '0 auto 16px auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {qcConformityRate}% Conformant
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Green: {conformantCount} Conformant • Red: {deficientCount} Deficient
                </div>
              </div>

              {/* Defect Severity Breakdown */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 24
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 16px 0' }}>
                  Defect Severity Distribution (§9)
                </h4>

                {[
                  { level: 'Critical', color: '#dc2626', count: queries.filter(q => q.severity === 'Critical').length },
                  { level: 'Major', color: '#d97706', count: queries.filter(q => q.severity === 'Major').length },
                  { level: 'Medium', color: '#2563eb', count: queries.filter(q => q.severity === 'Medium').length },
                  { level: 'Minor', color: '#059669', count: queries.filter(q => q.severity === 'Minor').length }
                ].map(item => {
                  const pct = queries.length > 0 ? Math.round((item.count / queries.length) * 100) : 0;
                  return (
                    <div key={item.level} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        <span style={{ color: item.color }}>{item.level} Severity</span>
                        <span style={{ color: '#0f172a' }}>{item.count} queries ({pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit Plans Overview Table in Analytics */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
                Quality Audit Program Progress Summary
              </h4>
              <div style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-around',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{plans.length}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>TOTAL AUDIT PLANS</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{activePlansCount}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>ACTIVE WORKSPACES</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{totalAuditedDocs}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>AUDITED DOCUMENTS</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>
                    {plans.filter(p => p.status === 'Completed').length}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>COMPLETED AUDITS</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Audit Plan Modal */}
      {showCreatePlanModal && (
        <CreateAuditPlanModal
          onClose={() => setShowCreatePlanModal(false)}
          onCreated={() => {
            setShowCreatePlanModal(false);
            loadData();
          }}
        />
      )}

      {/* MODAL 2: Audit Plan Details Modal */}
      {inspectingPlanId && (
        <AuditPlanDetailsModal
          planId={inspectingPlanId}
          onClose={() => setInspectingPlanId(null)}
          onRefresh={() => {
            loadData();
            if (selectedPlanId === inspectingPlanId) {
              loadSelectedPlanActivity();
            }
          }}
        />
      )}

      {/* MODAL 3: Submit CAPA Response Modal (triggered from Tab 2) */}
      {activeCapaFinding && (
        <SubmitCapaResponseModal
          planId={selectedPlanId}
          finding={activeCapaFinding}
          onClose={() => setActiveCapaFinding(null)}
          onSubmitted={() => {
            setActiveCapaFinding(null);
            loadSelectedPlanActivity();
            loadData();
          }}
        />
      )}

      {/* MODAL 4: Resolve Finding Modal (Preserved from Section 9) */}
      {resolvingQuery && (
        <ResolveFindingModal
          query={resolvingQuery}
          onClose={() => setResolvingQuery(null)}
          onResolved={() => {
            setResolvingQuery(null);
            loadData();
          }}
        />
      )}

      {/* MODAL 5: Raise Defect Modal (Preserved from Section 9) */}
      {showRaiseQueryModal && (
        <RaiseDefectModal
          onClose={() => setShowRaiseQueryModal(false)}
          onCreated={() => {
            setShowRaiseQueryModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
