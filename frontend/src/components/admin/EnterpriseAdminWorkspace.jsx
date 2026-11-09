import React, { useState, useEffect } from "react";
import api from "../../api";

export default function EnterpriseAdminWorkspace() {
  const [activeTab, setActiveTab] = useState("organizations");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Enterprise Stats
  const [stats, setStats] = useState(null);

  // Tenant Profile
  const [tenant, setTenant] = useState({ name: "", primaryColor: "#0284c7" });

  // Organization Profiles
  const [orgs, setOrgs] = useState([]);
  const [newOrg, setNewOrg] = useState({ name: "", profile_type: "Sponsor", description: "", value_str: "" });

  // Codelists
  const [codelists, setCodelists] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("Department");
  const [newCode, setNewCode] = useState({ code: "", name: "" });

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [statsRes, tenantRes, orgsRes, codeRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/tenant"),
        api.get("/admin/organization-profiles"),
        api.get(`/admin/system-codelists?groupName=${selectedGroup}`)
      ]);
      setStats(statsRes.data?.stats || null);
      const tenantObj = tenantRes.data?.tenant || tenantRes.data || {};
      if (tenantObj) {
        setTenant({
          name: tenantObj.name || "Default Clinical Enterprise",
          primaryColor: tenantObj.primary_color || tenantObj.primaryColor || "#0284c7"
        });
      }
      setOrgs(orgsRes.data?.profiles || []);
      setCodelists(codeRes.data?.codelists || []);
    } catch (err) {
      console.error("Failed to fetch enterprise data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Load codelists when group changes
  async function loadCodelists(grp) {
    setSelectedGroup(grp);
    try {
      const res = await api.get(`/admin/system-codelists?groupName=${grp}`);
      setCodelists(res.data?.codelists || []);
    } catch (err) {
      console.error("Error loading codelist:", err);
    }
  }

  // Add Organization Profile
  async function handleAddOrg(e) {
    e.preventDefault();
    if (!newOrg.name) return;
    setMessage(null);
    setError(null);
    try {
      await api.post("/admin/organization-profiles", newOrg);
      setNewOrg({ name: "", profile_type: "Sponsor", description: "", value_str: "" });
      const res = await api.get("/admin/organization-profiles");
      setOrgs(res.data?.profiles || []);
      setMessage("Organization profile registered.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add organization profile.");
    }
  }

  // Add Codelist
  async function handleAddCode(e) {
    e.preventDefault();
    if (!newCode.code || !newCode.name) return;
    try {
      await api.post("/admin/system-codelists", {
        ...newCode,
        group_name: selectedGroup,
        is_active: 1
      });
      setNewCode({ code: "", name: "" });
      loadCodelists(selectedGroup);
      setMessage(`Added ${newCode.name} to ${selectedGroup} dictionary.`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add codelist entry.");
    }
  }

  // Delete Codelist
  async function handleDeleteCode(id) {
    try {
      await api.delete(`/admin/system-codelists/${id}`);
      loadCodelists(selectedGroup);
      setMessage("Dictionary item removed.");
    } catch (err) {
      setError("Failed to delete codelist item.");
    }
  }

  // Save Tenant
  async function handleSaveTenant(e) {
    e.preventDefault();
    try {
      await api.patch("/admin/tenant", tenant);
      setMessage("Enterprise profile details updated.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save tenant profile.");
    }
  }

  const tabs = [
    { id: "organizations", label: "Organizations & Partners (§14.2)", icon: "🏢" },
    { id: "codelists", label: "Global Master Dictionaries (§14.3)", icon: "📚" },
    { id: "tenant", label: "Enterprise Identity & Branding", icon: "⚙️" },
    { id: "telemetry", label: "System Health & Capacity", icon: "📈" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Manage Enterprise & Master Data (§14)
          </h2>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Multi-Tenant Clinical Governance, External Partners, Global Dictionaries & Capacity Telemetry
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

      {/* WORKSPACE CONTENT */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 24 }}>
        {/* TAB 1: ORGANIZATIONS */}
        {activeTab === "organizations" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Clinical Enterprise Organizations & Third-Party Vendors
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Register Sponsors, CROs, Central Laboratories, Ethics Committees, and Tech Vendors
                </div>
              </div>
            </div>

            <form onSubmit={handleAddOrg} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Organization Name</label>
                <input
                  type="text"
                  placeholder="e.g. BioPharm Solutions Inc."
                  value={newOrg.name}
                  onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  required
                  style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 160 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Entity Type</label>
                <select
                  value={newOrg.profile_type}
                  onChange={(e) => setNewOrg({ ...newOrg, profile_type: e.target.value })}
                  style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                >
                  <option value="Sponsor">Sponsor</option>
                  <option value="CRO">CRO</option>
                  <option value="Central Lab">Central Lab</option>
                  <option value="Ethics Committee">Ethics Committee</option>
                  <option value="Vendor">Vendor</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 2 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Description / Services</label>
                <input
                  type="text"
                  placeholder="Primary clinical research services provided..."
                  value={newOrg.description}
                  onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                  style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                style={{ padding: "9px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                + Register Entity
              </button>
            </form>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Organization Name</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Entity Type</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Description</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1e293b" }}>{o.name}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "2px 8px", background: "#f1f5f9", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                        {o.profile_type}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{o.description || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "2px 8px", background: "#dcfce7", color: "#15803d", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        Active Partner
                      </span>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No organization profiles registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: CODELISTS */}
        {activeTab === "codelists" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Global Master Dictionaries & Codelists
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Centrally managed Controlled Terminology across Clinical Operations and Quality Control
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Department", "Designation", "Document Category", "Milestone"].map((grp) => (
                  <button
                    key={grp}
                    onClick={() => loadCodelists(grp)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: selectedGroup === grp ? 700 : 500,
                      background: selectedGroup === grp ? "#0284c7" : "#f1f5f9",
                      color: selectedGroup === grp ? "#fff" : "#475569",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddCode} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Code Identifier (e.g. CL-01)..."
                value={newCode.code}
                onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                required
                style={{ padding: "7px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, width: 180 }}
              />
              <input
                type="text"
                placeholder={`Display Name for ${selectedGroup}...`}
                value={newCode.name}
                onChange={(e) => setNewCode({ ...newCode, name: e.target.value })}
                required
                style={{ padding: "7px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, flex: 1 }}
              />
              <button
                type="submit"
                style={{ padding: "7px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                + Add Entry
              </button>
            </form>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Code</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Display Name</th>
                  <th style={{ padding: "10px 14px", color: "#475569" }}>Dictionary Group</th>
                  <th style={{ padding: "10px 14px", color: "#475569", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codelists.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700 }}>{c.code}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>{c.name}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{c.group_name}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button
                        onClick={() => handleDeleteCode(c.id)}
                        style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {codelists.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No codelist entries found for this group.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: TENANT BRANDING */}
        {activeTab === "tenant" && (
          <div style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1e293b" }}>
              Enterprise Tenant Identity & Visual Styling
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              Company designation and primary theme accents applied across all clinical workspaces
            </div>

            <form onSubmit={handleSaveTenant} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                  Enterprise / Sponsor Name
                </label>
                <input
                  type="text"
                  value={tenant.name}
                  onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                  Brand Primary Accent Color
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="color"
                    value={tenant.primaryColor}
                    onChange={(e) => setTenant({ ...tenant, primaryColor: e.target.value })}
                    style={{ width: 44, height: 40, border: "none", cursor: "pointer", background: "none" }}
                  />
                  <input
                    type="text"
                    value={tenant.primaryColor}
                    onChange={(e) => setTenant({ ...tenant, primaryColor: e.target.value })}
                    style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, fontFamily: "monospace", width: 120 }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{ alignSelf: "flex-start", padding: "8px 18px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Save Enterprise Settings
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: TELEMETRY & STATS */}
        {activeTab === "telemetry" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#1e293b" }}>
              Enterprise System Health & Storage Telemetry
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>TOTAL CLINICAL DOCUMENTS</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#0284c7", marginTop: 4 }}>
                  {stats?.documents ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Stored under 21 CFR Part 11 custody</div>
              </div>

              <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>REGISTERED USERS</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#334155", marginTop: 4 }}>
                  {stats?.users ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>RBAC provisioned clinical users</div>
              </div>

              <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>ACTIVE CLINICAL STUDIES</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a", marginTop: 4 }}>
                  {stats?.studies ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Protocols in active management</div>
              </div>

              <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>QUALITY CONTROL QUERIES</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#e11d48", marginTop: 4 }}>
                  {stats?.queries ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Non-conformance defect logs</div>
              </div>

              <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>AUDIT TRAIL RECORDS</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#8b5cf6", marginTop: 4 }}>
                  {stats?.auditEvents ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Immutable ALCOA+ log entries</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
