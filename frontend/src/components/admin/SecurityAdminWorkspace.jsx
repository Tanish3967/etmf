import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function SecurityAdminWorkspace() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'groups' | 'functional_roles'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── USER MANAGEMENT STATE ──────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: 'CRA / Reviewer',
    dept: 'Clinical Operations',
    designation: '',
    description: '',
    password: '',
    active: true,
    functional_roles: []
  });

  // ── USER GROUPS STATE ──────────────────────────────────────────────
  const [userGroups, setUserGroups] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    privileges: ['author', 'reviewer'],
    zones: ['01', '02'],
    folderAssignments: ['01 Trial Management', '02 Central Trial Documents'],
    members: []
  });

  // ── FUNCTIONAL ROLES STATE ─────────────────────────────────────────
  const [functionalRoles, setFunctionalRoles] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    capabilities: ['canView', 'canUpload']
  });
  const [assigningRole, setAssigningRole] = useState(null);
  const [selectedUserIdsForRole, setSelectedUserIdsForRole] = useState([]);

  // ── CODELISTS STATE (Department & Designation Masters) ───────────
  const [availableDepts, setAvailableDepts] = useState([]);
  const [availableDesigs, setAvailableDesigs] = useState([]);

  // DIA Zones list for folder assignment
  const DIA_ZONES_LIST = [
    { code: '01', name: '01 Trial Management' },
    { code: '02', name: '02 Central Trial Documents' },
    { code: '03', name: '03 Regulatory' },
    { code: '04', name: '04 IRB / IEC' },
    { code: '05', name: '05 Site Management' },
    { code: '06', name: '06 IP & Trial Supplies' },
    { code: '07', name: '07 Safety Reporting' },
    { code: '08', name: '08 Central & Local Testing' },
    { code: '09', name: '09 Third Parties' },
    { code: '10', name: '10 Data Management' },
    { code: '11', name: '11 Statistics' }
  ];

  const CLINICAL_SYSTEM_ROLES = [
    'TMF Manager',
    'Principal Investigator',
    'CRA / Reviewer',
    'Regulatory Approver',
    'Data Manager / Author',
    'System Administrator',
    'Inspector / Auditor'
  ];

  const CAPABILITIES_LIST = [
    { id: 'canView', label: 'View Documents' },
    { id: 'canUpload', label: 'Upload Documents' },
    { id: 'canReview', label: 'Perform Review' },
    { id: 'canApprove', label: 'Approve & e-Sign' },
    { id: 'canAdmin', label: 'System Administration' },
    { id: 'canLock', label: 'Lock Studies & Folders' }
  ];

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // ── DATA FETCHING ──────────────────────────────────────────────────
  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchUserGroups = async () => {
    try {
      const res = await api.get('/admin/user-groups');
      setUserGroups(res.data.groups || []);
    } catch (err) {
      console.error('Error fetching user groups:', err);
    }
  };

  const fetchFunctionalRoles = async () => {
    try {
      const res = await api.get('/admin/functional-roles');
      setFunctionalRoles(res.data.roles || []);
    } catch (err) {
      console.error('Error fetching functional roles:', err);
    }
  };

  const fetchCodelists = async () => {
    try {
      const [deptRes, desigRes] = await Promise.all([
        api.get('/admin/system-codelists?groupName=Department'),
        api.get('/admin/system-codelists?groupName=Designation')
      ]);
      setAvailableDepts(deptRes.data.codelists || []);
      setAvailableDesigs(desigRes.data.codelists || []);
    } catch (err) {
      console.error('Error fetching codelists:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchUserGroups(), fetchFunctionalRoles(), fetchCodelists()])
      .finally(() => setLoading(false));
  }, []);

  // ── USER MANAGEMENT HANDLERS ───────────────────────────────────────
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      role: 'CRA / Reviewer',
      dept: 'Clinical Operations',
      designation: '',
      description: '',
      password: '',
      active: true,
      functional_roles: []
    });
    setShowAddUserModal(true);
  };

  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setUserFormData({
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'CRA / Reviewer',
      dept: u.dept || 'Clinical Operations',
      designation: u.designation || '',
      description: u.description || '',
      password: '',
      active: Boolean(u.active),
      functional_roles: u.functional_roles || []
    });
    setShowAddUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, {
          name: userFormData.name,
          email: userFormData.email,
          role: userFormData.role,
          dept: userFormData.dept,
          designation: userFormData.designation,
          description: userFormData.description,
          active: userFormData.active,
          functional_roles: userFormData.functional_roles
        });
        showNotification(`User "${userFormData.name}" updated successfully.`);
      } else {
        await api.post('/users', {
          name: userFormData.name,
          email: userFormData.email,
          role: userFormData.role,
          dept: userFormData.dept,
          designation: userFormData.designation,
          description: userFormData.description,
          password: userFormData.password || 'Clinion@123',
          active: userFormData.active,
          functional_roles: userFormData.functional_roles
        });
        showNotification(`User "${userFormData.name}" created successfully.`);
      }
      setShowAddUserModal(false);
      fetchUsers();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to save user', true);
    }
  };

  const handleResetPassword = async (u) => {
    if (!window.confirm(`Regulatory Security Action: Reset password for user "${u.name}" (${u.email})?`)) return;
    try {
      const res = await api.post(`/users/${u.id}/reset-password`, {});
      alert(`✅ Password Reset Successful\n\nUser: ${u.name}\nTemporary Password: ${res.data.tempPassword}\n\nPer 21 CFR Part 11, the user must update this credential upon next login.`);
      showNotification(`Password reset for ${u.name}`);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to reset password', true);
    }
  };

  const handleToggleUserActive = async (u) => {
    const nextState = !u.active;
    const actionName = nextState ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionName} user "${u.name}"?`)) return;
    try {
      await api.patch(`/users/${u.id}`, { active: nextState });
      showNotification(`User "${u.name}" ${actionName}d.`);
      fetchUsers();
    } catch (err) {
      showNotification(err.response?.data?.error || `Failed to ${actionName} user`, true);
    }
  };

  // ── USER GROUP HANDLERS ────────────────────────────────────────────
  const handleOpenAddGroup = () => {
    setEditingGroup(null);
    setGroupFormData({
      name: '',
      description: '',
      isActive: true,
      privileges: ['author', 'reviewer'],
      zones: ['01', '02'],
      folderAssignments: ['01 Trial Management', '02 Central Trial Documents'],
      members: []
    });
    setShowGroupModal(true);
  };

  const handleOpenEditGroup = (g) => {
    setEditingGroup(g);
    setGroupFormData({
      name: g.name || '',
      description: g.description || '',
      isActive: g.is_active !== 0,
      privileges: Array.isArray(g.privileges) ? g.privileges : [],
      zones: Array.isArray(g.zones) ? g.zones : [],
      folderAssignments: Array.isArray(g.folder_assignments) ? g.folder_assignments : [],
      members: Array.isArray(g.members) ? g.members : []
    });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: groupFormData.name,
        description: groupFormData.description,
        isActive: groupFormData.isActive,
        privileges: groupFormData.privileges,
        zones: groupFormData.zones,
        folderAssignments: groupFormData.folderAssignments,
        members: groupFormData.members
      };

      if (editingGroup) {
        await api.put(`/admin/user-groups/${editingGroup.id}`, payload);
        showNotification(`User Group "${groupFormData.name}" updated successfully.`);
      } else {
        await api.post('/admin/user-groups', payload);
        showNotification(`User Group "${groupFormData.name}" created successfully.`);
      }
      setShowGroupModal(false);
      fetchUserGroups();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to save user group', true);
    }
  };

  const handleDeleteGroup = async (g) => {
    if (!window.confirm(`Are you sure you want to delete user group "${g.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/admin/user-groups/${g.id}`);
      showNotification(`User group "${g.name}" deleted.`);
      fetchUserGroups();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to delete user group', true);
    }
  };

  // ── FUNCTIONAL ROLES HANDLERS ──────────────────────────────────────
  const handleOpenAddRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      description: '',
      capabilities: ['canView', 'canUpload']
    });
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (r) => {
    setEditingRole(r);
    setRoleFormData({
      name: r.name || '',
      description: r.description || '',
      capabilities: Array.isArray(r.capabilities) ? r.capabilities : []
    });
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await api.put(`/admin/functional-roles/${editingRole.id}`, {
          name: roleFormData.name,
          description: roleFormData.description,
          capabilities: roleFormData.capabilities
        });
        showNotification(`Functional role "${roleFormData.name}" updated.`);
      } else {
        await api.post('/admin/functional-roles', {
          name: roleFormData.name,
          description: roleFormData.description,
          capabilities: roleFormData.capabilities
        });
        showNotification(`Functional role "${roleFormData.name}" created.`);
      }
      setShowRoleModal(false);
      fetchFunctionalRoles();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to save role', true);
    }
  };

  const handleOpenAssignUsers = (r) => {
    setAssigningRole(r);
    // Find users who have this role
    const matchingUsers = users.filter(u => u.functional_roles?.includes(r.id)).map(u => u.id);
    setSelectedUserIdsForRole(matchingUsers);
  };

  const handleSaveRoleAssignment = async () => {
    if (!assigningRole) return;
    try {
      await api.post(`/admin/functional-roles/${assigningRole.id}/assign`, {
        userIds: selectedUserIdsForRole
      });
      showNotification(`Users successfully assigned to "${assigningRole.name}".`);
      setAssigningRole(null);
      fetchUsers();
      fetchFunctionalRoles();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to assign role', true);
    }
  };

  // ── FILTERS ────────────────────────────────────────────────────────
  const uniqueDepts = ['All', ...new Set([...users.map(u => u.dept), ...availableDepts.map(d => d.name)].filter(Boolean))];
  const uniqueRoles = ['All', ...new Set(users.map(u => u.role).filter(Boolean))];

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    const matchSearch = (u.name && u.name.toLowerCase().includes(q)) ||
                        (u.email && u.email.toLowerCase().includes(q)) ||
                        (u.designation && u.designation.toLowerCase().includes(q));
    const matchDept = selectedDeptFilter === 'All' || u.dept === selectedDeptFilter;
    const matchRole = selectedRoleFilter === 'All' || u.role === selectedRoleFilter;
    return matchSearch && matchDept && matchRole;
  });

  const filteredGroups = userGroups.filter(g => {
    const q = groupSearch.toLowerCase();
    return (g.name && g.name.toLowerCase().includes(q)) ||
           (g.description && g.description.toLowerCase().includes(q));
  });

  const filteredFunctionalRoles = functionalRoles.filter(r => {
    const q = roleSearch.toLowerCase();
    return (r.name && r.name.toLowerCase().includes(q)) ||
           (r.description && r.description.toLowerCase().includes(q));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            Security Administration Workspace (§8.5.1)
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            ICH GCP E6(R2) & 21 CFR Part 11 Enterprise Access Controls, User Groups & Clinical Roles
          </div>
        </div>

        {/* NOTIFICATION BANNERS */}
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
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'users' ? '#fff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'users' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'users' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <span>👤 User Management</span>
          <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'groups' ? '#fff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'groups' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'groups' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'groups' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <span>👥 User Groups & Privileges</span>
          <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            {userGroups.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('functional_roles')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'functional_roles' ? '#fff' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'functional_roles' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'functional_roles' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'functional_roles' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <span>🎖️ Functional Roles (21 Standard Roles)</span>
          <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
            {functionalRoles.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: USER MANAGEMENT (§8.5.1.1) ─────────────────────────── */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* TOOLBAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 300, maxWidth: 650 }}>
              <input
                type="text"
                placeholder="Search by name, email, or designation..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="modern-input"
                style={{ padding: '8px 14px', fontSize: 13 }}
              />
              <select
                value={selectedDeptFilter}
                onChange={e => setSelectedDeptFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
              >
                {uniqueDepts.map(d => (
                  <option key={d} value={d}>Dept: {d}</option>
                ))}
              </select>
              <select
                value={selectedRoleFilter}
                onChange={e => setSelectedRoleFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
              >
                {uniqueRoles.map(r => (
                  <option key={r} value={r}>Role: {r}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenAddUser}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13 }}
            >
              <span>+</span> Add New User (§8.5.1.1)
            </button>
          </div>

          {/* USERS TABLE */}
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>User & Contact</th>
                  <th>System Role</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Status</th>
                  <th>Functional Roles</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{u.email}</div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: u.role === 'System Administrator' ? '#fef3c7' : u.role === 'TMF Manager' ? '#e0f2fe' : '#f1f5f9',
                          color: u.role === 'System Administrator' ? '#92400e' : u.role === 'TMF Manager' ? '#0369a1' : '#475569'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.dept || '—'}</td>
                      <td>{u.designation || '—'}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: u.active ? '#16a34a' : '#dc2626'
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.active ? '#16a34a' : '#dc2626' }}></span>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                          {u.functional_roles && u.functional_roles.length > 0 ? (
                            u.functional_roles.map(rid => {
                              const rObj = functionalRoles.find(fr => fr.id === rid);
                              return (
                                <span key={rid} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#334155' }}>
                                  {rObj ? rObj.name : rid}
                                </span>
                              );
                            })
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>None</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            title="Edit User Details & Roles"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12, color: '#d97706', borderColor: '#fde68a' }}
                            title="Reset 21 CFR Part 11 Password"
                          >
                            🔑 Reset PWD
                          </button>
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12, color: u.active ? '#dc2626' : '#16a34a' }}
                            title={u.active ? 'Deactivate Access' : 'Reactivate Access'}
                          >
                            {u.active ? '⛔ Deactivate' : '✅ Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No clinical users found matching search filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: USER GROUPS & PRIVILEGES (§8.5.1.2) ─────────────────── */}
      {activeTab === 'groups' && (
        <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* TOOLBAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 350 }}>
              <input
                type="text"
                placeholder="Search user groups..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className="modern-input"
                style={{ padding: '8px 14px', fontSize: 13 }}
              />
            </div>
            <button
              onClick={handleOpenAddGroup}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13 }}
            >
              <span>+</span> Create User Group (§8.5.1.2)
            </button>
          </div>

          {/* GROUPS TABLE */}
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Group Name & Description</th>
                  <th>Members</th>
                  <th>Privileges Matrix (§8.5.1.2)</th>
                  <th>Assigned Folder Zones</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.length > 0 ? (
                  filteredGroups.map(g => (
                    <tr key={g.id}>
                      <td style={{ maxWidth: 220 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{g.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{g.description || 'No description provided'}</div>
                      </td>
                      <td>
                        <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                          👥 {g.member_count || (g.members?.length || 0)} members
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {g.privileges?.includes('author') && (
                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              ✍️ Author
                            </span>
                          )}
                          {g.privileges?.includes('reviewer') && (
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              🔍 Reviewer
                            </span>
                          )}
                          {g.privileges?.includes('approver') && (
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              ⚖️ Approver
                            </span>
                          )}
                          {g.privileges?.includes('downloader') && (
                            <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              📥 Downloader
                            </span>
                          )}
                          {g.privileges?.includes('blinded') && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              🔒 Blinded
                            </span>
                          )}
                          {(!g.privileges || g.privileges.length === 0) && (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>None</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 280 }}>
                          {g.folder_assignments && g.folder_assignments.length > 0 ? (
                            g.folder_assignments.map((f, i) => (
                              <span key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#334155' }}>
                                📁 {f}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Global (All Folders)</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: g.is_active !== 0 ? '#16a34a' : '#94a3b8'
                        }}>
                          {g.is_active !== 0 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEditGroup(g)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(g)}
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
                    <td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No user groups configured. Click "+ Create User Group" to initialize group security matrix.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: FUNCTIONAL ROLES SETUP (§8.5.1.3 & §8.5.1.4) ─────────── */}
      {activeTab === 'functional_roles' && (
        <div className="glass-panel" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* TOOLBAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 350 }}>
              <input
                type="text"
                placeholder="Search functional clinical roles..."
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                className="modern-input"
                style={{ padding: '8px 14px', fontSize: 13 }}
              />
            </div>
            <button
              onClick={handleOpenAddRole}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13 }}
            >
              <span>+</span> New Clinical Role
            </button>
          </div>

          {/* ROLES TABLE */}
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Role Name</th>
                  <th style={{ width: '33%' }}>Clinical Responsibility / Scope</th>
                  <th style={{ width: '25%' }}>System Capabilities</th>
                  <th style={{ width: '10%' }}>Assigned Users</th>
                  <th style={{ textAlign: 'right', width: '10%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFunctionalRoles.length > 0 ? (
                  filteredFunctionalRoles.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        {r.name}
                      </td>
                      <td style={{ fontSize: 13, color: '#475569' }}>
                        {r.description || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.capabilities && r.capabilities.length > 0 ? (
                            r.capabilities.map(cap => (
                              <span key={cap} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                {cap.replace('can', '')}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Read Only</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                          {r.user_count || 0} user(s)
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleOpenAssignUsers(r)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12, color: '#0284c7', borderColor: '#bae6fd' }}
                            title="Assign Users to Role"
                          >
                            👥 Assign
                          </button>
                          <button
                            onClick={() => handleOpenEditRole(r)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            title="Edit Role Scope"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No clinical roles found matching search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT USER (§8.5.1.1) ─────────────────────────── */}
      {showAddUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                {editingUser ? 'Edit User Credentials & Roles' : 'Add New Clinical User (§8.5.1.1)'}
              </h3>
              <button onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Robert Vance"
                  value={userFormData.name}
                  onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. r.vance@pharma.com"
                  value={userFormData.email}
                  onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>System Role *</label>
                  <select
                    value={userFormData.role}
                    onChange={e => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="modern-input"
                    style={{ background: '#fff' }}
                  >
                    {CLINICAL_SYSTEM_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Department</label>
                  <input
                    type="text"
                    list="availableDeptsList"
                    placeholder="e.g. Clinical Operations"
                    value={userFormData.dept}
                    onChange={e => setUserFormData({ ...userFormData, dept: e.target.value })}
                    className="modern-input"
                  />
                  <datalist id="availableDeptsList">
                    {availableDepts.map(d => (
                      <option key={d.id || d.code} value={d.name}>{d.name} ({d.code})</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Designation</label>
                <input
                  type="text"
                  list="availableDesigsList"
                  placeholder="e.g. Senior Clinical Research Associate"
                  value={userFormData.designation}
                  onChange={e => setUserFormData({ ...userFormData, designation: e.target.value })}
                  className="modern-input"
                />
                <datalist id="availableDesigsList">
                  {availableDesigs.map(d => (
                    <option key={d.id || d.code} value={d.name}>{d.name} ({d.code})</option>
                  ))}
                </datalist>
              </div>

              {!editingUser && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Initial Password (defaults to Clinion@123)</label>
                  <input
                    type="password"
                    placeholder="Leave blank for Clinion@123"
                    value={userFormData.password}
                    onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="modern-input"
                  />
                </div>
              )}

              {/* FUNCTIONAL ROLES SELECTION */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Assigned Functional Roles (§8.5.1.4)
                </label>
                <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {functionalRoles.map(fr => {
                    const isChecked = userFormData.functional_roles.includes(fr.id);
                    return (
                      <label key={fr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setUserFormData({ ...userFormData, functional_roles: [...userFormData.functional_roles, fr.id] });
                            } else {
                              setUserFormData({ ...userFormData, functional_roles: userFormData.functional_roles.filter(id => id !== fr.id) });
                            }
                          }}
                        />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{fr.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVE TOGGLE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="userActiveToggle"
                  checked={userFormData.active}
                  onChange={e => setUserFormData({ ...userFormData, active: e.target.checked })}
                />
                <label htmlFor="userActiveToggle" style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  User Account Active (Permit login access)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT USER GROUP (§8.5.1.2) ───────────────────── */}
      {showGroupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                {editingGroup ? 'Edit User Group & Privileges' : 'Create User Group (§8.5.1.2)'}
              </h3>
              <button onClick={() => setShowGroupModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clinical Operations Approvers"
                  value={groupFormData.name}
                  onChange={e => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Group Description</label>
                <textarea
                  rows="2"
                  placeholder="Briefly describe the clinical responsibilities of this group..."
                  value={groupFormData.description}
                  onChange={e => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  className="modern-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* PRIVILEGES CHECKBOX MATRIX (§8.5.1.2) */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Group Privileges (§8.5.1.2)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  {[
                    { id: 'author', label: '✍️ Authors' },
                    { id: 'reviewer', label: '🔍 Reviewers' },
                    { id: 'approver', label: '⚖️ Approvers' },
                    { id: 'downloader', label: '📥 Downloaders' },
                    { id: 'blinded', label: '🔒 Blinded' }
                  ].map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={groupFormData.privileges.includes(p.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setGroupFormData({ ...groupFormData, privileges: [...groupFormData.privileges, p.id] });
                          } else {
                            setGroupFormData({ ...groupFormData, privileges: groupFormData.privileges.filter(x => x !== p.id) });
                          }
                        }}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* FOLDER / ZONE ASSIGNMENTS (§8.5.1.2 Folders Tab) */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  DIA TMF Reference Model Folder Assignments (§8.5.1.2)
                </label>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DIA_ZONES_LIST.map(zone => {
                    const isAssigned = groupFormData.folderAssignments.includes(zone.name);
                    return (
                      <label key={zone.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={e => {
                            if (e.target.checked) {
                              setGroupFormData({
                                ...groupFormData,
                                zones: [...groupFormData.zones, zone.code],
                                folderAssignments: [...groupFormData.folderAssignments, zone.name]
                              });
                            } else {
                              setGroupFormData({
                                ...groupFormData,
                                zones: groupFormData.zones.filter(z => z !== zone.code),
                                folderAssignments: groupFormData.folderAssignments.filter(f => f !== zone.name)
                              });
                            }
                          }}
                        />
                        <span>📁 {zone.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* GROUP MEMBERS SELECTION */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Group Members ({groupFormData.members.length} selected)
                </label>
                <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {users.map(u => {
                    const isMember = groupFormData.members.includes(u.id);
                    return (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={e => {
                            if (e.target.checked) {
                              setGroupFormData({ ...groupFormData, members: [...groupFormData.members, u.id] });
                            } else {
                              setGroupFormData({ ...groupFormData, members: groupFormData.members.filter(id => id !== u.id) });
                            }
                          }}
                        />
                        <span>{u.name} ({u.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingGroup ? 'Save User Group' : 'Create User Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT FUNCTIONAL ROLE (§8.5.1.3) ───────────────── */}
      {showRoleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                {editingRole ? 'Edit Functional Role Scope' : 'Add New Clinical Functional Role (§8.5.1.3)'}
              </h3>
              <button onClick={() => setShowRoleModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Role Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clinical Trial Safety Officer"
                  value={roleFormData.name}
                  onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  className="modern-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Description & GCP Scope</label>
                <textarea
                  rows="3"
                  placeholder="Scope of document review, approval, or archiving responsibilities..."
                  value={roleFormData.description}
                  onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  className="modern-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  System Capabilities
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  {CAPABILITIES_LIST.map(cap => (
                    <label key={cap.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={roleFormData.capabilities.includes(cap.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setRoleFormData({ ...roleFormData, capabilities: [...roleFormData.capabilities, cap.id] });
                          } else {
                            setRoleFormData({ ...roleFormData, capabilities: roleFormData.capabilities.filter(c => c !== cap.id) });
                          }
                        }}
                      />
                      <span>{cap.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ASSIGN USERS TO ROLE (§8.5.1.4) ────────────────────── */}
      {assigningRole && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                  Assign Users to Role (§8.5.1.4)
                </h3>
                <div style={{ fontSize: 13, color: '#0284c7', fontWeight: 600, marginTop: 2 }}>
                  {assigningRole.name}
                </div>
              </div>
              <button onClick={() => setAssigningRole(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                Select personnel qualified to exercise the clinical responsibilities of <b>{assigningRole.name}</b>.
              </div>
              <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.map(u => {
                  const isChecked = selectedUserIdsForRole.includes(u.id);
                  return (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: isChecked ? '#f0f9ff' : 'transparent', borderRadius: 6, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedUserIdsForRole([...selectedUserIdsForRole, u.id]);
                            } else {
                              setSelectedUserIdsForRole(selectedUserIdsForRole.filter(id => id !== u.id));
                            }
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{u.email} • {u.dept || u.role}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: '#0284c7', fontWeight: 600 }}>{u.role}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setAssigningRole(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoleAssignment}
                className="btn-primary"
              >
                Confirm Assignment ({selectedUserIdsForRole.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
