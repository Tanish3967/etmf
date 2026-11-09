import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function ApplicationAdminWorkspace({ onOpenStudyWizard }) {
  const [activeTab, setActiveTab] = useState('studies'); // 'studies' | 'departments' | 'designations' | 'taxonomy'
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ── STUDIES STATE ──────────────────────────────────────────────────
  const [studies, setStudies] = useState([]);
  const [studySearch, setStudySearch] = useState('');
  const [completenessModal, setCompletenessModal] = useState(null); // { study, completeness }
  const [sitesModal, setSitesModal] = useState(null); // { study, sites }
  const [newSiteData, setNewSiteData] = useState({ siteCode: '', name: '', country: 'USA', piName: '', activationDate: '' });

  // ── DEPARTMENTS MASTER STATE (§8.5.2.1) ────────────────────────────
  const [departments, setDepartments] = useState([]);
  const [deptSearch, setDeptSearch] = useState('');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptFormData, setDeptFormData] = useState({ code: '', name: '', isActive: true });

  // ── DESIGNATIONS MASTER STATE (§8.5.2.2) ───────────────────────────
  const [designations, setDesignations] = useState([]);
  const [desigSearch, setDesigSearch] = useState('');
  const [showDesigModal, setShowDesigModal] = useState(false);
  const [editingDesig, setEditingDesig] = useState(null);
  const [desigFormData, setDesigFormData] = useState({ code: '', name: '', isActive: true });

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // ── FETCH DATA ─────────────────────────────────────────────────────
  const fetchStudies = async () => {
    try {
      const res = await api.get('/studies');
      setStudies(res.data.studies || []);
    } catch (err) {
      console.error('Error fetching studies:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/admin/system-codelists?groupName=Department');
      setDepartments(res.data.codelists || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchDesignations = async () => {
    try {
      const res = await api.get('/admin/system-codelists?groupName=Designation');
      setDesignations(res.data.codelists || []);
    } catch (err) {
      console.error('Error fetching designations:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStudies(), fetchDepartments(), fetchDesignations()])
      .finally(() => setLoading(false));
  }, []);

  // ── STUDY ACTIONS ──────────────────────────────────────────────────
  const handleViewCompleteness = async (study) => {
    try {
      const res = await api.get(`/studies/${study.id}/completeness`);
      setCompletenessModal({ study, data: res.data });
    } catch (err) {
      showNotification('Failed to fetch completeness report', true);
    }
  };

  const handleViewSites = async (study) => {
    try {
      const res = await api.get(`/studies/${study.id}/sites`);
      setSitesModal({ study, sites: res.data.sites || [] });
      setNewSiteData({ siteCode: '', name: '', country: 'USA', piName: '', activationDate: new Date().toISOString().split('T')[0] });
    } catch (err) {
      showNotification('Failed to fetch study sites', true);
    }
  };

  const handleAddSiteToStudy = async (e) => {
    e.preventDefault();
    if (!sitesModal) return;
    if (sitesModal.study.locked) {
      showNotification('Cannot add sites: Study is locked per 21 CFR Part 11', true);
      return;
    }
    try {
      const res = await api.post(`/studies/${sitesModal.study.id}/sites`, newSiteData);
      showNotification(`Site "${newSiteData.siteCode}" added.`);
      setSitesModal({ ...sitesModal, sites: [...sitesModal.sites, res.data.site] });
      setNewSiteData({ siteCode: '', name: '', country: 'USA', piName: '', activationDate: new Date().toISOString().split('T')[0] });
      fetchStudies();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to add site', true);
    }
  };

  const handleDeleteSiteFromStudy = async (site) => {
    if (!sitesModal) return;
    if (sitesModal.study.locked) {
      showNotification('Cannot delete sites: Study is locked per 21 CFR Part 11', true);
      return;
    }
    if (!window.confirm(`Regulatory Action: Remove site "${site.site_code} (${site.name})"?`)) return;
    try {
      await api.delete(`/studies/${sitesModal.study.id}/sites/${site.id}`);
      showNotification(`Site "${site.site_code}" removed.`);
      setSitesModal({ ...sitesModal, sites: sitesModal.sites.filter(s => s.id !== site.id) });
      fetchStudies();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to remove site', true);
    }
  };

  const handleLockStudy = async (study) => {
    if (!window.confirm(`Regulatory Lock Action: Are you sure you want to lock study "${study.protocol_number}" per 21 CFR Part 11 requirements? Locked studies cannot receive modifications.`)) return;
    try {
      await api.post(`/studies/${study.id}/lock`, { force: true });
      showNotification(`Study "${study.protocol_number}" has been locked.`);
      fetchStudies();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to lock study', true);
    }
  };

  const handleUnlockStudy = async (study) => {
    if (!window.confirm(`Regulatory Unlock Action: Unlock study "${study.protocol_number}"? This will re-enable active filings and site operations.`)) return;
    try {
      await api.post(`/studies/${study.id}/unlock`);
      showNotification(`Study "${study.protocol_number}" has been unlocked.`);
      fetchStudies();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to unlock study', true);
    }
  };

  const handleCloneStudy = async (study) => {
    const newProt = window.prompt(`Clone Study: Enter new protocol number for cloned version of "${study.protocol_number}":`, `${study.protocol_number}-COPY`);
    if (!newProt) return;
    const newTitle = window.prompt(`Enter title for ${newProt}:`, `${study.title} (Clone)`);
    if (!newTitle) return;
    try {
      await api.post(`/studies/${study.id}/clone`, {
        newProtocolNumber: newProt,
        newTitle: newTitle
      });
      showNotification(`Study cloned successfully into "${newProt}".`);
      fetchStudies();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to clone study', true);
    }
  };

  // ── DEPARTMENT ACTIONS ─────────────────────────────────────────────
  const handleOpenAddDept = () => {
    setEditingDept(null);
    setDeptFormData({ code: '', name: '', isActive: true });
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (d) => {
    setEditingDept(d);
    setDeptFormData({ code: d.code, name: d.name, isActive: d.is_active !== 0 });
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await api.put(`/admin/system-codelists/${editingDept.id}`, {
          code: deptFormData.code,
          name: deptFormData.name,
          group_name: 'Department',
          is_active: deptFormData.isActive
        });
        showNotification(`Department "${deptFormData.name}" updated.`);
      } else {
        await api.post('/admin/system-codelists', {
          code: deptFormData.code,
          name: deptFormData.name,
          group_name: 'Department',
          is_active: deptFormData.isActive
        });
        showNotification(`Department "${deptFormData.name}" created.`);
      }
      setShowDeptModal(false);
      fetchDepartments();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to save department', true);
    }
  };

  const handleDeleteDept = async (d) => {
    if (!window.confirm(`Delete department codelist "${d.name}"?`)) return;
    try {
      await api.delete(`/admin/system-codelists/${d.id}`);
      showNotification(`Department "${d.name}" deleted.`);
      fetchDepartments();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to delete department', true);
    }
  };

  // ── DESIGNATION ACTIONS ────────────────────────────────────────────
  const handleOpenAddDesig = () => {
    setEditingDesig(null);
    setDesigFormData({ code: '', name: '', isActive: true });
    setShowDesigModal(true);
  };

  const handleOpenEditDesig = (d) => {
    setEditingDesig(d);
    setDesigFormData({ code: d.code, name: d.name, isActive: d.is_active !== 0 });
    setShowDesigModal(true);
  };

  const handleSaveDesig = async (e) => {
    e.preventDefault();
    try {
      if (editingDesig) {
        await api.put(`/admin/system-codelists/${editingDesig.id}`, {
          code: desigFormData.code,
          name: desigFormData.name,
          group_name: 'Designation',
          is_active: desigFormData.isActive
        });
        showNotification(`Designation "${desigFormData.name}" updated.`);
      } else {
        await api.post('/admin/system-codelists', {
          code: desigFormData.code,
          name: desigFormData.name,
          group_name: 'Designation',
          is_active: desigFormData.isActive
        });
        showNotification(`Designation "${desigFormData.name}" created.`);
      }
      setShowDesigModal(false);
      fetchDesignations();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to save designation', true);
    }
  };

  const handleDeleteDesig = async (d) => {
    if (!window.confirm(`Delete designation codelist "${d.name}"?`)) return;
    try {
      await api.delete(`/admin/system-codelists/${d.id}`);
      showNotification(`Designation "${d.name}" deleted.`);
      fetchDesignations();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to delete designation', true);
    }
  };

  // ── FILTERS ────────────────────────────────────────────────────────
  const filteredStudies = studies.filter(s => {
    if (!studySearch.trim()) return true;
    const q = studySearch.toLowerCase();
    return (s.protocol_number && s.protocol_number.toLowerCase().includes(q)) ||
           (s.title && s.title.toLowerCase().includes(q)) ||
           (s.sponsor_name && s.sponsor_name.toLowerCase().includes(q));
  });

  const filteredDepts = departments.filter(d => {
    if (!deptSearch.trim()) return true;
    const q = deptSearch.toLowerCase();
    return (d.name && d.name.toLowerCase().includes(q)) ||
           (d.code && d.code.toLowerCase().includes(q));
  });

  const filteredDesigs = designations.filter(d => {
    if (!desigSearch.trim()) return true;
    const q = desigSearch.toLowerCase();
    return (d.name && d.name.toLowerCase().includes(q)) ||
           (d.code && d.code.toLowerCase().includes(q));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            Application Administration Console (§8.5.2)
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Clinical Study Configuration, Department & Designation Masters, and DIA TMF Taxonomy (§8.5.2.1 - §8.5.2.7)
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {successMsg && (
            <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ✅ {successMsg}
            </div>
          )}
          {errorMsg && (
            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </div>
          )}
          <button
            onClick={onOpenStudyWizard}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700 }}
          >
            <span>✨</span> + New Study Setup (§8.5.2)
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveTab('studies')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'studies' ? '#fff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'studies' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'studies' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'studies' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>🏥 Clinical Studies</span>
          <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            {studies.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'departments' ? '#fff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'departments' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'departments' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'departments' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>🏢 Department Master (§8.5.2.1)</span>
          <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            {departments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('designations')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'designations' ? '#fff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'designations' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'designations' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'designations' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>🏷️ Designation Master (§8.5.2.2)</span>
          <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            {designations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('taxonomy')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'taxonomy' ? '#fff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'taxonomy' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'taxonomy' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'taxonomy' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>📂 DIA Reference Model v3.2</span>
        </button>
      </div>

      {/* ── TAB 1: CLINICAL STUDIES ───────────────────────────────────── */}
      {activeTab === 'studies' && (
        <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* TOOLBAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 380 }}>
              <input
                type="text"
                placeholder="Search by protocol number, title, or sponsor..."
                value={studySearch}
                onChange={e => setStudySearch(e.target.value)}
                className="modern-input"
                style={{ padding: '8px 14px', fontSize: 13 }}
              />
            </div>
          </div>

          {/* STUDIES TABLE */}
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Protocol & Title</th>
                  <th>Phase & Area</th>
                  <th>Sponsor</th>
                  <th>Status</th>
                  <th>Docs / Sites</th>
                  <th>Timeline</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudies.length > 0 ? (
                  filteredStudies.map(s => (
                    <tr key={s.id}>
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ fontWeight: 700, color: '#0284c7', fontSize: 13 }}>
                          {s.protocol_number}
                        </div>
                        <div style={{ fontSize: 12, color: '#334155', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={s.title}>
                          {s.title}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{s.phase}</span>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{s.therapeutic_area || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.sponsor_name || '—'}</div>
                        {s.cro_name && <div style={{ fontSize: 11, color: '#64748b' }}>CRO: {s.cro_name}</div>}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: s.status === 'Active' ? '#dcfce7' : s.status === 'Locked' ? '#fee2e2' : s.status === 'Closed' ? '#f1f5f9' : '#e0f2fe',
                          color: s.status === 'Active' ? '#166534' : s.status === 'Locked' ? '#991b1b' : s.status === 'Closed' ? '#475569' : '#0369a1'
                        }}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                          📄 {s.doc_count || 0} Docs
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          🏥 {s.site_count || 0} Sites
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Start: {s.start_date || '—'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>End: {s.planned_end_date || '—'}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleViewCompleteness(s)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 11, color: '#0284c7' }}
                            title="View EDL Completeness Audit"
                          >
                            📊 EDL
                          </button>
                          <button
                            onClick={() => handleViewSites(s)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 11, color: '#059669' }}
                            title="Manage Sites"
                          >
                            🏥 Sites
                          </button>
                          <button
                            onClick={() => handleCloneStudy(s)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Clone Study Hierarchy"
                          >
                            📑 Clone
                          </button>
                          {s.status === 'Locked' ? (
                            <button
                              onClick={() => handleUnlockStudy(s)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 11, color: '#16a34a', borderColor: '#bbf7d0' }}
                              title="Regulatory Unlock (21 CFR Part 11)"
                            >
                              🔓 Unlock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLockStudy(s)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 11, color: '#dc2626' }}
                              title="Regulatory Lock (21 CFR Part 11)"
                            >
                              🔒 Lock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No clinical studies found. Click "+ New Study Setup" to launch the setup wizard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: DEPARTMENT MASTER (§8.5.2.1) ───────────────────────── */}
      {activeTab === 'departments' && (
        <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 350 }}>
              <input
                type="text"
                placeholder="Search departments..."
                value={deptSearch}
                onChange={e => setDeptSearch(e.target.value)}
                className="modern-input"
                style={{ padding: '8px 14px', fontSize: 13 }}
              />
            </div>
            <button
              onClick={handleOpenAddDept}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13 }}
            >
              <span>+</span> Add Department (§8.5.2.1)
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Department Code</th>
                  <th style={{ width: '45%' }}>Department Name</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ textAlign: 'right', width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepts.length > 0 ? (
                  filteredDepts.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700, color: '#0284c7' }}>{d.code}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{d.name}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: d.is_active !== 0 ? '#16a34a' : '#94a3b8' }}>
                          {d.is_active !== 0 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEditDept(d)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDept(d)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12, color: '#dc2626' }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No departments found. Click "+ Add Department" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: DESIGNATION MASTER (§8.5.2.2) ──────────────────────── */}
      {activeTab === 'designations' && (
        <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 350 }}>
              <input
                type="text"
                placeholder="Search designations..."
                value={desigSearch}
                onChange={e => setDesigSearch(e.target.value)}
                className="modern-input"
                style={{ padding: '8px 14px', fontSize: 13 }}
              />
            </div>
            <button
              onClick={handleOpenAddDesig}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13 }}
            >
              <span>+</span> Add Designation (§8.5.2.2)
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Designation Code</th>
                  <th style={{ width: '45%' }}>Designation Name</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ textAlign: 'right', width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDesigs.length > 0 ? (
                  filteredDesigs.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700, color: '#0284c7' }}>{d.code}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{d.name}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: d.is_active !== 0 ? '#16a34a' : '#94a3b8' }}>
                          {d.is_active !== 0 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEditDesig(d)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDesig(d)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12, color: '#dc2626' }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No designations found. Click "+ Add Designation" to configure titles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: DIA TAXONOMY ───────────────────────────────────────── */}
      {activeTab === 'taxonomy' && (
        <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
              DIA TMF Reference Model v3.2 Global Taxonomy (§8.5.2.7)
            </h3>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              ICH GCP E6(R2) / 21 CFR Part 11 Trial Taxonomy Standards used across all clinical programs.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {[
              { code: 'Zone 01', title: 'Trial Management', items: ['Trial Master File Plan', 'Monitoring Plan', 'Governance Records', 'Handover Notes'] },
              { code: 'Zone 02', title: 'Central Trial Documents', items: ['Clinical Protocol', 'Investigator Brochure', 'Informed Consent Form (ICF)', 'Subject Diaries'] },
              { code: 'Zone 03', title: 'Regulatory', items: ['Clinical Trial Applications (CTA)', 'Health Authority Approvals', 'Annual Safety Updates'] },
              { code: 'Zone 04', title: 'IRB / IEC', items: ['Central Ethics Committee Clearances', 'Local IRB Approvals', 'Informed Consent Approvals'] },
              { code: 'Zone 05', title: 'Site Management', items: ['Site Feasibility Survey', 'Site Initiation Visit (SIV)', 'Delegation of Authority (DOA) Log'] },
              { code: 'Zone 06', title: 'IP & Trial Supplies', items: ['Investigational Product Shipping Receipts', 'Certificates of Analysis (CoA)', 'Destruction Records'] },
              { code: 'Zone 07', title: 'Safety Reporting', items: ['Serious Adverse Event (SAE) Reports', 'CIOMS-I Forms', 'SUSAR Safety Bulletins'] },
              { code: 'Zone 08', title: 'Central & Local Testing', items: ['CLIA / CAP Laboratory Certifications', 'Normal Reference Ranges', 'Lab Director CVs'] },
              { code: 'Zone 09', title: 'Third Parties', items: ['Clinical Trial Agreements (CTA)', 'Master Service Agreements (MSA)', 'Vendor Oversight'] },
              { code: 'Zone 10', title: 'Data Management', items: ['Data Management Plan (DMP)', 'eCRF Completion Guidelines', 'Data Validation Specs'] },
              { code: 'Zone 11', title: 'Statistics', items: ['Statistical Analysis Plan (SAP)', 'Mock Tables & Figures', 'Blind Data Review Signoffs'] }
            ].map(z => (
              <div key={z.code} style={{ padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', background: '#e0f2fe', padding: '2px 8px', borderRadius: 6 }}>
                    {z.code}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>DIA v3.2</span>
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginBottom: 8 }}>{z.title}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                  {z.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW STUDY COMPLETENESS ────────────────────────────── */}
      {completenessModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                  EDL Completeness Audit (§8.16)
                </h3>
                <div style={{ fontSize: 13, color: '#0284c7', fontWeight: 600 }}>
                  {completenessModal.study.protocol_number} — {completenessModal.study.title}
                </div>
              </div>
              <button onClick={() => setCompletenessModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {/* OVERALL METRIC */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Overall Completeness</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {completenessModal.data.overall}%
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {completenessModal.data.approved || 0} approved of {completenessModal.data.totalDocs || 0} total filed documents
                </div>
              </div>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: `conic-gradient(#0284c7 ${completenessModal.data.overall * 3.6}deg, #e2e8f0 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0284c7', fontSize: 14 }}>
                  {completenessModal.data.overall}%
                </div>
              </div>
            </div>

            {/* ZONE BREAKDOWN */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Zone Completeness Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {completenessModal.data.zones && completenessModal.data.zones.length > 0 ? (
                  completenessModal.data.zones.map(z => {
                    const pct = z.total ? Math.round((z.approved / z.total) * 100) : 0;
                    return (
                      <div key={z.zone} style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                          <span>Zone {z.zone}: {z.label}</span>
                          <span>{z.approved} / {z.total} docs ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16a34a' : '#0284c7', borderRadius: 4 }}></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    No filed documents recorded yet for this study. Placeholders are awaiting initial document filing.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setCompletenessModal(null)} className="btn-secondary">Close Audit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MANAGE SITES ───────────────────────────────────────── */}
      {sitesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                  Participating Clinical Sites
                </h3>
                <div style={{ fontSize: 13, color: '#0284c7', fontWeight: 600 }}>
                  {sitesModal.study.protocol_number} — {sitesModal.study.title}
                </div>
              </div>
              <button onClick={() => setSitesModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {/* ADD SITE FORM OR REGULATORY LOCK BANNER */}
            {sitesModal.study.locked ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, color: '#991b1b' }}>
                <span style={{ fontSize: 22 }}>🔒</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Study Locked (21 CFR Part 11)</div>
                  <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>This clinical study is locked against regulatory changes. New investigational sites cannot be added.</div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddSiteToStudy} style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Add Participating Site</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginBottom: 10 }}>
                  <input
                    type="text"
                    required
                    placeholder="Site Code (e.g. Site-105)"
                    value={newSiteData.siteCode}
                    onChange={e => setNewSiteData({ ...newSiteData, siteCode: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Facility Name (e.g. Cleveland Clinic)"
                    value={newSiteData.name}
                    onChange={e => setNewSiteData({ ...newSiteData, name: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Country (e.g. USA)"
                    value={newSiteData.country}
                    onChange={e => setNewSiteData({ ...newSiteData, country: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Principal Investigator Name"
                    value={newSiteData.piName}
                    onChange={e => setNewSiteData({ ...newSiteData, piName: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <input
                    type="date"
                    value={newSiteData.activationDate}
                    onChange={e => setNewSiteData({ ...newSiteData, activationDate: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                    + Add Site
                  </button>
                </div>
              </form>
            )}

            {/* SITES LIST */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Site Code</th>
                    <th>Facility Name</th>
                    <th>Country</th>
                    <th>PI Name</th>
                    <th>Activation</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sitesModal.sites && sitesModal.sites.length > 0 ? (
                    sitesModal.sites.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700, color: '#0284c7' }}>{s.site_code}</td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.country}</td>
                        <td>{s.pi_name || '—'}</td>
                        <td>{s.activation_date || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {!sitesModal.study.locked && (
                            <button
                              onClick={() => handleDeleteSiteFromStudy(s)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                              title="Remove site from study"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                        No sites assigned to this study.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setSitesModal(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT DEPARTMENT ──────────────────────────────── */}
      {showDeptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                {editingDept ? 'Edit Department Master' : 'Add Department (§8.5.2.1)'}
              </h3>
              <button onClick={() => setShowDeptModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveDept} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Department Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DEPT-MED-WRIT"
                  value={deptFormData.code}
                  onChange={e => setDeptFormData({ ...deptFormData, code: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical Writing & Publications"
                  value={deptFormData.name}
                  onChange={e => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="deptActiveToggle"
                  checked={deptFormData.isActive}
                  onChange={e => setDeptFormData({ ...deptFormData, isActive: e.target.checked })}
                />
                <label htmlFor="deptActiveToggle" style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Department Active
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setShowDeptModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingDept ? 'Save Changes' : 'Create Department'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT DESIGNATION ─────────────────────────────── */}
      {showDesigModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 28, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                {editingDesig ? 'Edit Designation Master' : 'Add Designation (§8.5.2.2)'}
              </h3>
              <button onClick={() => setShowDesigModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveDesig} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Designation Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DESIG-CLIN-DIR"
                  value={desigFormData.code}
                  onChange={e => setDesigFormData({ ...desigFormData, code: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Designation Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clinical Research Director"
                  value={desigFormData.name}
                  onChange={e => setDesigFormData({ ...desigFormData, name: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="desigActiveToggle"
                  checked={desigFormData.isActive}
                  onChange={e => setDesigFormData({ ...desigFormData, isActive: e.target.checked })}
                />
                <label htmlFor="desigActiveToggle" style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Designation Active
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setShowDesigModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingDesig ? 'Save Changes' : 'Create Designation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
