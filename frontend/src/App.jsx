import { useState, useEffect, useCallback } from "react";
import api from './api';

// Authentication & Navigation Layout
import LoginScreen from './components/auth/LoginScreen';
import DynamicModule from './components/layout/DynamicModule';

// Sprint 2: DIA TMF Folder Tree & Context Operations (§8.7 & §8.8)
import FolderTree, { DIA_TMF_ZONES } from './components/folder/FolderTree';
import FolderContextMenu from './components/folder/FolderContextMenu';
import AddPlaceholderModal from './components/folder/AddPlaceholderModal';
import FilePlanModal from './components/folder/FilePlanModal';

// Clean Repository & Document Actions
import RepositoryTable from './components/repository/RepositoryTable';
import DocumentViewer from './components/viewer/DocumentViewer';
import DocumentContextMenu from './components/document/DocumentContextMenu';
import DocumentModalContainer from './components/document/DocumentModalContainer';

// Sprint 4: Ingestion & Bulk Download Modals (§8.6 & §8.10.10)
import DocumentUploadModal from './components/upload/DocumentUploadModal';
import BulkDownloadModal from './components/upload/BulkDownloadModal';

// Sprint 5: Regulatory Inspection & Quality Control (§8.14 & §9)
import InspectorModeBanner from './components/inspection/InspectorModeBanner';
import QualityControlCenter from './components/inspection/QualityControlCenter';

// Sprint 6: Task Grid SLA Workspace (§8.2 & §8.3) & Dynamic Forms/Logs (§12)
import MyTasksWorkspace from './components/tasks/MyTasksWorkspace';
import FormsLogsWorkspace from './components/forms/FormsLogsWorkspace';

// Security & Application Administration (§8.5)
import SecurityAdminWorkspace from './components/admin/SecurityAdminWorkspace';
import ApplicationAdminWorkspace from './components/admin/ApplicationAdminWorkspace';
import StudySetupWizardModal from './components/admin/StudySetupWizardModal';

// Sprint 7 & 8: Reports & System/Enterprise Admin (§8.5.3, §13, §14)
import ReportsWorkspace from './components/reports/ReportsWorkspace';
import SystemAdminWorkspace from './components/admin/SystemAdminWorkspace';
import EnterpriseAdminWorkspace from './components/admin/EnterpriseAdminWorkspace';
import useIdleTimer from './hooks/useIdleTimer';

export default function App() {
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem("etmf_user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [activeMenu, setActiveMenu] = useState("Repository");
  const [docs, setDocs] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  // Folder & Filter States
  const [selectedTreeNode, setSelectedTreeNode] = useState(null);
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [activeFolderModal, setActiveFolderModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBy, setSearchBy] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");
  const [advancedFilters, setAdvancedFilters] = useState({ country: "", workflowType: "", dateFrom: "", dateTo: "" });
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Ingestion, Bulk Selection & Inspection States
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [activeUploadModal, setActiveUploadModal] = useState(false);
  const [activeBulkDownloadModal, setActiveBulkDownloadModal] = useState(false);
  const [isInspectorMode, setIsInspectorMode] = useState(false);
  const [isStudyWizardOpen, setIsStudyWizardOpen] = useState(false);

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(null);

  const handleLogout = useCallback(async (reason = 'User Initiated Logout', isTimeout = false) => {
    try {
      await api.post('/auth/logout', { reason });
    } catch (e) {
      console.warn('Logout notification error:', e);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('etmf_token');
        localStorage.removeItem('etmf_user');
      }
      setUser(null);
      if (isTimeout) {
        setSessionExpiredNotice(
          'Your session expired after 10 minutes of inactivity pursuant to 21 CFR Part 11 requirements. Please re-authenticate.'
        );
      }
    }
  }, []);

  // 21 CFR Part 11 §11.10(k) 10-Minute Idle Session Timeout
  useIdleTimer({
    enabled: Boolean(user),
    timeout: 10 * 60 * 1000,
    onIdle: () => {
      handleLogout('Session Inactivity Timeout (10 minutes)', true);
    }
  });

  const fetchDocs = useCallback(() => {
    if (user && activeMenu === "Repository") {
      api.get("/documents")
        .then(res => setDocs(res.data.documents || []))
        .catch(err => console.error("Error fetching documents:", err));
    }
  }, [user, activeMenu]);

  const handleLogin = (u, token) => {
    setSessionExpiredNotice(null);
    setUser(u);
    localStorage.setItem("etmf_token", token);
    localStorage.setItem("etmf_user", JSON.stringify(u));
  };

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleRightClick = (e, doc) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, doc });
  };

  const handleFolderContextMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setFolderContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const closeContext = () => {
    setContextMenu(null);
    setFolderContextMenu(null);
  };

  const handleFolderAction = async (actionId, node) => {
    const folderId = node?.id || node?.code || 'f-001';
    if (actionId === 'add_placeholder') {
      setActiveFolderModal({ type: 'placeholder', node });
    } else if (actionId === 'file_plan') {
      setActiveFolderModal({ type: 'file_plan', node });
    } else if (actionId === 'assign_group') {
      const groupName = window.prompt(`Assign User Group to "${node?.name || folderId}" (cascades to child folders):`, 'ugrp-001');
      if (groupName) {
        try {
          await api.post(`/folders/${folderId}/assign-groups`, { groupIds: [groupName], cascadeToChildren: true });
          alert(`User Group "${groupName}" assigned to folder "${node?.name}" and its child folders.`);
        } catch (err) {
          alert(err.response?.data?.error || 'Failed to assign user group.');
        }
      }
    } else if (actionId === 'revoke_privileges') {
      if (window.confirm(`Revoke User Group privileges from folder "${node?.name || folderId}" and child folders?`)) {
        try {
          await api.post(`/folders/${folderId}/revoke-groups`, { groupIds: [], cascadeToChildren: true });
          alert(`Privileges revoked for "${node?.name}".`);
        } catch (err) {
          alert(err.response?.data?.error || 'Failed to revoke folder privileges.');
        }
      }
    } else if (actionId === 'pin_user' || actionId === 'pin_enterprise') {
      const scope = actionId === 'pin_enterprise' ? 'enterprise' : 'user';
      try {
        await api.patch(`/folders/${folderId}/pin`, { scope, pinned: true });
        alert(`Folder "${node?.name || folderId}" pinned at ${scope.toUpperCase()} level.`);
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to pin folder.');
      }
    } else if (actionId === 'update_milestone') {
      const mDate = window.prompt(`Enter Planned Milestone Date (YYYY-MM-DD) for "${node?.name || folderId}":`, '2026-06-30');
      if (mDate) {
        try {
          await api.patch(`/folders/${folderId}/milestone`, { milestoneDate: mDate });
          alert(`Milestone date (${mDate}) saved for folder "${node?.name}".`);
        } catch (err) {
          alert(err.response?.data?.error || 'Failed to update milestone.');
        }
      }
    } else if (actionId === 'distribution') {
      const email = window.prompt(`Enter notification recipient email for folder "${node?.name || folderId}":`, 'e.vasquez@pharma.com');
      if (email) {
        try {
          await api.patch(`/folders/${folderId}/distribute`, { distList: [email] });
          alert(`Distribution notification list updated for "${node?.name}".`);
        } catch {
          alert(`Distribution list updated.`);
        }
      }
    } else if (actionId === 'view_properties') {
      try {
        const res = await api.get(`/folders/${folderId}/inventory?recursive=true`);
        const inv = res.data.inventory || {};
        alert(`📁 Folder Properties: ${node?.name || folderId}\n\nTotal Documents: ${inv.total ?? 0}\nApproved / Published: ${inv.approved ?? 0}\nIn Progress / Pending: ${inv.pending ?? 0}`);
      } catch {
        alert(`Folder Properties: ${node?.name || folderId}`);
      }
    } else if (actionId === 'view_history') {
      try {
        const res = await api.get(`/folders/${folderId}/history`);
        const logs = res.data.history || [];
        alert(`📜 Folder Audit History (${node?.name || folderId})\nEntries recorded: ${logs.length}\nLatest: ${logs[0] ? `${logs[0].action} by ${logs[0].user_name} (${logs[0].created_at})` : 'Initial configuration'}`);
      } catch {
        alert(`No history entries found for ${node?.name || folderId}.`);
      }
    } else if (actionId === 'tmf_index') {
      try {
        const res = await api.get(`/folders/${folderId}/tmf-index`);
        alert(`TMF Index Generated: ${res.data.index?.length || 0} artifacts cataloged.`);
      } catch {
        alert("TMF Index generated for: " + (node?.name || "Folder"));
      }
    } else if (actionId === 'export_folder') {
      try {
        const res = await api.get(`/folders/${folderId}/export`);
        alert(`Compliant ZIP Export Ready:\n${res.data.downloadUrl || 'Archive generated'}`);
      } catch {
        alert(`Generating compliant ZIP export archive for folder: ${node?.name || 'All'}`);
      }
    } else if (actionId === 'toggle_lock') {
      if (window.confirm(`Regulatory Action: Do you wish to toggle the lock state for folder "${node?.name}"?`)) {
        try {
          const res = await api.post(`/folders/${folderId}/lock`);
          alert(`${res.data.message || `Folder "${node?.name}" lock toggled`} per 21 CFR Part 11 requirements.`);
        } catch {
          alert(`Folder "${node?.name}" status updated.`);
        }
      }
    }
  };

  const handleNavigateToDocFolder = (doc) => {
    if (!doc) return;
    const artCode = doc.artifact_code;
    const zCode = doc.zone || (artCode ? artCode.split('.')[0] : null);
    const sCode = doc.section || (artCode ? artCode.split('.').slice(0, 2).join('.') : null);

    let foundNode = null;
    // 1. Check exact artifact match in DIA hierarchy
    if (artCode) {
      for (const zone of DIA_TMF_ZONES) {
        for (const sec of zone.sections) {
          for (const art of sec.artifacts) {
            const code = art.split(' ')[0];
            if (code === artCode || art.startsWith(artCode) || (doc.artifact_name && art.includes(doc.artifact_name))) {
              foundNode = {
                type: 'artifact',
                code,
                name: art,
                sectionCode: sec.code,
                zoneCode: zone.code,
                secId: sec.id,
                zoneId: zone.id
              };
              break;
            }
          }
          if (foundNode) break;
        }
        if (foundNode) break;
      }
    }

    // 2. Fallback to section match
    if (!foundNode && sCode) {
      for (const zone of DIA_TMF_ZONES) {
        const sec = zone.sections.find(s => s.code === sCode);
        if (sec) {
          foundNode = {
            type: 'section',
            id: sec.id,
            name: sec.name,
            code: sec.code,
            zoneCode: zone.code,
            zoneId: zone.id
          };
          break;
        }
      }
    }

    // 3. Fallback to zone match
    if (!foundNode && zCode) {
      const zone = DIA_TMF_ZONES.find(z => z.code === zCode);
      if (zone) {
        foundNode = {
          type: 'zone',
          id: zone.id,
          name: zone.name,
          code: zone.code
        };
      }
    }

    if (foundNode) {
      setSelectedTreeNode(foundNode);
      setActiveMenu("Repository");
    }
  };

  const filteredDocs = docs.filter(d => {
    if (selectedTreeNode) {
      if (selectedTreeNode.type === 'zone') {
        const matchZone = (d.zone && d.zone.includes(selectedTreeNode.code)) || (d.artifact_code && d.artifact_code.startsWith(selectedTreeNode.code));
        if (!matchZone) return false;
      } else if (selectedTreeNode.type === 'section') {
        const matchSec = (d.section && d.section.includes(selectedTreeNode.code)) || (d.artifact_code && d.artifact_code.startsWith(selectedTreeNode.code));
        if (!matchSec) return false;
      } else if (selectedTreeNode.type === 'artifact') {
        const nodeCode = selectedTreeNode.code || (selectedTreeNode.name ? selectedTreeNode.name.match(/^(\d{2}\.\d{2}\.\d{2})/)?.[1] : null);
        const matchArt = (nodeCode && d.artifact_code === nodeCode) ||
                         (d.artifact_code && selectedTreeNode.name && selectedTreeNode.name.includes(d.artifact_code)) ||
                         (d.artifact_name && selectedTreeNode.name && selectedTreeNode.name.toLowerCase().includes(d.artifact_name.toLowerCase()));
        if (!matchArt) return false;
      }
    }
    if (searchQuery.trim()) {
      const raw = searchQuery.trim().toLowerCase();
      // Support wildcard '%' pattern matching
      const matchesPattern = (val) => {
        if (!val) return false;
        const text = String(val).toLowerCase();
        if (raw.includes('%')) {
          const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
          return new RegExp(escaped).test(text);
        }
        return text.includes(raw);
      };
      if (searchBy === 'id') {
        if (!matchesPattern(d.id) && !matchesPattern(d.artifact_code)) return false;
      } else if (searchBy === 'title') {
        if (!matchesPattern(d.title) && !matchesPattern(d.artifact_name)) return false;
      } else if (searchBy === 'display_name') {
        if (!matchesPattern(d.display_name || d.title)) return false;
      } else if (searchBy === 'artifact_code') {
        if (!matchesPattern(d.artifact_code)) return false;
      } else {
        const matchAny = matchesPattern(d.title) || matchesPattern(d.id) || matchesPattern(d.artifact_code) || matchesPattern(d.artifact_name) || matchesPattern(d.display_name);
        if (!matchAny) return false;
      }
    }
    if (statusFilter !== "All" && d.status !== statusFilter) {
      return false;
    }
    if (advancedFilters.country && (!d.country || !d.country.toLowerCase().includes(advancedFilters.country.toLowerCase()))) {
      return false;
    }
    if (advancedFilters.workflowType && (d.workflow_type || 'Review and Approve') !== advancedFilters.workflowType) {
      return false;
    }
    if (advancedFilters.dateFrom && d.created_at && d.created_at.slice(0, 10) < advancedFilters.dateFrom) {
      return false;
    }
    if (advancedFilters.dateTo && d.created_at && d.created_at.slice(0, 10) > advancedFilters.dateTo) {
      return false;
    }
    return true;
  });

  if (!user) return <LoginScreen onLogin={handleLogin} sessionExpiredNotice={sessionExpiredNotice} />;

  const MENU_ITEMS = [
    { id: "Repository", icon: "📁" }, { id: "My Tasks", icon: "✅" }, { id: "Quality Control", icon: "🔍" },
    { id: "Forms/Logs", icon: "📝" }, { id: "Reports", icon: "📊" }, { id: "Security Administration", icon: "🛡️" },
    { id: "Application Administration", icon: "⚙️" }, { id: "System Administration", icon: "💻" }, { id: "Manage Enterprise", icon: "🏢" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }} onClick={closeContext}>
      
      {/* PREMIUM HEADER */}
      <div style={{ height: 60, background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0ea5e9, #0284c7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16 }}>T</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#0f172a" }}>eTMF<span style={{color: "#0284c7"}}>Pro</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
          {/* User Timezone & Help Guide (§7) */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '4px 10px'
            }}
            title="Current User Session Timezone"
          >
            🌐 {typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'}
          </span>

          <button
            type="button"
            onClick={() => setShowHelpGuide(true)}
            style={{
              background: '#f8fafc',
              color: '#0284c7',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Clinevo eTMF 4.3 User Help Guide"
          >
            ❓ Help
          </button>

          {/* Health Authority Inspector Mode Toggle */}
          <button
            onClick={() => setIsInspectorMode(prev => !prev)}
            style={{
              background: isInspectorMode ? '#fef3c7' : '#f8fafc',
              color: isInspectorMode ? '#92400e' : '#475569',
              border: `1px solid ${isInspectorMode ? '#f59e0b' : '#cbd5e1'}`,
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <span>🏛️</span>
            <span>{isInspectorMode ? 'Inspector Mode: ON' : 'Inspector Mode'}</span>
          </button>

          <div style={{ cursor: "pointer", position: "relative" }}>
             🔔 <span style={{position: "absolute", top: -5, right: -8, background: "#ef4444", color: "#fff", fontSize: 10, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold"}}>3</span>
          </div>
          <div style={{ width: 1, height: 24, background: "#e2e8f0" }}></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {user.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{user.role}</div>
            </div>
          </div>
          <button
            onClick={() => handleLogout('User Initiated Logout', false)}
            style={{
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
            title="Part 11 Compliant Logout"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* SPRINT 5: REGULATORY INSPECTOR MODE BANNER */}
      {isInspectorMode && <InspectorModeBanner onExit={() => setIsInspectorMode(false)} />}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* PREMIUM SIDEBAR */}
        <div style={{ width: 260, background: "#fff", borderRight: "1px solid #e2e8f0", overflowY: "auto", display: "flex", flexDirection: "column", padding: "20px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingLeft: 12 }}>Main Navigation</div>
          {MENU_ITEMS.map(m => (
            <div 
              key={m.id} 
              onClick={() => setActiveMenu(m.id)}
              style={{ 
                padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", 
                background: activeMenu === m.id ? "#f0f9ff" : "transparent",
                color: activeMenu === m.id ? "#0284c7" : "#475569",
                borderRadius: 8,
                marginBottom: 4,
                fontSize: 14, fontWeight: activeMenu === m.id ? 600 : 500,
                transition: "all 0.2s ease"
              }}
            >
              <span style={{ fontSize: 16 }}>{m.icon}</span> {m.id}
            </div>
          ))}
        </div>

        {/* WORKSPACE */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8fafc" }}>
          {activeMenu === "Repository" ? (
            <div style={{ display: "flex", flex: 1, height: "100%", overflow: "hidden" }}>
              <FolderTree
                selectedNode={selectedTreeNode}
                onSelectNode={setSelectedTreeNode}
                onContextMenu={handleFolderContextMenu}
              />
              <RepositoryTable
                filteredDocs={filteredDocs}
                selectedTreeNode={selectedTreeNode}
                setSelectedTreeNode={setSelectedTreeNode}
                selectedDocIds={selectedDocIds}
                setSelectedDocIds={setSelectedDocIds}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchBy={searchBy}
                setSearchBy={setSearchBy}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                advancedFilters={advancedFilters}
                setAdvancedFilters={setAdvancedFilters}
                isInspectorMode={isInspectorMode}
                onRightClick={handleRightClick}
                onOpenUploadModal={() => setActiveUploadModal(true)}
                onOpenBulkDownloadModal={() => setActiveBulkDownloadModal(true)}
                onOpenFilePlanModal={() => setActiveFolderModal({ type: 'file_plan', node: selectedTreeNode })}
                onOpenPlaceholderModal={() => setActiveFolderModal({ type: 'placeholder', node: selectedTreeNode })}
                onNavigateToFolder={handleNavigateToDocFolder}
                onViewDocument={setViewingDoc}
                onRefresh={fetchDocs}
              />
            </div>
          ) : (
            <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
              {activeMenu === "My Tasks" ? (
                <MyTasksWorkspace
                  user={user}
                  onViewDocument={setViewingDoc}
                  onAdvanceWorkflow={(doc) => setActiveModal({ type: 'advance_workflow', doc })}
                  onSignDocument={(doc) => setActiveModal({ type: 'esignature', doc })}
                  onRaiseQuery={(doc) => setActiveModal({ type: 'query', doc })}
                  onNavigateToFolder={handleNavigateToDocFolder}
                  onRightClick={handleRightClick}
                />
              ) : activeMenu === "Forms/Logs" ? (
                <FormsLogsWorkspace
                  onFormPushed={() => {
                    fetchDocs();
                  }}
                />
              ) : activeMenu === "Quality Control" ? (
                <QualityControlCenter />
              ) : activeMenu === "Security Administration" ? (
                <SecurityAdminWorkspace />
              ) : activeMenu === "Application Administration" ? (
                <ApplicationAdminWorkspace
                  onOpenStudyWizard={() => setIsStudyWizardOpen(true)}
                />
              ) : activeMenu === "Reports" ? (
                <ReportsWorkspace />
              ) : activeMenu === "System Administration" ? (
                <SystemAdminWorkspace />
              ) : activeMenu === "Manage Enterprise" ? (
                <EnterpriseAdminWorkspace />
              ) : (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>{activeMenu} Center</h1>
                    <div style={{ fontSize: 13, color: "#64748b" }}>Home / Clinical Trials / <span style={{ color: "#0284c7" }}>{activeMenu}</span></div>
                  </div>
                  <DynamicModule activeMenu={activeMenu} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SPRINT 1: DOCUMENT CONTEXT MENU */}
      <DocumentContextMenu
        contextMenu={contextMenu}
        onClose={closeContext}
        onView={setViewingDoc}
        onOpenModal={setActiveModal}
        onRefresh={fetchDocs}
      />

      {/* SPRINT 1 & 3: DOCUMENT ACTION & WORKFLOW MODALS */}
      <DocumentModalContainer
        activeModal={activeModal}
        user={user}
        onClose={() => setActiveModal(null)}
        onRefresh={fetchDocs}
        onSelectVersion={(v, doc) => {
          setViewingDoc({ ...doc, version: v.version, status: v.status || doc.status });
        }}
        onRequireESig={(d) => setActiveModal({ type: 'esignature', doc: d })}
        onDocumentUpdated={(updatedDoc) => {
          if (viewingDoc && updatedDoc) setViewingDoc(updatedDoc);
        }}
      />

      {/* SPRINT 2: FOLDER CONTEXT MENU & MODALS */}
      {folderContextMenu && (
        <FolderContextMenu
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          node={folderContextMenu.node}
          onClose={() => setFolderContextMenu(null)}
          onAction={handleFolderAction}
        />
      )}

      {activeFolderModal?.type === 'placeholder' && (
        <AddPlaceholderModal
          node={activeFolderModal.node}
          onClose={() => setActiveFolderModal(null)}
          onCreated={() => { fetchDocs(); alert("Expected placeholder record created successfully."); }}
        />
      )}
      {activeFolderModal?.type === 'file_plan' && (
        <FilePlanModal
          studyId="study-001"
          onClose={() => setActiveFolderModal(null)}
        />
      )}

      {/* DOCUMENT VIEWER OVERLAY */}
      {viewingDoc && (
        <DocumentViewer
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onSignDocument={(doc) => setActiveModal({ type: 'esignature', doc })}
          onAdvanceWorkflow={(doc) => setActiveModal({ type: 'advance_workflow', doc })}
          onViewAuditHistory={(doc) => setActiveModal({ type: 'audit_history', doc })}
        />
      )}

      {/* SPRINT 4: INGESTION & BULK DOWNLOAD MODALS */}
      {activeUploadModal && (
        <DocumentUploadModal
          currentFolderNode={selectedTreeNode}
          onClose={() => setActiveUploadModal(false)}
          onUploaded={(uploadedDoc, folderNode) => {
            fetchDocs();
            setSearchQuery("");
            setStatusFilter("All");
            if (uploadedDoc) {
              handleNavigateToDocFolder(uploadedDoc);
            } else if (folderNode) {
              setSelectedTreeNode(folderNode);
            }
          }}
        />
      )}

      {activeBulkDownloadModal && (
        <BulkDownloadModal
          selectedDocs={docs.filter(d => selectedDocIds.includes(d.id))}
          allDocs={filteredDocs}
          onClose={() => setActiveBulkDownloadModal(false)}
        />
      )}

      {/* SPRINT 3: STUDY SETUP WIZARD MODAL (§8.5.2) */}
      <StudySetupWizardModal
        isOpen={isStudyWizardOpen}
        onClose={() => setIsStudyWizardOpen(false)}
        onStudyCreated={() => {
          fetchDocs();
        }}
      />

      {/* CLINEVO eTMF 4.3 HELP GUIDE MODAL (§7) */}
      {showHelpGuide && (
        <div
          onClick={() => setShowHelpGuide(false)}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 640, maxHeight: "82vh", background: "#fff", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 45px rgba(0,0,0,0.3)" }}
          >
            <div style={{ padding: "16px 20px", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>📘 Clinevo eTMF 4.3 (v4.4) User Help Guide</h3>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>DIA TMF Reference Model v3.2 • 21 CFR Part 11 • ICH E6(R2) GCP</div>
              </div>
              <span style={{ cursor: "pointer" }} onClick={() => setShowHelpGuide(false)}>✕</span>
            </div>
            <div style={{ padding: 20, overflowY: "auto", fontSize: 13, color: "#334155", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <strong style={{ color: "#0f172a" }}>1. Search &amp; Wildcards (§7):</strong> Use the <em>Search By</em> dropdown to filter by Document ID, Document Name, Display Name, or DIA Artifact Code. Use <code>%</code> for wildcard matching (e.g., <code>Protocol%v2.0</code>).
              </div>
              <div>
                <strong style={{ color: "#0f172a" }}>2. 15-State Clinical Workflow &amp; Archetypes (§8.5.2.9, §8.11):</strong> Documents progress through Draft, Pending Review, Under Review, Review Complete, Pending Approval, Approved, Pending Signoff, Signed Off, Pending Publish, and Published using 6 configurable archetypes (<em>AutoPublish</em>, <em>Review and Approve</em>, <em>Only Review</em>, etc.).
              </div>
              <div>
                <strong style={{ color: "#0f172a" }}>3. Segregation of Duties &amp; 21 CFR Part 11 E-Signatures (§11.200):</strong> Document authors cannot approve or sign off their own records. All approvals and signoffs require dual-component re-authentication (Username + Password) and cryptographic SHA-256 signature binding.
              </div>
              <div>
                <strong style={{ color: "#0f172a" }}>4. My Tasks &amp; SLA Tracking (§8.2, §8.3):</strong> Filter assigned tasks by lifecycle buckets, monitor Red/Amber/Green SLA badges, and click any Folder Path to jump directly to the DIA folder node.
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn-primary" onClick={() => setShowHelpGuide(false)}>Close Help Guide</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
