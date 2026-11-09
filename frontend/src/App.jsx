import { useState, useEffect } from "react";
import api from './api';

// ─── PREMIUM LOGIN GATEWAY ───────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("e.vasquez@pharma.com");
  const [password, setPassword] = useState("Admin1234!");
  const [enterprise, setEnterprise] = useState("AcmeCorp");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    try {
      setLoading(true); setErr("");
      const res = await api.post("/auth/login", { email, password });
      onLogin(res.data.user, res.data.token);
    } catch (e) {
      setErr(e.response?.data?.error || "Invalid Credentials");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)' }}>
      <div className="glass-panel" style={{ width: 420, padding: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30, justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #0284c7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20 }}>T</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#0f172a" }}>eTMF<span style={{color: "#0284c7"}}>Pro</span></div>
        </div>
        <h2 style={{ fontSize: 16, color: "#475569", marginBottom: 24, textAlign: "center", fontWeight: 500 }}>Secure Access Gateway</h2>
        
        {err && <div style={{ color: "#dc2626", background: "#fee2e2", padding: "12px 16px", marginBottom: 20, borderRadius: 10, fontSize: 13, border: "1px solid #fca5a5" }}>{err}</div>}
        
        <div style={{ marginBottom: 16 }}>
          <label style={{display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6}}>ENTERPRISE ID</label>
          <input className="modern-input" value={enterprise} onChange={e => setEnterprise(e.target.value)} />
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6}}>WORK EMAIL</label>
          <input className="modern-input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <label style={{display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6}}>
             PASSWORD <span style={{color: "#0ea5e9", cursor: "pointer"}}>Forgot?</span>
          </label>
          <input type="password" className="modern-input" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        
        <button onClick={submit} disabled={loading} className="btn-primary" style={{ width: "100%" }}>
          {loading ? "Authenticating Biometrics..." : "Secure Log In"}
        </button>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#94a3b8" }}>
          Part 11 Compliant Environment
        </div>
      </div>
    </div>
  );
};

// ─── MASTER eTMF SAAS LAYOUT ─────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("Repository");
  const [docs, setDocs] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);

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
    if (user && activeMenu === "Repository") {
      api.get("/documents").then(res => setDocs(res.data.documents || []));
    }
  }, [user, activeMenu]);

  const handleRightClick = (e, doc) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, doc });
  };

  const closeContext = () => setContextMenu(null);

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
        <div style={{ flex: 1, padding: 32, overflowY: "auto", background: "#f8fafc" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>{activeMenu} Center</h1>
              <div style={{ fontSize: 13, color: "#64748b" }}>Home / Clinical Trials / <span style={{color: "#0284c7"}}>{activeMenu}</span></div>
            </div>
            
            {activeMenu === "Repository" && (
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn-secondary">◪ Bulk Download</button>
                <button className="btn-primary">+ Add Document</button>
              </div>
            )}
          </div>

          {activeMenu === "Repository" && (
            <div className="glass-panel" style={{ background: "#fff", overflow: "hidden" }}>
              
              {/* Curator Stats (PDF Pg 175) */}
              <div style={{ display: "flex", padding: 24, borderBottom: "1px solid #e2e8f0", gap: 40, justifyContent: "space-around" }}>
                {[ 
                  {l: "Total", v: 415, c: "#1e293b", bg: "#f8fafc", sc: "#cbd5e1"}, 
                  {l: "Completed", v: 312, c: "#047857", bg: "#d1fae5", sc: "#34d399"}, 
                  {l: "In Progress", v: 45, c: "#1d4ed8", bg: "#dbeafe", sc: "#60a5fa"}, 
                  {l: "In QC", v: 12, c: "#b45309", bg: "#fef3c7", sc: "#fbbf24"}, 
                  {l: "Missing", v: 6, c: "#b91c1c", bg: "#fee2e2", sc: "#f87171"} 
                ].map(s => (
                  <div key={s.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{s.l}</div>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: s.bg, border: `4px solid ${s.sc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: s.c, boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div style={{ padding: 24 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <input className="modern-input" style={{ width: 300 }} placeholder="Search Document ID or Name..." />
                  <select className="modern-input" style={{ width: 180 }}><option>All Statuses</option><option>Published</option></select>
                </div>
                
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" style={{cursor:"pointer"}}/></th>
                        <th>Document ID</th>
                        <th>Version</th>
                        <th>Workflow Status</th>
                        <th>Document Name</th>
                        <th>Zone / Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map(d => (
                        <tr key={d.id} onContextMenu={(e) => handleRightClick(e, d)} style={{ cursor: "context-menu" }}>
                          <td style={{ textAlign: "center" }}><input type="checkbox" style={{cursor:"pointer"}}/></td>
                          <td style={{ color: "#0ea5e9", fontWeight: 700, letterSpacing: 0.5 }}>{d.artifact_code || `DOC_${d.id.substring(0,8)}`}</td>
                          <td><span className="badge badge-info">v{d.version}</span></td>
                          <td><span className={`badge ${d.status === 'Published' ? 'badge-success' : 'badge-warning'}`}>{d.status}</span></td>
                          <td style={{ fontWeight: 500 }}>{d.title}</td>
                          <td style={{ color: "#64748b", fontSize: 13 }}>01 Trial Mgt &gt; 01.01</td>
                        </tr>
                      ))}
                      {docs.length === 0 && (
                        <tr onContextMenu={(e) => handleRightClick(e, {title: "Clinical Trial Protocol.pdf", status: 'Published', version: '2.0', id: 'fake'})} style={{ cursor: "context-menu" }}>
                          <td style={{ textAlign: "center" }}><input type="checkbox" style={{cursor:"pointer"}}/></td>
                          <td style={{ color: "#0ea5e9", fontWeight: 700 }}>PRT_00146392</td>
                          <td><span className="badge badge-info">v2.0</span></td>
                          <td><span className="badge badge-success">Published</span></td>
                          <td style={{ fontWeight: 500 }}>Clinical Trial Protocol.pdf</td>
                          <td style={{ color: "#64748b", fontSize: 13 }}>02 Trial Docs &gt; 02.01</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu !== "Repository" && (
            <DynamicModule activeMenu={activeMenu} />
          )}
        </div>
      </div>

      {/* INTELLIGENT CONTEXT MENU (PDF Section 8.10) */}
      {contextMenu && (
        <div style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, width: 240, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.1)", zIndex: 1000, padding: 8, animation: "fadeIn 0.2s ease" }}>
          <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#0ea5e9", borderBottom: "1px solid #f1f5f9", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Target: {contextMenu.doc.title || contextMenu.doc.name || "System Record"}
          </div>
          {[
            {l: "View Document", i: "👁️", ax: "view"}, {l: "Download Original", i: "📥", ax: "download"}, {l: "View Properties", i: "⚙️", ax: "props"}, {l: "Version History", i: "📜", ax: "hist"},
            {l: "Check Out Document", i: "🔓", ax: "checkout"}, {l: "Redact Content", i: "⬛", ax: "redact"}, {l: "Action Sticky Notes", i: "📝", ax: "notes"},
            {l: "Inactivate (Soft Delete)", i: "❌", c: "#dc2626", ax: "del"}
          ].map(opt => (
            <div key={opt.l} onClick={async () => {
              if (opt.ax === 'view') {
                 setViewingDoc({ ...contextMenu.doc, version: "2.0", status: "Approved", uploadedBy: "Dr. Aris Thorne" });
              } else if (opt.ax === 'checkout' && contextMenu.doc.id) {
                 await api.post(`/documents/${contextMenu.doc.id}/checkout`);
                 alert(`Successfully Checked Out Document ID: ${contextMenu.doc.id}`);
              } else if (opt.ax === 'download' && contextMenu.doc.id) {
                 alert('Downloading directly from backend blob store...');
              } else {
                 alert(`Executing Context Action: ${opt.l}`);
              }
              closeContext();
            }} style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: opt.c || "#334155", borderRadius: 6, display: "flex", gap: 10, alignItems: "center", transition: "background 0.1s" }}>
              <span style={{width: 16, textAlign: "center"}}>{opt.i}</span> {opt.l}
            </div>
          ))}
        </div>
      )}

      {/* DOCUMENT VIEWER OVERLAY */}
      {viewingDoc && <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  );
}

// ─── DOCUMENT VIEWER COMPONENT ───────────────────────────────────────
const DocumentViewer = ({ doc, onClose }) => {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", animation: "fadeIn 0.2s" }}>
      {/* Viewer Main Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f1f5f9" }}>
        <div style={{ height: 60, background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 20, cursor: "pointer" }} onClick={onClose}>✕</span>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{doc.title || doc.name || "Clinical Study Report.pdf"}</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", background: "#1e293b", padding: "6px 16px", borderRadius: 20 }}>
            <span style={{ cursor: "pointer" }}>➖</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>125%</span>
            <span style={{ cursor: "pointer" }}>➕</span>
            <div style={{ width: 1, height: 16, background: "#475569", margin: "0 8px" }} />
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Page 1 of 42</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-secondary" style={{ background: "transparent", color: "white", borderColor: "#334155" }}>Download</button>
            <button className="btn-primary" style={{ background: "#0ea5e9" }}>Sign Document</button>
          </div>
        </div>
        
        {/* PDF Canvas Mock */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 850, minHeight: 1100, background: "white", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", borderRadius: 4, padding: 60 }}>
            <h1 style={{ textAlign: "center", color: "#0f172a", borderBottom: "2px solid #e2e8f0", paddingBottom: 20 }}>Clinical Study Protocol XYZ-999</h1>
            <p style={{ marginTop: 40, lineHeight: 1.8, color: "#334155", textAlign: "justify" }}>
              This document outlines the standard operating procedures and clinical endpoints for the evaluation phase. 
              The electronic Trial Master File (eTMF) maintains the definitive record for all trial activities...
            </p>
            <div style={{ marginTop: 60, height: 16, background: "#f1f5f9", borderRadius: 8, width: "100%" }} />
            <div style={{ marginTop: 16, height: 16, background: "#f1f5f9", borderRadius: 8, width: "90%" }} />
            <div style={{ marginTop: 16, height: 16, background: "#f1f5f9", borderRadius: 8, width: "95%" }} />
          </div>
        </div>
      </div>

      {/* Metadata Sidebar */}
      <div style={{ width: 340, background: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 24, borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Document Metadata</h3>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Status</div>
            <div style={{ display: "inline-block", background: "#d1fae5", color: "#047857", padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{doc.status || "Approved"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Version</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{doc.version || "2.0"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Uploaded By</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, background: "#e0f2fe", color: "#0ea5e9", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>AT</div>
              {doc.uploadedBy || "Dr. Aris Thorne"}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Audit Trail</div>
            <div style={{ fontSize: 13, color: "#475569", display: "flex", flexDirection: "column", gap: 12 }}>
              <div><strong style={{color: "#0f172a"}}>Today 10:42 AM</strong> - QA Reviewed</div>
              <div><strong style={{color: "#0f172a"}}>Yesterday</strong> - Initial Upload</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DYNAMIC FUNCTIONAL MODULE LOADER ─────────────────────────────────
const DynamicModule = ({ activeMenu }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let endpoint = "";
    if (activeMenu === "Security Administration") endpoint = "/users";
    else if (activeMenu === "Quality Control") endpoint = "/audit";
    else if (activeMenu === "My Tasks") endpoint = "/workflow/tasks";
    else if (activeMenu === "Reports") endpoint = "/reports/timeliness";
    else if (activeMenu === "Application Administration") endpoint = "/admin/functional-roles";
    else if (activeMenu === "System Administration") endpoint = "/admin/system-codelists";
    else if (activeMenu === "Forms/Logs") endpoint = "/forms/schemas";
    else if (activeMenu === "Manage Enterprise") endpoint = "/admin/user-groups";

    if (endpoint) {
      api.get(endpoint).then(res => {
        const raw = res.data;
        const list = raw.users || raw.tasks || raw.audits || raw.logs || raw.roles || raw.groups || raw.metrics || raw.inventory || raw.templates || raw.codelists || raw.schemas || (Array.isArray(raw) ? raw : []);
        setData(list);
      }).catch(e => {
        console.error("Error fetching", e);
        setData([]);
      })
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setData([]);
    }
  }, [activeMenu]);

  if (loading) return <div style={{padding: 60, textAlign: "center", color: "#64748b"}}>Loading backend endpoints...</div>;

  return (
    <div className="glass-panel" style={{ background: "#fff", overflow: "hidden", minHeight: 400 }}>
       <div style={{ padding: 24, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{activeMenu} Records</h3>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Rendering live data from connected Node.js SQLite API.</div>
          </div>
          <button className="btn-primary" style={{padding: "8px 16px", fontSize: 13}}>+ Create New Entry</button>
       </div>
       
       <div style={{ padding: 24 }}>
          {Array.isArray(data) && data.length > 0 ? (
            <table className="modern-table">
              <thead>
                <tr>
                  {Object.keys(data[0]).filter(k => !['id', 'password_hash', 'tenant_id'].includes(k)).slice(0,6).map(k => (
                    <th key={k}>{k.replace('_', ' ')}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {Object.entries(row).filter(([k]) => !['id', 'password_hash', 'tenant_id'].includes(k)).slice(0,6).map(([k, v]) => (
                      <td key={k}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                    ))}
                    <td><button className="btn-secondary" style={{padding: "4px 8px"}}>⚙ Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              No records found for this module in the database, or endpoint not heavily populated.
            </div>
          )}
       </div>
    </div>
  );
};
