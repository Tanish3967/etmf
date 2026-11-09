import React, { useState, useEffect } from "react";
import api from "../../api";

export default function SystemAdminWorkspace() {
  const [activeTab, setActiveTab] = useState("integrations");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Integrations state
  const [syncStatus, setSyncStatus] = useState({});

  // Numbering Format state
  const [numberingFormat, setNumberingFormat] = useState("{study}-{zone}-{seq4}");

  // Security & Session state
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [ipAllowlist, setIpAllowlist] = useState("0.0.0.0/0");

  // Workflow Templates
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "", steps: "Draft -> Review -> Approval" });

  // Delegations
  const [delegations, setDelegations] = useState([]);
  const [users, setUsers] = useState([]);
  const [newDelegation, setNewDelegation] = useState({ delegator_id: "", delegatee_id: "", start_date: "", end_date: "" });

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      // Numbering format & tenant
      const tenantRes = await api.get("/admin/tenant");
      const tenant = tenantRes.data?.tenant || tenantRes.data || {};
      let settings = tenant.settings || {};
      if (typeof settings === "string") {
        try { settings = JSON.parse(settings); } catch (_) { settings = {}; }
      }
      if (settings?.numberingFormat) {
        setNumberingFormat(settings.numberingFormat);
      }
      if (settings?.sessionTimeoutMinutes) {
        setSessionTimeout(settings.sessionTimeoutMinutes);
      }
      if (settings?.ipAllowlist) {
        setIpAllowlist(settings.ipAllowlist);
      }

      // Workflow templates
      const wfRes = await api.get("/admin/workflow-templates");
      setTemplates(wfRes.data?.templates || []);

      // Delegations
      const delRes = await api.get("/admin/delegations");
      setDelegations(delRes.data?.delegations || []);

      // Users for delegation picker
      const usersRes = await api.get("/users");
      setUsers(usersRes.data?.users || []);
    } catch (err) {
      console.error("Failed to load system admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Trigger Integration Sync
  async function handleSync(system) {
    setSyncStatus((prev) => ({ ...prev, [system]: "Syncing..." }));
    setMessage(null);
    setError(null);
    try {
      const res = await api.post(`/admin/integrations/${system}/sync`);
      setSyncStatus((prev) => ({ ...prev, [system]: `✅ Synced: ${res.data.recordsSynced ?? 0} records` }));
      setMessage(`Successfully synchronized ${system} trial registry.`);
    } catch (err) {
      setSyncStatus((prev) => ({ ...prev, [system]: "❌ Sync Failed" }));
      setError(err.response?.data?.error || `Failed to sync ${system}`);
    }
  }

  // Trigger LMS Sync
  async function handleLmsSync() {
    setSyncStatus((prev) => ({ ...prev, LMS: "Syncing LMS..." }));
    setMessage(null);
    try {
      await api.post("/admin/lms/sync");
      setSyncStatus((prev) => ({ ...prev, LMS: "✅ Training Roster Updated" }));
      setMessage("GCP & Protocol Training records synchronized from Enterprise LMS.");
    } catch (err) {
      setSyncStatus((prev) => ({ ...prev, LMS: "❌ LMS Sync Failed" }));
      setError("Failed to sync LMS training records.");
    }
  }

  // Save Numbering Format
  async function handleSaveNumbering() {
    setMessage(null);
    setError(null);
    try {
      await api.post("/admin/numbering-format", { numberingFormat });
      setMessage("Document numbering convention updated successfully.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update numbering format.");
    }
  }

  // Save Security Policy
  async function handleSaveSecurity() {
    setMessage(null);
    setError(null);
    try {
      await api.patch("/admin/security", {
        sessionTimeoutMinutes: Number(sessionTimeout),
        ipAllowlist
      });
      setMessage("Security policy (Session timeout & IP filter) updated.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update security parameters.");
    }
  }

  // Create Workflow Template
  async function handleCreateTemplate(e) {
    e.preventDefault();
    if (!newTemplate.name) return;
    try {
      await api.post("/admin/workflow-templates", {
        name: newTemplate.name,
        description: newTemplate.description,
        steps_json: JSON.stringify(newTemplate.steps.split("->").map(s => s.trim()))
      });
      setNewTemplate({ name: "", description: "", steps: "Draft -> Review -> Approval" });
      const wfRes = await api.get("/admin/workflow-templates");
      setTemplates(wfRes.data?.templates || []);
      setMessage("Workflow Lifecycle Template saved.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create workflow template.");
    }
  }

  // Create Delegation
  async function handleCreateDelegation(e) {
    e.preventDefault();
    if (!newDelegation.delegator_id || !newDelegation.delegatee_id) return;
    try {
      await api.post("/admin/delegations", newDelegation);
      setNewDelegation({ delegator_id: "", delegatee_id: "", start_date: "", end_date: "" });
      const delRes = await api.get("/admin/delegations");
      setDelegations(delRes.data?.delegations || []);
      setMessage("Delegation of Authority rule active.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create delegation.");
    }
  }

  const tabs = [
    { id: "integrations", label: "External Systems Sync (§8.5.3.1)", icon: "🔌" },
    { id: "workflows", label: "Workflow Templates (§8.5.3.2)", icon: "🔀" },
    { id: "delegations", label: "Delegation of Authority (§8.5.3.3)", icon: "👥" },
    { id: "numbering", label: "Artifact Numbering Schema", icon: "🔢" },
    { id: "security", label: "21 CFR Part 11 Session & IP", icon: "🛡️" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            System Administration Console (§8.5.3)
          </h2>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            System Integrations, Clinical Workflows, DOA Delegations & Enterprise Security Parameters
          </div>
        </div>
      </div>

      {message && (
        <div style={{ padding: 12, borderRadius: 8, background: "#f0fdf4", color: "#166534", fontSize: 13, border: "1px solid #bbf7d0" }}>
          ✅ {message}
        </div>
      )}
      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, border: "1px solid #fecaca" }}>
          ⚠️ <strong>Error:</strong> {error}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: activeTab === t.id ? "1px solid #0284c7" : "1px solid transparent",
              background: activeTab === t.id ? "#e0f2fe" : "transparent",
              color: activeTab === t.id ? "#0369a1" : "#64748b",
              fontWeight: activeTab === t.id ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT PANES */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 24 }}>
        {/* TAB 1: INTEGRATIONS */}
        {activeTab === "integrations" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1e293b" }}>
              Clinical Trial System Connectors & Automated Ingestion
            </h3>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              Live 2-way synchronization with CTMS (Study Milestones), EDC (Source Docs), RTSM (Blinding Codes), and LMS (Certificates)
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {[
                { name: "CTMS", title: "Clinical Trial Management System", desc: "Syncs sites, investigators, protocol amendments, and milestone activations." },
                { name: "EDC", title: "Electronic Data Capture", desc: "Imports eCRF safety narratives, SAE reporting sheets, and lab certificates." },
                { name: "RTSM", title: "Randomization & Trial Supply", desc: "Ingests drug shipment logs, IP accountability, and blinded treatment codes." },
                { name: "EPRO", title: "e-Patient Reported Outcomes", desc: "Gathers certified questionnaire batteries and patient compliance summaries." }
              ].map((sys) => (
                <div key={sys.name} style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#0284c7" }}>{sys.name}</span>
                    <span style={{ fontSize: 11, padding: "2px 6px", background: "#e2e8f0", borderRadius: 4, fontWeight: 600 }}>REST API</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4, color: "#1e293b" }}>{sys.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b", margin: "6px 0 12px 0" }}>{sys.desc}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      onClick={() => handleSync(sys.name)}
                      style={{
                        padding: "6px 12px",
                        background: "#0284c7",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      🔄 Trigger Sync
                    </button>
                    <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{syncStatus[sys.name] || "Ready"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* LMS Integration Section */}
            <div style={{ marginTop: 24, padding: 16, border: "1px solid #bbf7d0", borderRadius: 8, background: "#f0fdf4" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#166534" }}>
                    🎓 Enterprise LMS Training & GCP Certification Roster
                  </div>
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
                    Auto-verifies Investigator GCP training compliance prior to filing in DIA Zone 05
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>{syncStatus.LMS || "Ready"}</span>
                  <button
                    onClick={handleLmsSync}
                    style={{
                      padding: "6px 14px",
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Sync Training Records
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WORKFLOW TEMPLATES */}
        {activeTab === "workflows" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Document Lifecycle Workflow Templates
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Configure state-transition sequences and required review gates per document category
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateTemplate} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Template Name (e.g. Protocol Workflow)..."
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                required
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, flex: 1 }}
              />
              <input
                type="text"
                placeholder="Description..."
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, flex: 1 }}
              />
              <input
                type="text"
                placeholder="Steps (Draft -> Review -> Approval)..."
                value={newTemplate.steps}
                onChange={(e) => setNewTemplate({ ...newTemplate, steps: e.target.value })}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, flex: 2 }}
              />
              <button
                type="submit"
                style={{ padding: "8px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                + Add Template
              </button>
            </form>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Name</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Description</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Lifecycle Sequence</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1e293b" }}>{tpl.name}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{tpl.description || "—"}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#0284c7" }}>
                      {tpl.steps_json ? JSON.parse(tpl.steps_json).join(" ➔ ") : "Standard Lifecycle"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "2px 8px", background: "#dcfce7", color: "#15803d", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Active</span>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No custom workflow templates configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: DELEGATIONS */}
        {activeTab === "delegations" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Delegation of Authority (DOA) & Out-of-Office Routing
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Automatically reassigns review and sign-off tasks when a clinical reviewer is on leave
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateDelegation} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Delegator (User On Leave)</label>
                <select
                  value={newDelegation.delegator_id}
                  onChange={(e) => setNewDelegation({ ...newDelegation, delegator_id: e.target.value })}
                  required
                  style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">Select Delegator...</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Delegatee (Coverage Assignee)</label>
                <select
                  value={newDelegation.delegatee_id}
                  onChange={(e) => setNewDelegation({ ...newDelegation, delegatee_id: e.target.value })}
                  required
                  style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">Select Delegatee...</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Start Date</label>
                <input
                  type="date"
                  value={newDelegation.start_date}
                  onChange={(e) => setNewDelegation({ ...newDelegation, start_date: e.target.value })}
                  required
                  style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>End Date</label>
                <input
                  type="date"
                  value={newDelegation.end_date}
                  onChange={(e) => setNewDelegation({ ...newDelegation, end_date: e.target.value })}
                  style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                style={{ padding: "9px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                + Delegate Authority
              </button>
            </form>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Delegator</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Acting Delegatee</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Start Date</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>End Date</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {delegations.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{d.delegator_name || d.delegator_id}</td>
                    <td style={{ padding: "10px 14px", color: "#0284c7", fontWeight: 600 }}>{d.delegatee_name || d.delegatee_id}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{d.start_date?.slice(0, 10)}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{d.end_date?.slice(0, 10) || "Permanent / Indefinite"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "2px 8px", background: "#dbeafe", color: "#1e40af", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        Active Delegation
                      </span>
                    </td>
                  </tr>
                ))}
                {delegations.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No active delegations found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: NUMBERING SCHEMA */}
        {activeTab === "numbering" && (
          <div style={{ maxWidth: 600 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1e293b" }}>
              Automated Document Numbering Convention
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              Defines how newly filed artifacts receive unique identifier barcodes and metadata codes
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                  Numbering Pattern Template
                </label>
                <input
                  type="text"
                  value={numberingFormat}
                  onChange={(e) => setNumberingFormat(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, fontFamily: "monospace" }}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  Supported tokens: <code>{"{study}"}</code>, <code>{"{zone}"}</code>, <code>{"{section}"}</code>, <code>{"{artifact}"}</code>, <code>{"{seq4}"}</code>, <code>{"{year}"}</code>
                </div>
              </div>

              <div style={{ padding: 12, background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Generated Example: </span>
                <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#0284c7" }}>
                  {numberingFormat.replace("{study}", "PROTO-01").replace("{zone}", "05").replace("{seq4}", "0042")}
                </span>
              </div>

              <button
                onClick={handleSaveNumbering}
                style={{ alignSelf: "flex-start", padding: "8px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Save Numbering Schema
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: SECURITY POLICY */}
        {activeTab === "security" && (
          <div style={{ maxWidth: 600 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1e293b" }}>
              21 CFR Part 11 Session Security & Network Restrictions
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              Session timeout policies, concurrent login controls, and IP subnet firewall allowlists
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                  Inactivity Auto-Logout Timeout (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14 }}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  Mandatory for 21 CFR Part 11 compliance: terminal must lock after period of operator inactivity.
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                  Client IP Subnet Allowlist (CIDR Format)
                </label>
                <input
                  type="text"
                  value={ipAllowlist}
                  onChange={(e) => setIpAllowlist(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, fontFamily: "monospace" }}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  e.g. <code>192.168.1.0/24</code> or <code>0.0.0.0/0</code> for global access.
                </div>
              </div>

              <button
                onClick={handleSaveSecurity}
                style={{ alignSelf: "flex-start", padding: "8px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Apply Security Controls
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
