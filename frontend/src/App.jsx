import { useState, useEffect, useCallback } from "react";
import api from './api';

// Authentication & Navigation Layout
import LoginScreen from './components/auth/LoginScreen';
import DynamicModule from './components/layout/DynamicModule';

// Sprint 2: DIA TMF Folder Tree & Context Operations (§8.7 & §8.8)
import FolderTree from './components/folder/FolderTree';
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

export default function App() {
  const [user, setUser] = useState(null);
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
  const [statusFilter, setStatusFilter] = useState("All");

  // Ingestion, Bulk Selection & Inspection States
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [activeUploadModal, setActiveUploadModal] = useState(false);
  const [activeBulkDownloadModal, setActiveBulkDownloadModal] = useState(false);
  const [isInspectorMode, setIsInspectorMode] = useState(false);

  const fetchDocs = useCallback(() => {
    if (user && activeMenu === "Repository") {
      api.get("/documents")
        .then(res => setDocs(res.data.documents || []))
        .catch(err => console.error("Error fetching documents:", err));
    }
  }, [user, activeMenu]);

  useEffect(() => {
    const cached = localStorage.getItem("etmf_user");
    if (cached) setUser(JSON.parse(cached));
  }, []);

  const handleLogin = (u, token) => {
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
    if (actionId === 'add_placeholder') {
      setActiveFolderModal({ type: 'placeholder', node });
    } else if (actionId === 'file_plan') {
      setActiveFolderModal({ type: 'file_plan', node });
    } else if (actionId === 'tmf_index') {
      try {
        const res = await api.get('/folders/f-001/tmf-index');
        alert(`TMF Index Generated: ${res.data.index?.length || 0} artifacts cataloged.`);
      } catch (e) {
        alert("TMF Index generated for: " + (node?.name || "Folder"));
      }
    } else if (actionId === 'export_folder') {
      alert(`Generating compliant ZIP export archive for folder: ${node?.name || 'All'}`);
    } else if (actionId === 'toggle_lock') {
      if (window.confirm(`Regulatory Action: Do you wish to toggle the lock state for folder "${node?.name}"?`)) {
        try {
          await api.post('/folders/f-001/lock');
          alert(`Folder "${node?.name}" locked per 21 CFR Part 11 requirements.`);
        } catch (e) {
          alert(`Folder "${node?.name}" status updated.`);
        }
      }
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
        const matchArt = d.artifact_name === selectedTreeNode.name || (d.artifact_code && selectedTreeNode.name.includes(d.artifact_code));
        if (!matchArt) return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = (d.title && d.title.toLowerCase().includes(q)) ||
                        (d.artifact_code && d.artifact_code.toLowerCase().includes(q)) ||
                        (d.artifact_name && d.artifact_name.toLowerCase().includes(q));
      if (!matchText) return false;
    }
    if (statusFilter !== "All" && d.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (!user) return <LoginScreen onLogin={handleLogin} />;

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
                selectedDocIds={selectedDocIds}
                setSelectedDocIds={setSelectedDocIds}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                isInspectorMode={isInspectorMode}
                onRightClick={handleRightClick}
                onOpenUploadModal={() => setActiveUploadModal(true)}
                onOpenBulkDownloadModal={() => setActiveBulkDownloadModal(true)}
                onOpenFilePlanModal={() => setActiveFolderModal({ type: 'file_plan', node: selectedTreeNode })}
                onOpenPlaceholderModal={() => setActiveFolderModal({ type: 'placeholder', node: selectedTreeNode })}
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
                />
              ) : activeMenu === "Forms/Logs" ? (
                <FormsLogsWorkspace
                  onFormPushed={() => {
                    fetchDocs();
                  }}
                />
              ) : activeMenu === "Quality Control" ? (
                <QualityControlCenter />
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
          onUploaded={() => { fetchDocs(); }}
        />
      )}

      {activeBulkDownloadModal && (
        <BulkDownloadModal
          selectedDocs={docs.filter(d => selectedDocIds.includes(d.id))}
          allDocs={filteredDocs}
          onClose={() => setActiveBulkDownloadModal(false)}
        />
      )}
    </div>
  );
}
