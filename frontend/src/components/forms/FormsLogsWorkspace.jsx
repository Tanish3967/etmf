import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function FormsLogsWorkspace({ onFormPushed }) {
  const [schemas, setSchemas] = useState([]);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [formDataList, setFormDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pushingId, setPushingId] = useState(null);

  // New Form Entry State
  const [headerData, setHeaderData] = useState({
    protocol_number: 'TRIAL-2024-001',
    site_number: 'Site-001',
    pi_name: 'Dr. Sarah Chen'
  });
  const [gridRows, setGridRows] = useState([
    { staff_name: '', study_role: '', delegated_tasks: '', start_date: '', end_date: '', pi_initials: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSchemas();
  }, []);

  useEffect(() => {
    if (selectedSchema) {
      loadFormData(selectedSchema.id);
    }
  }, [selectedSchema]);

  const loadSchemas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/forms/schemas');
      const list = res.data.schemas || [];
      setSchemas(list);
      if (list.length > 0) setSelectedSchema(list[0]);
    } catch (err) {
      console.error('Error loading forms schemas:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFormData = async (schemaId) => {
    try {
      const res = await api.get(`/forms/${schemaId}/data`);
      setFormDataList(res.data.data || []);
    } catch (err) {
      console.error('Error loading form submissions:', err);
    }
  };

  const handleAddGridRow = () => {
    setGridRows(prev => [
      ...prev,
      { staff_name: '', study_role: '', delegated_tasks: '', start_date: '', end_date: '', pi_initials: '' }
    ]);
  };

  const handleUpdateGridRow = (index, field, value) => {
    setGridRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveGridRow = (index) => {
    setGridRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!selectedSchema) return;

    setSubmitting(true);
    try {
      const payload = {
        study_id: 'study-001',
        data_json: {
          ...headerData,
          records: gridRows
        }
      };

      await api.post(`/forms/${selectedSchema.id}/data`, payload);
      alert(`Form "${selectedSchema.name}" submitted successfully.`);
      setShowAddModal(false);
      loadFormData(selectedSchema.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit form.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePushToETMF = async (entry) => {
    if (!window.confirm(`Regulatory Action: Do you wish to file "${selectedSchema.name}" directly into DIA TMF Zone ${selectedSchema.zone || '05'}?`)) {
      return;
    }

    setPushingId(entry.id);
    try {
      const res = await api.post(`/forms/${entry.id}/push-to-etmf`);
      alert(`✅ Form Rendition filed into eTMF!\nDocument ID: ${res.data.documentId}\nZone: ${res.data.zone} > Section: ${res.data.section}`);
      if (onFormPushed) onFormPushed();
      loadFormData(selectedSchema.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to push form to eTMF.');
    } finally {
      setPushingId(null);
    }
  };

  const handleLockForm = async (entryId) => {
    if (!window.confirm('Are you sure you want to lock this form per 21 CFR Part 11 requirements?')) return;
    try {
      await api.patch(`/forms/data/${entryId}/lock`, { reason: 'Form locked following site closeout verification' });
      alert('Form locked and sealed in audit trail.');
      loadFormData(selectedSchema.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to lock form.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            Forms &amp; Logs Workspace
          </h1>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Clinevo eTMF 4.3 §12 — Dynamic Clinical Trial Logs, Digital Signoff &amp; One-Click eTMF Repository Push
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ background: '#0284c7' }}
        >
          + Fill New Clinical Log Entry
        </button>
      </div>

      {/* Schema Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {schemas.map(s => {
          const isSelected = selectedSchema?.id === s.id;
          return (
            <div
              key={s.id}
              onClick={() => setSelectedSchema(s)}
              style={{
                background: isSelected ? '#f0f9ff' : '#fff',
                border: `2px solid ${isSelected ? '#0284c7' : '#e2e8f0'}`,
                borderRadius: 10,
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 4px 6px -1px rgba(2, 132, 199, 0.1)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                  DIA ZONE {s.zone || '05'}.{s.section || '02'}
                </span>
                <span style={{ fontSize: 16 }}>{isSelected ? '📌' : '📋'}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                {s.name}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                {s.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Form Submissions Table */}
      <div className="glass-panel" style={{ background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
              Submissions: {selectedSchema?.name}
            </h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Artifact Code: <strong style={{ color: '#0284c7' }}>{selectedSchema?.artifact_code || '05.02.01'}</strong>
            </div>
          </div>
          <span className="badge badge-info">{formDataList.length} Entries Recorded</span>
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading form records...</div>
          ) : (
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Record ID</th>
                  <th>Submitted By</th>
                  <th>Submission Date</th>
                  <th>Status</th>
                  <th>Details Summary</th>
                  <th style={{ textAlign: 'right', minWidth: 240 }}>eTMF Action</th>
                </tr>
              </thead>
              <tbody>
                {formDataList.map(entry => {
                  const data = entry.data_json || {};
                  const rowCount = data.records?.length || data.staff_records?.length || 0;
                  return (
                    <tr key={entry.id}>
                      <td style={{ color: '#0ea5e9', fontWeight: 700 }}>{entry.id}</td>
                      <td style={{ fontWeight: 600 }}>{entry.created_by_name || 'Investigator'}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(entry.created_at).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${entry.is_locked ? 'badge-danger' : 'badge-success'}`}>
                          {entry.is_locked ? '🔒 LOCKED' : '✓ ACTIVE'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: '#334155' }}>
                        Site: <strong>{data.site_number || 'Site-001'}</strong> | {rowCount} Grid Items
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          {!entry.is_locked && (
                            <button
                              className="btn-secondary"
                              onClick={() => handleLockForm(entry.id)}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              title="Lock Form (21 CFR Part 11)"
                            >
                              🔒 Lock
                            </button>
                          )}
                          <button
                            className="btn-primary"
                            onClick={() => handlePushToETMF(entry)}
                            disabled={pushingId === entry.id}
                            style={{ fontSize: 11, padding: '4px 10px', background: '#0284c7' }}
                            title="Compile and publish directly into DIA TMF folder"
                          >
                            {pushingId === entry.id ? 'Filing...' : '🚀 Push to eTMF Folder'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {formDataList.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No submissions recorded for this form yet. Click "+ Fill New Clinical Log Entry" above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Fill New Form Modal */}
      {showAddModal && selectedSchema && (
        <div
          onClick={() => setShowAddModal(false)}
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
              width: 760,
              maxHeight: '90vh',
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              padding: '16px 24px',
              background: '#0f172a',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  + Fill New Form: {selectedSchema.name}
                </h3>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Filing Target: DIA Zone {selectedSchema.zone} &gt; Section {selectedSchema.section}
                </div>
              </div>
              <span style={{ fontSize: 18, cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowAddModal(false)}>✕</span>
            </div>

            <form onSubmit={handleSubmitForm} style={{ padding: 24, overflowY: 'auto' }}>
              {/* Header Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    PROTOCOL NUMBER *
                  </label>
                  <input
                    className="modern-input"
                    value={headerData.protocol_number}
                    onChange={e => setHeaderData({ ...headerData, protocol_number: e.target.value })}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    SITE NUMBER *
                  </label>
                  <input
                    className="modern-input"
                    value={headerData.site_number}
                    onChange={e => setHeaderData({ ...headerData, site_number: e.target.value })}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    PRINCIPAL INVESTIGATOR *
                  </label>
                  <input
                    className="modern-input"
                    value={headerData.pi_name}
                    onChange={e => setHeaderData({ ...headerData, pi_name: e.target.value })}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>

              {/* Grid Section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                    Clinical Log Records Grid (§12.1)
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGridRow}
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    + Add Row
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Personnel / Staff Name</th>
                        <th>Study Role</th>
                        <th>Delegated Tasks</th>
                        <th style={{ width: 110 }}>Start Date</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gridRows.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              className="modern-input"
                              placeholder="e.g. Sarah Jenkins, RN"
                              value={row.staff_name}
                              onChange={e => handleUpdateGridRow(idx, 'staff_name', e.target.value)}
                              style={{ width: '100%', fontSize: 12 }}
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="modern-input"
                              placeholder="e.g. Sub-Investigator"
                              value={row.study_role}
                              onChange={e => handleUpdateGridRow(idx, 'study_role', e.target.value)}
                              style={{ width: '100%', fontSize: 12 }}
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="modern-input"
                              placeholder="Informed consent, dispensing..."
                              value={row.delegated_tasks}
                              onChange={e => handleUpdateGridRow(idx, 'delegated_tasks', e.target.value)}
                              style={{ width: '100%', fontSize: 12 }}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              className="modern-input"
                              value={row.start_date}
                              onChange={e => handleUpdateGridRow(idx, 'start_date', e.target.value)}
                              style={{ width: '100%', fontSize: 12 }}
                              required
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {gridRows.length > 1 && (
                              <span
                                onClick={() => handleRemoveGridRow(idx)}
                                style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                                title="Remove row"
                              >
                                ✕
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ background: '#0284c7' }}
                >
                  {submitting ? 'Submitting Form...' : 'Submit & Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
