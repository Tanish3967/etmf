import React, { useState, useEffect } from "react";
import api from "../../api";

export default function SystemAdminWorkspace() {
  const [activeTab, setActiveTab] = useState("integrations");
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

  // Ref 1 System Admin Console states (U-01, U-02, U-03, U-04, C-05)
  const [setupChecklist, setSetupChecklist] = useState(null);
  const [tmfModels, setTmfModels] = useState(null);
  const [edlTemplates, setEdlTemplates] = useState([]);
  const [edlDiff, setEdlDiff] = useState(null);
  const [milestonesConfig, setMilestonesConfig] = useState([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState(null);
  const [newCustomTplName, setNewCustomTplName] = useState("");

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Numbering format & tenant
        const tenantRes = await api.get("/admin/tenant");
        const tenant = tenantRes.data?.tenant || tenantRes.data || {};
        let settings = tenant.settings || {};
        if (typeof settings === "string") {
          try { settings = JSON.parse(settings); } catch { settings = {}; }
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

        // Ref 1 System Admin Console data
        const [chkRes, tmfRes, edlRes, msRes, permRes] = await Promise.all([
          api.get("/admin/setup-checklist"),
          api.get("/admin/tmf-models"),
          api.get("/admin/edl-templates"),
          api.get("/admin/milestones-config"),
          api.get("/admin/permissions-matrix"),
        ]);
        setSetupChecklist(chkRes.data || null);
        setTmfModels(tmfRes.data || null);
        setEdlTemplates(edlRes.data?.templates || []);
        setMilestonesConfig(msRes.data?.milestones || []);
        setPermissionsMatrix(permRes.data || null);
      } catch (err) {
        console.error("Failed to load system admin data:", err);
      }
    }
    fetchInitialData();
  }, []);

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
    } catch {
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

  const handleSaveMilestones = async () => {
    try {
      const res = await api.put("/admin/milestones-config", { milestones: milestonesConfig });
      setMilestonesConfig(res.data?.milestones || milestonesConfig);
      setMessage("M01–M12 Milestone Due Days saved successfully (Ref 1 Screen 6).");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save milestone due days.");
    }
  };

  const handleCloneEdlTemplate = async (e) => {
    e.preventDefault();
    if (!newCustomTplName.trim()) return;
    try {
      await api.post("/admin/edl-templates", { name: newCustomTplName.trim(), baseModelVersion: "DIA v3.2" });
      setNewCustomTplName("");
      const edlRes = await api.get("/admin/edl-templates");
      setEdlTemplates(edlRes.data?.templates || []);
      setMessage("Custom EDL Template cloned in Draft mode.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to clone custom EDL template.");
    }
  };

  const handlePublishEdlTemplate = async (id) => {
    try {
      await api.post(`/admin/edl-templates/${id}/publish`);
      const edlRes = await api.get("/admin/edl-templates");
      setEdlTemplates(edlRes.data?.templates || []);
      setMessage("EDL Template published and permanently locked.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to publish EDL template.");
    }
  };

  const handleCompareTemplates = async () => {
    try {
      const res = await api.get("/admin/edl-templates/compare?t1=edl-tpl-v30&t2=edl-tpl-v32");
      setEdlDiff(res.data);
    } catch {
      setError("Failed to compare EDL templates.");
    }
  };

  const tabs = [
    { id: "setup_checklist", label: "One-Time Setup Checklist (Ref 1)", icon: "✅" },
    { id: "tmf_models", label: "View TMF Model (v3.0 vs v3.2)", icon: "📐" },
    { id: "edl_templates", label: "EDL Templates (Draft/Publish)", icon: "📋" },
    { id: "milestones", label: "Configure Milestones (M01-M12)", icon: "🏁" },
    { id: "permissions", label: "Role Permissions Matrix", icon: "🔐" },
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
        {/* REF 1 TAB: ONE-TIME SETUP CHECKLIST */}
        {activeTab === "setup_checklist" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  One-Time System Setup Checklist (Ref 1 Screen 1)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  All 5 foundation steps must be verified before TMF Managers can create clinical studies
                </div>
              </div>
              <span style={{ padding: "6px 14px", borderRadius: 20, fontWeight: 700, fontSize: 12, background: setupChecklist?.isReadyForStudyCreation ? "#dcfce7" : "#fef3c7", color: setupChecklist?.isReadyForStudyCreation ? "#166534" : "#92400e" }}>
                {setupChecklist?.completedCount ?? 5}/5 Steps Complete — {setupChecklist?.isReadyForStudyCreation ? "Ready for Study Creation" : "Setup Pending"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(setupChecklist?.steps || []).map((st) => (
                <div key={st.step} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", background: st.completed ? "#16a34a" : "#94a3b8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                      {st.completed ? "✓" : st.step}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Step {st.step}: {st.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Tenant foundation prerequisite</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: st.completed ? "#15803d" : "#d97706" }}>
                    {st.completed ? "Verified" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REF 1 TAB: VIEW TMF MODEL (v3.0 vs v3.2) */}
        {activeTab === "tmf_models" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1e293b" }}>
              DIA TMF Reference Model Viewer — v3.0 vs v3.2 Comparison (Ref 1 Screen 2)
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              System-loaded read-only models. TMF Manager selects the model version per study during Study Setup.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              {(tmfModels?.models || []).map((m) => (
                <div key={m.version} style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: "#0284c7" }}>{m.version} ({m.releaseYear})</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", background: "#dcfce7", color: "#166534", borderRadius: 4, fontWeight: 700 }}>{m.status}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12, textAlign: "center" }}>
                    <div style={{ background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0" }}><div style={{ fontWeight: 800, fontSize: 16 }}>{m.zonesCount}</div><div style={{ fontSize: 11, color: "#64748b" }}>Zones</div></div>
                    <div style={{ background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0" }}><div style={{ fontWeight: 800, fontSize: 16 }}>{m.sectionsCount}</div><div style={{ fontSize: 11, color: "#64748b" }}>Sections</div></div>
                    <div style={{ background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0" }}><div style={{ fontWeight: 800, fontSize: 16 }}>{m.artifactsCount}</div><div style={{ fontSize: 11, color: "#64748b" }}>Artifacts</div></div>
                    <div style={{ background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0" }}><div style={{ fontWeight: 800, fontSize: 16 }}>{m.docTypesCount}</div><div style={{ fontSize: 11, color: "#64748b" }}>Doc Types</div></div>
                  </div>
                </div>
              ))}
            </div>
            {tmfModels?.versionComparison && (
              <div style={{ padding: 14, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0369a1", marginBottom: 6 }}>
                  Version Diff ({tmfModels.versionComparison.fromVersion} ➔ {tmfModels.versionComparison.toVersion}): Sections {tmfModels.versionComparison.delta.sections} | Artifacts {tmfModels.versionComparison.delta.artifacts} | Doc Types {tmfModels.versionComparison.delta.docTypes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* REF 1 TAB: EDL TEMPLATES (DRAFT / PUBLISH / COMPARE) */}
        {activeTab === "edl_templates" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Default & Custom EDL Templates (Ref 1 Screens 3–5)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Published templates are permanently locked. Clone a new version in Draft to customize artifacts.
                </div>
              </div>
              <button type="button" onClick={handleCompareTemplates} style={{ padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                🔍 Compare v3.0 vs v3.2 Diff
              </button>
            </div>
            <form onSubmit={handleCloneEdlTemplate} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="New Custom EDL Template Name (e.g. AcmePharma Oncology Phase 2)..."
                value={newCustomTplName}
                onChange={(e) => setNewCustomTplName(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
              />
              <button type="submit" style={{ padding: "8px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                + Clone Custom EDL Template (Draft)
              </button>
            </form>
            {edlDiff && (
              <div style={{ marginBottom: 16, padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12 }}>
                <strong>Comparison Diff ({edlDiff.template1?.name} vs {edlDiff.template2?.name}):</strong> +{edlDiff.diff?.addedCount} Added | -{edlDiff.diff?.removedCount} Removed | {edlDiff.diff?.modifiedCount} Modified
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px" }}>Template Name</th>
                  <th style={{ padding: "10px 14px" }}>Base Model</th>
                  <th style={{ padding: "10px 14px" }}>Type</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {edlTemplates.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{t.name}</td>
                    <td style={{ padding: "10px 14px" }}>{t.base_model_version}</td>
                    <td style={{ padding: "10px 14px" }}>{t.is_default ? "System Default (Read-Only)" : "Custom Template"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: t.status === "Published" ? "#dcfce7" : "#fef3c7", color: t.status === "Published" ? "#166534" : "#92400e" }}>
                        {t.status} {t.is_locked ? "🔒" : ""}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {t.status === "Draft" ? (
                        <button type="button" onClick={() => handlePublishEdlTemplate(t.id)} style={{ padding: "4px 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Publish & Lock
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#64748b" }}>Immutable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REF 1 TAB: CONFIGURE MILESTONES (M01-M12) */}
        {activeTab === "milestones" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Configure Milestones M01–M12 Due Days (Ref 1 Screen 6)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Formula: EDL Item Due Date = Milestone Actual Date + Due Days. M11 (Ongoing) is always active from Study Activation.
                </div>
              </div>
              <button type="button" onClick={handleSaveMilestones} style={{ padding: "8px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                💾 Save Milestone Due Days
              </button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px" }}>Code</th>
                  <th style={{ padding: "10px 14px" }}>Milestone Name</th>
                  <th style={{ padding: "10px 14px" }}>Level</th>
                  <th style={{ padding: "10px 14px" }}>EDL Items</th>
                  <th style={{ padding: "10px 14px" }}>Due Days</th>
                </tr>
              </thead>
              <tbody>
                {milestonesConfig.map((m, idx) => (
                  <tr key={m.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 800, color: "#0284c7" }}>{m.code}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{m.name}</td>
                    <td style={{ padding: "10px 14px" }}>{m.level}</td>
                    <td style={{ padding: "10px 14px" }}>{m.edl_items_count} items</td>
                    <td style={{ padding: "10px 14px" }}>
                      {m.is_ongoing || m.code === "M11" ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>Ongoing (Always Active)</span>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          max="180"
                          value={m.due_days}
                          onChange={(e) => {
                            const updated = [...milestonesConfig];
                            updated[idx] = { ...m, due_days: Number(e.target.value) };
                            setMilestonesConfig(updated);
                          }}
                          style={{ width: 70, padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 4 }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REF 1 TAB: FIXED ROLE PERMISSIONS MATRIX */}
        {activeTab === "permissions" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1e293b" }}>
              Fixed Read-Only Role Permissions Matrix (Ref 1 Screen 8)
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              {permissionsMatrix?.rule || "Permissions are fixed per role by regulatory policy (21 CFR Part 11 & ICH E6 GCP) and cannot be edited."}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>Permission</th>
                  <th style={{ padding: "10px 12px" }}>System Admin</th>
                  <th style={{ padding: "10px 12px" }}>TMF Manager</th>
                  <th style={{ padding: "10px 12px" }}>CRA / Author</th>
                  <th style={{ padding: "10px 12px" }}>Reviewer</th>
                  <th style={{ padding: "10px 12px" }}>Approver</th>
                </tr>
              </thead>
              <tbody>
                {(permissionsMatrix?.rows || []).map((r) => (
                  <tr key={r.permission} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.permission}</td>
                    <td style={{ padding: "10px 12px" }}>{r.systemAdmin ? "✅ Yes" : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{r.tmfManager ? "✅ Yes" : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{r.cra ? "✅ Yes" : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{r.reviewer ? "✅ Yes" : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{r.approver ? "✅ Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
