import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function CreateAuditPlanModal({ onClose, onCreated }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultEndStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    study_id: 'study-001',
    lead_auditor: 'QA Auditor Sarah Chen',
    start_date: todayStr,
    end_date: defaultEndStr,
    scope_description: '',
    status: 'Active'
  });

  const [studies, setStudies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadStudies() {
      try {
        const res = await api.get('/studies');
        if (active && res.data?.studies?.length > 0) {
          setStudies(res.data.studies);
          if (!formData.study_id) {
            setFormData(prev => ({ ...prev, study_id: res.data.studies[0].id }));
          }
        }
      } catch {
        // Fallback to default study-001
      }
    }
    loadStudies();
    return () => {
      active = false;
    };
  }, [formData.study_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const title = formData.title.trim();
    const studyId = formData.study_id.trim();
    const leadAuditor = formData.lead_auditor.trim();
    const startDate = formData.start_date;
    const endDate = formData.end_date;

    if (!title) {
      setError('Audit Plan title is required.');
      return;
    }
    if (!studyId) {
      setError('Study / Protocol identifier is required.');
      return;
    }
    if (!leadAuditor) {
      setError('Lead Auditor name or ID is required.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Both start date and end date are required.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before or equal to end date.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/qc/plans', {
        title,
        study_id: studyId,
        lead_auditor: leadAuditor,
        start_date: startDate,
        end_date: endDate,
        scope_description: formData.scope_description.trim(),
        status: formData.status
      });

      if (onCreated) {
        onCreated(res.data.plan);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create audit plan.');
    } finally {
      setSaving(false);
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
          width: 540,
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
              📅 Schedule Quality Control Audit Plan
            </h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Clinevo eTMF 4.3 §11 a — Audit Plan Definition &amp; Regulatory Lead Auditor Assignment
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

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              AUDIT PLAN TITLE *
            </label>
            <input
              type="text"
              name="title"
              className="modern-input"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Q4 2026 Trial Master File Quality Audit"
              style={{ width: '100%' }}
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                STUDY / PROTOCOL *
              </label>
              {studies.length > 0 ? (
                <select
                  name="study_id"
                  className="modern-input"
                  value={formData.study_id}
                  onChange={handleChange}
                  style={{ width: '100%', fontSize: 12.5 }}
                >
                  {studies.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.protocol_number || s.id} {s.title ? `- ${s.title.slice(0, 20)}...` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="study_id"
                  className="modern-input"
                  value={formData.study_id}
                  onChange={handleChange}
                  placeholder="e.g. study-001"
                  style={{ width: '100%' }}
                  required
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                INITIAL STATUS
              </label>
              <select
                name="status"
                className="modern-input"
                value={formData.status}
                onChange={handleChange}
                style={{ width: '100%', fontSize: 12.5 }}
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              LEAD AUDITOR *
            </label>
            <input
              type="text"
              name="lead_auditor"
              className="modern-input"
              value={formData.lead_auditor}
              onChange={handleChange}
              placeholder="e.g. QA Auditor Sarah Chen"
              style={{ width: '100%' }}
              required
            />
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>
              Lead auditor is automatically enrolled into participant roster with Lead Auditor role (§11 a).
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                START DATE *
              </label>
              <input
                type="date"
                name="start_date"
                className="modern-input"
                value={formData.start_date}
                onChange={handleChange}
                style={{ width: '100%', fontSize: 12.5 }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                END DATE *
              </label>
              <input
                type="date"
                name="end_date"
                className="modern-input"
                value={formData.end_date}
                onChange={handleChange}
                style={{ width: '100%', fontSize: 12.5 }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              SCOPE DESCRIPTION &amp; AUDIT OBJECTIVES
            </label>
            <textarea
              name="scope_description"
              className="modern-input"
              rows={3}
              value={formData.scope_description}
              onChange={handleChange}
              placeholder="Detail specific TMF zones, milestones, site binders, or regulatory criteria targeted for verification..."
              style={{ width: '100%', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ background: '#0284c7' }}
            >
              {saving ? 'Scheduling Plan...' : '✓ Schedule Audit Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
