import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function MyTasksWorkspace({
  user,
  onViewDocument,
  onAdvanceWorkflow,
  onSignDocument,
  onRaiseQuery
}) {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'expiry' | 'queries'
  const [tasks, setTasks] = useState([]);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expiryHorizon, setExpiryHorizon] = useState(90);

  useEffect(() => {
    loadTasksData();
  }, []);

  const loadTasksData = async () => {
    setLoading(true);
    try {
      const [taskRes, qcRes] = await Promise.all([
        api.get('/workflow/tasks'),
        api.get('/qc')
      ]);

      setTasks(taskRes.data.tasks || []);
      setExpiringDocs(taskRes.data.expiring || []);
      setQueries(qcRes.data.queries || []);
    } catch (err) {
      console.error('Error loading task workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const overdueCount = tasks.filter(t => t.slaLevel === 'red').length;
  const atRiskCount = tasks.filter(t => t.slaLevel === 'amber').length;
  const onTrackCount = tasks.filter(t => t.slaLevel === 'green').length;
  const openQueriesCount = queries.filter(q => q.status === 'Open').length;

  const filteredExpiring = expiringDocs.filter(d => (d.days_left || 90) <= expiryHorizon);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            My Tasks &amp; SLA Reminders
          </h1>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Clinevo eTMF 4.3 §8.2 &amp; §8.3 — Workflow Progression, Due Dates &amp; Compliance Horizons
          </div>
        </div>
        <button
          className="btn-secondary"
          onClick={loadTasksData}
          style={{ fontSize: 12, padding: '6px 14px' }}
        >
          🔄 Refresh Tasks
        </button>
      </div>

      {/* SLA Metric Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'OVERDUE (RED SLA)', value: overdueCount, color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: '🚨' },
          { label: 'AT RISK (AMBER SLA)', value: atRiskCount, color: '#d97706', bg: '#fef3c7', border: '#fde68a', icon: '⏳' },
          { label: 'ON TRACK (GREEN SLA)', value: onTrackCount, color: '#059669', bg: '#d1fae5', border: '#a7f3d0', icon: '🟢' },
          { label: 'PENDING QUERIES', value: openQueriesCount, color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd', icon: '💬' }
        ].map(kpi => (
          <div
            key={kpi.label}
            style={{
              background: kpi.bg,
              border: `1px solid ${kpi.border}`,
              borderRadius: 10,
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>
                {kpi.value}
              </div>
            </div>
            <span style={{ fontSize: 24 }}>{kpi.icon}</span>
          </div>
        ))}
      </div>

      {/* Interactive Tabs Panel */}
      <div className="glass-panel" style={{ background: '#fff', overflow: 'hidden' }}>
        {/* Tab Buttons */}
        <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', padding: '0 16px', background: '#f8fafc' }}>
          {[
            { id: 'documents', label: `Assigned Documents (${tasks.length})`, icon: '📄' },
            { id: 'expiry', label: `Expiring Documents (${filteredExpiring.length})`, icon: '📅' },
            { id: 'queries', label: `My Queries (${openQueriesCount})`, icon: '🔍' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 20px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? '#0284c7' : '#64748b',
                borderBottom: activeTab === tab.id ? '3px solid #0284c7' : '3px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Documents Tab */}
        {activeTab === 'documents' && (
          <div style={{ padding: 20 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading assigned tasks...</div>
            ) : (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>SLA Status</th>
                    <th style={{ width: 140 }}>Document ID</th>
                    <th>Document Name</th>
                    <th>Assigned Role</th>
                    <th>Workflow Status</th>
                    <th>Age</th>
                    <th style={{ textAlign: 'right', minWidth: 220 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id}>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: t.slaLevel === 'red' ? '#fee2e2' : t.slaLevel === 'amber' ? '#fef3c7' : '#d1fae5',
                          color: t.slaLevel === 'red' ? '#b91c1c' : t.slaLevel === 'amber' ? '#b45309' : '#047857',
                          border: `1px solid ${t.slaLevel === 'red' ? '#fca5a5' : t.slaLevel === 'amber' ? '#fde68a' : '#a7f3d0'}`
                        }}>
                          {t.slaLevel === 'red' ? '● OVERDUE' : t.slaLevel === 'amber' ? '● AT RISK' : '● ON TRACK'}
                        </span>
                      </td>
                      <td style={{ color: '#0ea5e9', fontWeight: 700 }}>
                        {t.artifact_code || t.id}
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.title}</td>
                      <td>
                        <span className="badge badge-info">{t.task_type?.toUpperCase()}</span>
                      </td>
                      <td>
                        <span className={`badge ${t.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>
                        {t.age_days || 0}d / {t.slaLimit || 5}d
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => onViewDocument(t)}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            title="Preview Document"
                          >
                            👁️ View
                          </button>
                          {t.status === 'Review Complete' || t.status === 'Pending Approval' ? (
                            <button
                              className="btn-primary"
                              onClick={() => onSignDocument(t)}
                              style={{ fontSize: 11, padding: '4px 8px', background: '#0284c7' }}
                              title="21 CFR Part 11 Electronic Signature"
                            >
                              ✍️ Sign
                            </button>
                          ) : (
                            <button
                              className="btn-primary"
                              onClick={() => onAdvanceWorkflow(t)}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              title="Advance Workflow Stage"
                            >
                              ⚡ Advance
                            </button>
                          )}
                          <button
                            className="btn-secondary"
                            onClick={() => onRaiseQuery(t)}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            title="Raise Query"
                          >
                            💬
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                        🎉 All assigned clinical trial documents are up to date! No pending review or approval tasks.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Expiry Documents Tab */}
        {activeTab === 'expiry' && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>EXPIRATION HORIZON:</span>
              {[30, 60, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setExpiryHorizon(days)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    background: expiryHorizon === days ? '#0284c7' : '#f1f5f9',
                    color: expiryHorizon === days ? '#fff' : '#475569',
                    border: 'none',
                    fontWeight: 600
                  }}
                >
                  {days} Days
                </button>
              ))}
            </div>

            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Days Left</th>
                  <th style={{ width: 140 }}>Artifact Code</th>
                  <th>Document Title</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpiring.map(d => (
                  <tr key={d.id}>
                    <td>
                      <span className={`badge ${d.days_left <= 30 ? 'badge-danger' : 'badge-warning'}`}>
                        {d.days_left} Days
                      </span>
                    </td>
                    <td style={{ color: '#0ea5e9', fontWeight: 700 }}>{d.artifact_code || d.id}</td>
                    <td style={{ fontWeight: 600 }}>{d.title}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{d.expiry_date}</td>
                    <td><span className="badge badge-success">{d.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => onViewDocument(d)}
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        Re-Certify / Renew
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredExpiring.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No documents expiring within the {expiryHorizon}-day horizon.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Queries Tab */}
        {activeTab === 'queries' && (
          <div style={{ padding: 20 }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Severity</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th>Document Name</th>
                  <th>Query Description</th>
                  <th>Logged Date</th>
                </tr>
              </thead>
              <tbody>
                {queries.map(q => (
                  <tr key={q.id}>
                    <td>
                      <span className={`badge ${q.severity === 'Critical' ? 'badge-danger' : q.severity === 'Major' ? 'badge-warning' : 'badge-info'}`}>
                        {q.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${q.status === 'Closed' ? 'badge-success' : 'badge-warning'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{q.document_name || 'Document Item'}</td>
                    <td style={{ fontSize: 12.5, color: '#334155' }}>{q.query_text}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(q.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {queries.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No queries raised against your documents.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
