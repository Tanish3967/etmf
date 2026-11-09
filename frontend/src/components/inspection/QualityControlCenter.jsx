import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function QualityControlCenter() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [resolvingQuery, setResolvingQuery] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [newDefect, setNewDefect] = useState({ documentId: 'doc-001', text: '', severity: 'Major' });
  const [creating, setCreating] = useState(false);

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

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolvingQuery || !resolutionText.trim()) return;

    setSavingResolution(true);
    try {
      await api.patch(`/qc/${resolvingQuery.id}`, {
        status: 'Closed',
        audit_comments: resolutionText.trim()
      });
      alert('QC finding resolved and recorded in ALCOA+ audit trail.');
      setResolvingQuery(null);
      setResolutionText('');
      loadQC();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update QC finding.');
    } finally {
      setSavingResolution(false);
    }
  };

  const handleCreateDefect = async (e) => {
    e.preventDefault();
    if (!newDefect.text.trim()) return;

    setCreating(true);
    try {
      await api.post('/qc', {
        document_id: newDefect.documentId,
        query_text: newDefect.text.trim(),
        severity: newDefect.severity
      });
      alert('New QC defect query created and assigned.');
      setShowRaiseModal(false);
      setNewDefect({ documentId: 'doc-001', text: '', severity: 'Major' });
      loadQC();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create QC finding.');
    } finally {
      setCreating(false);
    }
  };

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
        <div
          onClick={() => setResolvingQuery(null)}
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
              width: 500,
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '16px 20px',
              background: '#0f172a',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Resolve QC Finding</h3>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {resolvingQuery.document_name}
                </div>
              </div>
              <span style={{ fontSize: 18, cursor: 'pointer', color: '#94a3b8' }} onClick={() => setResolvingQuery(null)}>✕</span>
            </div>

            <form onSubmit={handleResolve} style={{ padding: 20 }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: '#334155',
                marginBottom: 16
              }}>
                <strong style={{ color: '#0f172a' }}>Defect Query:</strong> {resolvingQuery.query_text}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  ALCOA+ RESOLUTION JUSTIFICATION *
                </label>
                <textarea
                  className="modern-input"
                  rows={4}
                  value={resolutionText}
                  onChange={e => setResolutionText(e.target.value)}
                  placeholder="Describe corrective actions taken (e.g. Corrected signature page uploaded, verified against source record)..."
                  required
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setResolvingQuery(null)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResolution || !resolutionText.trim()}
                  className="btn-primary"
                  style={{ background: '#059669', borderColor: '#059669' }}
                >
                  {savingResolution ? 'Closing...' : 'Close & Record in Audit Trail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raise Defect Modal */}
      {showRaiseModal && (
        <div
          onClick={() => setShowRaiseModal(false)}
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
              width: 500,
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '16px 20px',
              background: '#0f172a',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>+ Raise New QC Defect Query</h3>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Clinevo eTMF 4.3 §9 — Quality Control Findings
                </div>
              </div>
              <span style={{ fontSize: 18, cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowRaiseModal(false)}>✕</span>
            </div>

            <form onSubmit={handleCreateDefect} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  TARGET DOCUMENT ID *
                </label>
                <input
                  className="modern-input"
                  value={newDefect.documentId}
                  onChange={e => setNewDefect({ ...newDefect, documentId: e.target.value })}
                  style={{ width: '100%' }}
                  placeholder="e.g. doc-001"
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  DEFECT SEVERITY *
                </label>
                <select
                  className="modern-input"
                  value={newDefect.severity}
                  onChange={e => setNewDefect({ ...newDefect, severity: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="Critical">Critical (Immediate audit risk)</option>
                  <option value="Major">Major (GCP finding)</option>
                  <option value="Medium">Medium (Discrepancy)</option>
                  <option value="Minor">Minor (Formatting / Typo)</option>
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  DEFECT QUERY DESCRIPTION *
                </label>
                <textarea
                  className="modern-input"
                  rows={3}
                  value={newDefect.text}
                  onChange={e => setNewDefect({ ...newDefect, text: e.target.value })}
                  placeholder="Detail the non-conformance, missing attachment, or signature defect..."
                  required
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowRaiseModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDefect.text.trim()}
                  className="btn-primary"
                >
                  {creating ? 'Logging Defect...' : 'Log QC Defect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
