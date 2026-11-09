import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function FilePlanModal({ studyId = 'study-001', onClose }) {
  const [loading, setLoading] = useState(true);
  const [edlItems, setEdlItems] = useState([]);
  const [completeness, setCompleteness] = useState(null);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);

  useEffect(() => {
    loadData();
  }, [studyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load EDL items
      const edlRes = await api.get(`/studies/${studyId}/edl`);
      setEdlItems(edlRes.data.edl || []);

      // Load Completeness stats
      const compRes = await api.get(`/studies/${studyId}/completeness`);
      setCompleteness(compRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to fetch study file plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNA = async (item) => {
    const isCurrentlyNA = Boolean(item.na_designated);
    const reason = window.prompt(
      isCurrentlyNA
        ? 'Enter reason for removing N/A status:'
        : 'Mandatory: Enter ALCOA+ justification for designating artifact as Not Applicable (N/A):'
    );
    if (!reason || !reason.trim()) return;

    setActioningId(item.id);
    try {
      await api.post(`/edl/${item.id}/na`, {
        designated: !isCurrentlyNA,
        reason: reason.trim()
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update N/A status');
    } finally {
      setActioningId(null);
    }
  };

  const handleToggleMandatory = async (item) => {
    setActioningId(item.id);
    try {
      await api.patch(`/edl/${item.id}/mandatory`, {
        mandatory: !item.mandatory
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle mandatory flag');
    } finally {
      setActioningId(null);
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
          width: 820,
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>
              📋 Study File Plan & Expected Document List (EDL)
            </h3>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              Clinevo eTMF 4.3 §8.7 — Master Milestone & Completeness Oversight
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Completeness Summary Banner */}
        {completeness && (
          <div style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>TOTAL EXPECTED</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{completeness.totalExpected || edlItems.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>FILED & APPROVED</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{completeness.filed || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>MISSING MANDATORY</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{completeness.missing || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>N/A DESIGNATED</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{completeness.naCount || 0}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>COMPLETENESS RATE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7' }}>
                {completeness.percentage || (edlItems.length ? Math.round(((completeness.filed || 0) / edlItems.length) * 100) : 0)}%
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading study file plan...</div>
          ) : error ? (
            <div style={{ padding: 20, background: '#fee2e2', color: '#dc2626', borderRadius: 8 }}>{error}</div>
          ) : (
            <table className="modern-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Artifact</th>
                  <th>Artifact Name</th>
                  <th>Zone / Section</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Mandatory</th>
                  <th style={{ width: 130, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {edlItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700, color: '#0ea5e9' }}>{item.artifact_code}</td>
                    <td style={{ fontWeight: 500 }}>
                      {item.artifact_name}
                      {item.na_designated ? (
                        <div style={{ fontSize: 11, color: '#d97706', fontStyle: 'italic', marginTop: 2 }}>
                          N/A: {item.na_reason || 'Designated by manager'}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {item.zone} &gt; {item.section}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.filedStatus ? (
                        <span className="badge badge-success">Filed ({item.filedStatus})</span>
                      ) : item.na_designated ? (
                        <span className="badge badge-warning">N/A</span>
                      ) : (
                        <span className="badge badge-danger">Missing</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(item.mandatory)}
                        disabled={actioningId === item.id}
                        onChange={() => handleToggleMandatory(item)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleToggleNA(item)}
                        disabled={actioningId === item.id}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: item.na_designated ? '#fef3c7' : '#f1f5f9',
                          color: item.na_designated ? '#b45309' : '#475569',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        {item.na_designated ? 'Remove N/A' : 'Designate N/A'}
                      </button>
                    </td>
                  </tr>
                ))}
                {edlItems.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                      No Expected Document List items found for this study. Use '+ Add Expected Placeholder' to populate the file plan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            ALCOA+ Audit Trail: All changes to Mandatory &amp; N/A status require signed justification.
          </div>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
