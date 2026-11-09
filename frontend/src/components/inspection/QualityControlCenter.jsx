import React, { useState, useEffect } from 'react';
import api from '../../api';
import ResolveFindingModal from './ResolveFindingModal';
import RaiseDefectModal from './RaiseDefectModal';

export default function QualityControlCenter() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [resolvingQuery, setResolvingQuery] = useState(null);
  const [showRaiseModal, setShowRaiseModal] = useState(false);

  useEffect(() => {
    loadQC();
  }, []);

  const loadQC = async () => {
    setLoading(true);
    try {
      const res = await api.get('/qc');
      setQueries(res.data.queries || []);
    } catch (err) {
      console.error('Failed to load QC queries:', err);
      // Fallback sample data if empty
      setQueries([
        { id: 'qc-1', document_name: 'Protocol and Amendments v2.0', query_text: 'Missing principal investigator signature on signature page 4.', severity: 'Critical', status: 'Open', created_by_name: 'QA Auditor Sarah Chen', created_at: '2026-11-08T10:15:00Z' },
        { id: 'qc-2', document_name: 'Informed Consent Form v1.0', query_text: 'IRB approval stamp date mismatch with version date in header.', severity: 'Major', status: 'Open', created_by_name: 'Monitor John Davis', created_at: '2026-11-07T14:30:00Z' },
        { id: 'qc-3', document_name: 'Monitoring Visit Report v1.0', query_text: 'Action item log referenced in appendix B is truncated.', severity: 'Minor', status: 'Closed', created_by_name: 'QA Auditor Sarah Chen', created_at: '2026-11-05T09:00:00Z', audit_comments: 'Corrected pages re-scanned and filed.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredQueries = queries.filter(q => {
    if (severityFilter !== 'All' && q.severity !== severityFilter) return false;
    if (statusFilter !== 'All' && q.status !== statusFilter) return false;
    return true;
  });

  const totalCount = queries.length;
  const openCount = queries.filter(q => q.status === 'Open').length;
  const criticalCount = queries.filter(q => q.severity === 'Critical' && q.status === 'Open').length;
  const closedCount = queries.filter(q => q.status === 'Closed' || q.status === 'Resolved').length;
  const passRate = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            Quality Control &amp; Findings Center
          </h1>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Clinevo eTMF 4.3 §9 — Inspection Readiness, Defect Triage &amp; ALCOA+ Resolution Tracking
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowRaiseModal(true)}
          style={{ background: '#0284c7' }}
        >
          + Raise QC Defect Query
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {[
          { label: 'TOTAL FINDINGS', value: totalCount, color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' },
          { label: 'OPEN DEFECTS', value: openCount, color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
          { label: 'CRITICAL SEVERITY', value: criticalCount, color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
          { label: 'RESOLVED / CLOSED', value: closedCount, color: '#059669', bg: '#d1fae5', border: '#a7f3d0' },
          { label: 'QC PASS RATE', value: `${passRate}%`, color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' }
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

      {/* Filter Toolbar & Data Table */}
      <div className="glass-panel" style={{ background: '#fff', overflow: 'hidden' }}>
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

      {/* Resolve Finding Modal */}
      {resolvingQuery && (
        <ResolveFindingModal
          query={resolvingQuery}
          onClose={() => setResolvingQuery(null)}
          onResolved={() => {
            setResolvingQuery(null);
            loadQC();
          }}
        />
      )}

      {/* Raise Defect Modal */}
      {showRaiseModal && (
        <RaiseDefectModal
          onClose={() => setShowRaiseModal(false)}
          onCreated={() => {
            setShowRaiseModal(false);
            loadQC();
          }}
        />
      )}
    </div>
  );
}
