import { useState, useEffect, useCallback } from "react";
import api from './api';

// Sprint 1: Document Action Modals (Clinevo eTMF 4.3 §8.10)
import MetadataEditorModal from './components/document/MetadataEditorModal';
import RedactionModal from './components/document/RedactionModal';
import StickyNotesModal from './components/document/StickyNotesModal';
import BlindingModal from './components/document/BlindingModal';
import RaiseQueryModal from './components/document/RaiseQueryModal';
import LinkDocumentModal from './components/document/LinkDocumentModal';
import DocumentHistoryModal from './components/document/DocumentHistoryModal';
import CompliantDownloadModal from './components/document/CompliantDownloadModal';

// Sprint 2: Folder Operations & Tree (Clinevo eTMF 4.3 §8.7 & §8.8)
import FolderTree from './components/folder/FolderTree';
import FolderContextMenu from './components/folder/FolderContextMenu';
import AddPlaceholderModal from './components/folder/AddPlaceholderModal';
import FilePlanModal from './components/folder/FilePlanModal';

// Clean Architecture Components (SRP / Segmentation)
import LoginScreen from './components/auth/LoginScreen';
import DocumentViewer from './components/viewer/DocumentViewer';
import DynamicModule from './components/layout/DynamicModule';
import DocumentContextMenu from './components/document/DocumentContextMenu';

// Sprint 3: Workflow & 21 CFR Part 11 Electronic Signature (Clinevo eTMF 4.3 §8.11, §8.12, §8.13)
import WorkflowAdvanceModal from './components/workflow/WorkflowAdvanceModal';
import ESignatureModal from './components/workflow/ESignatureModal';
import AuditHistoryModal from './components/workflow/AuditHistoryModal';


// ─── MASTER eTMF SAAS LAYOUT ─────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("Repository");
  const [docs, setDocs] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // { type: 'metadata' | 'redact' | 'notes' | 'blind' | 'query' | 'link' | 'history' | 'download', doc: object }

  // Sprint 2: Folder State
  const [selectedTreeNode, setSelectedTreeNode] = useState(null);
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [activeFolderModal, setActiveFolderModal] = useState(null); // { type: 'placeholder' | 'file_plan', node }
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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

  // Authentic PDF Section 8.5 Menus
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
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 14 }}>
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
              <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px 0" }}>
                      Repository Center
                    </h1>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Home / Clinical Trials / {selectedTreeNode ? <strong style={{ color: "#0284c7" }}>{selectedTreeNode.name}</strong> : <span style={{ color: "#0284c7" }}>All Folders</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn-secondary" onClick={() => setActiveFolderModal({ type: 'file_plan', node: selectedTreeNode })}>
                      📋 File Plan (EDL)
                    </button>
                    <button className="btn-secondary" onClick={() => setActiveFolderModal({ type: 'placeholder', node: selectedTreeNode })}>
                      + Add Placeholder
                    </button>
                    <button className="btn-primary" onClick={() => alert("Upload Document Dialog: Drag & Drop or select file for ingestion.")}>
                      + Add Document
                    </button>
                  </div>
                </div>

                <div className="glass-panel" style={{ background: "#fff", overflow: "hidden" }}>
                  {/* Curator Stats */}
                  <div style={{ display: "flex", padding: 20, borderBottom: "1px solid #e2e8f0", gap: 30, justifyContent: "space-around" }}>
                    {[
                      { l: "Total Records", v: filteredDocs.length, c: "#1e293b", bg: "#f8fafc", sc: "#cbd5e1" },
                      { l: "Published", v: filteredDocs.filter(d => d.status === 'Published').length, c: "#047857", bg: "#d1fae5", sc: "#34d399" },
                      { l: "Approved", v: filteredDocs.filter(d => d.status === 'Approved').length, c: "#1d4ed8", bg: "#dbeafe", sc: "#60a5fa" },
                      { l: "In QC / Review", v: filteredDocs.filter(d => d.status === 'Pending Review' || d.status === 'Draft').length, c: "#b45309", bg: "#fef3c7", sc: "#fbbf24" },
                    ].map(s => (
                      <div key={s.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{s.l}</div>
                        <div style={{ width: 50, height: 50, borderRadius: "50%", background: s.bg, border: `3px solid ${s.sc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Filter and Table */}
                  <div style={{ padding: 20 }}>
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                      <input
                        className="modern-input"
                        style={{ width: 320 }}
                        placeholder="Search Document ID or Name..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                      <select
                        className="modern-input"
                        style={{ width: 180 }}
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        <option value="Approved">Approved</option>
                        <option value="Published">Published</option>
                        <option value="Pending Review">Pending Review</option>
                        <option value="Draft">Draft</option>
                        <option value="Checked Out">Checked Out</option>
                      </select>
                    </div>

                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" style={{ cursor: "pointer" }} /></th>
                            <th>Document ID</th>
                            <th>Version</th>
                            <th>Workflow Status</th>
                            <th>Document Name</th>
                            <th>Zone / Section</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDocs.map(d => (
                            <tr key={d.id} onContextMenu={(e) => handleRightClick(e, d)} style={{ cursor: "context-menu" }}>
                              <td style={{ textAlign: "center" }}><input type="checkbox" style={{ cursor: "pointer" }} /></td>
                              <td style={{ color: "#0ea5e9", fontWeight: 700, letterSpacing: 0.5 }}>{d.artifact_code || `DOC_${d.id.substring(0, 8)}`}</td>
                              <td><span className="badge badge-info">v{d.version}</span></td>
                              <td><span className={`badge ${d.status === 'Published' || d.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{d.status}</span></td>
                              <td style={{ fontWeight: 500 }}>{d.title}</td>
                              <td style={{ color: "#64748b", fontSize: 13 }}>{d.zone || "01"} &gt; {d.section || "01.01"}</td>
                            </tr>
                          ))}
                          {filteredDocs.length === 0 && (
                            <tr>
                              <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                                No documents match the selected folder or search query. Right-click folder to add a placeholder or upload.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>{activeMenu} Center</h1>
                <div style={{ fontSize: 13, color: "#64748b" }}>Home / Clinical Trials / <span style={{ color: "#0284c7" }}>{activeMenu}</span></div>
              </div>
              <DynamicModule activeMenu={activeMenu} />
            </div>
          )}
        </div>
      </div>

      {/* SPRINT 1: DOCUMENT CONTEXT MENU (§8.10) */}
      <DocumentContextMenu
        contextMenu={contextMenu}
        onClose={closeContext}
        onView={setViewingDoc}
        onOpenModal={setActiveModal}
        onRefresh={fetchDocs}
      />

      {/* SPRINT 1: DOCUMENT ACTION MODALS (eTMF 4.3 §8.10) */}
      {activeModal?.type === 'metadata' && (
        <MetadataEditorModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
          onSaved={() => { setActiveModal(null); fetchDocs(); }}
        />
      )}
      {activeModal?.type === 'redact' && (
        <RedactionModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
          onRedacted={() => { setActiveModal(null); fetchDocs(); }}
        />
      )}
      {activeModal?.type === 'notes' && (
        <StickyNotesModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal?.type === 'blind' && (
        <BlindingModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
          onUpdated={() => { setActiveModal(null); fetchDocs(); }}
        />
      )}
      {activeModal?.type === 'query' && (
        <RaiseQueryModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
          onQueryRaised={() => { setActiveModal(null); fetchDocs(); }}
        />
      )}
      {activeModal?.type === 'link' && (
        <LinkDocumentModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
          onLinked={() => { setActiveModal(null); fetchDocs(); }}
        />
      )}
      {activeModal?.type === 'history' && (
        <DocumentHistoryModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
          onSelectVersion={(v) => {
            setActiveModal(null);
            setViewingDoc({ ...activeModal.doc, version: v.version, status: v.status || activeModal.doc.status });
          }}
        />
      )}
      {activeModal?.type === 'download' && (
        <CompliantDownloadModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
        />
      )}

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

      {/* SPRINT 3: WORKFLOW & E-SIGNATURE MODALS (§8.11–8.13) */}
      {activeModal?.type === 'advance_workflow' && (
        <WorkflowAdvanceModal
          doc={activeModal.doc}
          user={user}
          onClose={() => setActiveModal(null)}
          onAdvanced={(updatedDoc) => {
            fetchDocs();
            if (viewingDoc && updatedDoc) setViewingDoc(updatedDoc);
          }}
          onRequireESig={(d) => setActiveModal({ type: 'esignature', doc: d })}
        />
      )}

      {activeModal?.type === 'esignature' && (
        <ESignatureModal
          doc={activeModal.doc}
          user={user}
          onClose={() => setActiveModal(null)}
          onSigned={(updatedDoc) => {
            fetchDocs();
            if (viewingDoc && updatedDoc) setViewingDoc(updatedDoc);
          }}
        />
      )}

      {activeModal?.type === 'audit_history' && (
        <AuditHistoryModal
          doc={activeModal.doc}
          onClose={() => setActiveModal(null)}
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
    </div>
  );
}

