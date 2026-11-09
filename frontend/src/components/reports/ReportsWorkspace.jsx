import React, { useState, useEffect, useCallback } from "react";
import api from "../../api";

export default function ReportsWorkspace() {
  const [activeTab, setActiveTab] = useState("completeness");
  const [studies, setStudies] = useState([]);
  const [selectedStudy, setSelectedStudy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab Data States
  const [completenessData, setCompletenessData] = useState(null);
  const [timelinessData, setTimelinessData] = useState(null);
  const [expiryData, setExpiryData] = useState(null);
  const [expiryDays, setExpiryDays] = useState(90);
  const [workflowData, setWorkflowData] = useState(null);
  const [blindedData, setBlindedData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [auditFilterAction, setAuditFilterAction] = useState("");
  const [inactivatedData, setInactivatedData] = useState(null);

  // Load Studies on Mount
  useEffect(() => {
    async function loadStudies() {
      try {
        const res = await api.get("/studies");
        const list = res.data?.studies || [];
        setStudies(list);
        if (list.length > 0 && !selectedStudy) {
          setSelectedStudy(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load studies for reports:", err);
      }
    }
    loadStudies();
  }, []);

  // Fetch Report Data based on activeTab & filters
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "completeness") {
        const res = await api.get(`/reports/completeness?studyId=${selectedStudy}`);
        setCompletenessData(res.data);
      } else if (activeTab === "timeliness") {
        const res = await api.get("/reports/timeliness");
        setTimelinessData(res.data);
      } else if (activeTab === "expiry") {
        const res = await api.get(`/reports/expiry?days=${expiryDays}&studyId=${selectedStudy}`);
        setExpiryData(res.data);
      } else if (activeTab === "workflow") {
        const res = await api.get(`/reports/workflow?studyId=${selectedStudy}`);
        setWorkflowData(res.data);
      } else if (activeTab === "blinded") {
        const res = await api.get("/reports/blinded");
        setBlindedData(res.data);
      } else if (activeTab === "inventory") {
        const res = await api.get("/reports/inventory");
        setInventoryData(res.data);
      } else if (activeTab === "audit") {
        const query = new URLSearchParams();
        if (selectedStudy) query.append("studyId", selectedStudy);
        if (auditFilterAction) query.append("action", auditFilterAction);
        query.append("limit", "200");
        const res = await api.get(`/reports/audit?${query.toString()}`);
        setAuditData(res.data);
      } else if (activeTab === "inactivated") {
        const res = await api.get("/reports/inactivated");
        setInactivatedData(res.data);
      }
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError(err.response?.data?.error || err.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedStudy, expiryDays, auditFilterAction]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export CSV Helper
  const exportToCSV = (rows, filename) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: "completeness", label: "TMF Completeness (§13.3)", icon: "📊" },
    { id: "timeliness", label: "Timeliness & SLA (§13.19)", icon: "⏱️" },
    { id: "expiry", label: "Document Expiry (§13.11)", icon: "📅" },
    { id: "workflow", label: "Workflow Distribution (§13.12)", icon: "🔄" },
    { id: "blinded", label: "Blinded vs Unblinded (§13.14)", icon: "🔒" },
    { id: "inventory", label: "System Inventory (§13.17)", icon: "📁" },
    { id: "audit", label: "Audit Trail Log (§13.18)", icon: "📜" },
    { id: "inactivated", label: "Inactivated Docs (§13.20)", icon: "🚫" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER & CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Regulatory Reports & Analytics Suite (§13)
          </h2>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Clinevo eTMF 4.3 Standard Metrics & ICH GCP E6(R2) Regulatory Inspection Auditing
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Study Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: "#475569" }}>Protocol:</span>
            <select
              value={selectedStudy}
              onChange={(e) => setSelectedStudy(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                fontWeight: 600,
                background: "#fff",
                color: "#0f172a"
              }}
            >
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.protocol_number} — {s.title?.slice(0, 32)}...
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchReport}
            disabled={loading}
            style={{
              padding: "7px 14px",
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span>🔄</span> {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 8, overflowX: "auto" }}>
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
              gap: 6,
              whiteSpace: "nowrap"
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, border: "1px solid #fecaca" }}>
          ⚠️ <strong>Report Error:</strong> {error}
        </div>
      )}

      {/* REPORT CONTENT AREA */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 20 }}>
        {/* 1. TMF COMPLETENESS */}
        {activeTab === "completeness" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  eTMF Completeness by DIA Reference Model Zone (§13.3)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Expected vs. Approved Placeholders across Study, Country, and Site Milestones
                </div>
              </div>
              {(completenessData?.zones || completenessData?.zoneMetrics) && (
                <button
                  onClick={() => exportToCSV(completenessData.zones || completenessData.zoneMetrics, "etmf_completeness")}
                  style={{
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  📥 Export CSV
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Calculating Completeness Index...</div>
            ) : completenessData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Overall Score */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>OVERALL STUDY COMPLETENESS</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#0284c7", marginTop: 4 }}>
                      {completenessData.overall ?? completenessData.percentage ?? 0}%
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      {completenessData.approved ?? completenessData.approvedCount ?? 0} Approved / {completenessData.total ?? completenessData.totalExpected ?? 0} Total Documents
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>TOTAL DOCUMENTS IN REPO</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#334155", marginTop: 4 }}>
                      {completenessData.total ?? completenessData.totalExpected ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Placeholders & Ingested Files</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>APPROVED DOCUMENTS</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#059669", marginTop: 4 }}>
                      {completenessData.approved ?? completenessData.approvedCount ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>21 CFR Part 11 Certified</div>
                  </div>
                </div>

                {/* Zone Breakdown Table */}
                <div style={{ marginTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700 }}>Zone</th>
                        <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700 }}>Total Docs</th>
                        <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700 }}>Approved</th>
                        <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700 }}>Completeness Bar</th>
                        <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 700 }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(completenessData.zones || completenessData.zoneMetrics || []).map((z, i) => {
                        const total = z.total ?? z.expected ?? 0;
                        const approved = z.approved ?? 0;
                        const pct = z.pct ?? (total > 0 ? Math.round((approved / total) * 100) : 0);
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>
                              {z.label ? `${z.zone} - ${z.label}` : z.zone}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#475569" }}>{total}</td>
                            <td style={{ padding: "10px 14px", color: "#059669", fontWeight: 600 }}>{approved}</td>
                            <td style={{ padding: "10px 14px", width: "35%" }}>
                              <div style={{ width: "100%", height: 10, background: "#e2e8f0", borderRadius: 5, overflow: "hidden" }}>
                                <div
                                  style={{
                                    width: `${Math.min(100, pct)}%`,
                                    height: "100%",
                                    background: pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444",
                                    borderRadius: 5,
                                    transition: "width 0.3s ease"
                                  }}
                                />
                              </div>
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f172a" }}>{pct}%</td>
                          </tr>
                        );
                      })}
                      {(!completenessData.zoneMetrics || completenessData.zoneMetrics.length === 0) && (
                        <tr>
                          <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
                            No EDL placeholders generated for this study. Use Study Setup Wizard or EDL Generator.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 2. TIMELINESS & SLA */}
        {activeTab === "timeliness" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Document Timeliness & SLA Compliance (§13.19)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  ICH GCP E6(R2) Turnaround Latency: Creation to Final 21 CFR Part 11 Approval
                </div>
              </div>
              {timelinessData?.metrics && (
                <button
                  onClick={() => exportToCSV(timelinessData.metrics, "sla_timeliness")}
                  style={{
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  📥 Export CSV
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Computing Timeliness Benchmarks...</div>
            ) : timelinessData ? (
              <div>
                <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                  <div style={{ padding: 16, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>AVERAGE APPROVAL CYCLE TIME</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#15803d", marginTop: 4 }}>
                      {timelinessData.averageDaysToApprove ?? 0} Days
                    </div>
                    <div style={{ fontSize: 12, color: "#166534" }}>Target: &lt; 14 Days (SOP Benchmark)</div>
                  </div>
                  <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>AUDITED DOCUMENTS ANALYZED</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#0284c7", marginTop: 4 }}>
                      {timelinessData.metrics?.length ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Fully approved artifacts with workflow logs</div>
                  </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Document Title</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Created Date</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Approved Date</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>Days to Approve</th>
                      <th style={{ padding: "10px 14px", color: "#475569" }}>SLA Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(timelinessData.metrics || []).map((m, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>{m.title}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{m.created_at?.slice(0, 10)}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{m.approved_at?.slice(0, 10) || "—"}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700 }}>{m.daysToApprove} days</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: m.daysToApprove <= 14 ? "#dcfce7" : "#fee2e2",
                              color: m.daysToApprove <= 14 ? "#15803d" : "#b91c1c"
                            }}
                          >
                            {m.daysToApprove <= 14 ? "Within SLA" : "Breached SLA"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!timelinessData.metrics || timelinessData.metrics.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
                          No approved documents with full workflow history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}

        {/* 3. DOCUMENT EXPIRY */}
        {activeTab === "expiry" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Regulatory Document Expiration Horizon (§13.11)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Monitors CVs, Medical Licenses, IRB Approvals, and Lab Accreditations requiring re-issuance
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Horizon:</span>
                {[30, 60, 90, 180].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExpiryDays(d)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: expiryDays === d ? 700 : 500,
                      background: expiryDays === d ? "#0284c7" : "#f1f5f9",
                      color: expiryDays === d ? "#fff" : "#475569",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Scanning Expiring Artifacts...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Artifact Code</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Title</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Expiration Date</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Days Remaining</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {(expiryData?.documents || []).map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 600 }}>{d.artifact_code || "—"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>{d.title}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{d.expiry_date}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{d.days_left} days</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: d.days_left <= 30 ? "#fee2e2" : "#fef3c7",
                            color: d.days_left <= 30 ? "#b91c1c" : "#92400e"
                          }}
                        >
                          {d.days_left <= 30 ? "CRITICAL" : "ATTENTION"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!expiryData?.documents || expiryData.documents.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#166534", background: "#f0fdf4" }}>
                        ✅ No documents expiring within the next {expiryDays} days horizon.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 4. WORKFLOW DISTRIBUTION */}
        {activeTab === "workflow" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#1e293b" }}>
              Active Lifecycle Workflow Bottleneck Analysis (§13.12)
            </h3>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Compiling Pipeline Status...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                {(workflowData?.statusBreakdown || workflowData?.inWorkflow || []).map((w, i) => (
                  <div key={i} style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{w.status.toUpperCase()}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{w.count}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Artifacts in queue</div>
                  </div>
                ))}
                {(!workflowData?.statusBreakdown && !workflowData?.inWorkflow) && (
                  <div style={{ gridColumn: "1/-1", padding: 20, textAlign: "center", color: "#64748b" }}>
                    No documents currently in active review or approval workflow.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. BLINDED VS UNBLINDED */}
        {activeTab === "blinded" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Blinded vs. Unblinded Artifact Access Verification (§13.14)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Regulatory compliance verification: ensures randomization & unblinded dosing codes remain firewalled
                </div>
              </div>
              <div style={{ padding: "4px 10px", background: "#fef3c7", borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                Blinded Count: {blindedData?.blindedCount ?? 0}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Auditing Security Firewalls...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Artifact Code</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Document Title</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Version</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Security Blinding</th>
                  </tr>
                </thead>
                <tbody>
                  {(blindedData?.documents || []).map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{d.artifact_code || "—"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.title}</td>
                      <td style={{ padding: "10px 14px" }}>v{d.version}</td>
                      <td style={{ padding: "10px 14px" }}>{d.status}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: d.is_blinded ? "#fee2e2" : "#f1f5f9",
                            color: d.is_blinded ? "#b91c1c" : "#475569"
                          }}
                        >
                          {d.is_blinded ? "🔒 BLINDED (RESTRICTED)" : "🔓 Unblinded / Standard"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 6. SYSTEM INVENTORY */}
        {activeTab === "inventory" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Trial Master File System Inventory (§13.17)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Aggregated document volumes by Protocol and DIA Reference Model Zone
                </div>
              </div>
              {inventoryData?.inventory && (
                <button
                  onClick={() => exportToCSV(inventoryData.inventory, "tmf_system_inventory")}
                  style={{
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  📥 Export CSV
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Scanning Master Repository...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Protocol Number</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>DIA Zone</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Total Documents</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Approved Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {(inventoryData?.inventory || []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0284c7" }}>{row.study}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>{row.zone || "Unassigned"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{row.total_docs}</td>
                      <td style={{ padding: "10px 14px", color: "#059669", fontWeight: 700 }}>{row.approved_docs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 7. AUDIT TRAIL LOG */}
        {activeTab === "audit" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                  Regulatory Inspection Audit Trail Log (§13.18 & §10)
                </h3>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  21 CFR Part 11 & ALCOA+ Certified Immutable Audit Lineage
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Filter Action (e.g. Approved)..."
                  value={auditFilterAction}
                  onChange={(e) => setAuditFilterAction(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 12
                  }}
                />
                {(auditData?.logs || auditData?.audit) && (
                  <button
                    onClick={() => exportToCSV(auditData.logs || auditData.audit, "alcoa_audit_trail")}
                    style={{
                      padding: "6px 12px",
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    📥 Export Audit Trail
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Reading Certified Audit Stream...</div>
            ) : (
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left", position: "sticky", top: 0 }}>
                      <th style={{ padding: "8px 12px", color: "#475569" }}>Timestamp (UTC)</th>
                      <th style={{ padding: "8px 12px", color: "#475569" }}>User</th>
                      <th style={{ padding: "8px 12px", color: "#475569" }}>Action</th>
                      <th style={{ padding: "8px 12px", color: "#475569" }}>Object</th>
                      <th style={{ padding: "8px 12px", color: "#475569" }}>Details / E-Signature Seal</th>
                      <th style={{ padding: "8px 12px", color: "#475569" }}>Client IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(auditData?.logs || auditData?.audit || []).map((a, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#64748b" }}>
                          {a.created_at?.replace("T", " ")?.slice(0, 19)}
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e293b" }}>{a.user_name || a.user_id}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontWeight: 700, color: a.action.includes("Approved") ? "#16a34a" : "#0284c7" }}>
                            {a.action}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#475569" }}>
                          {a.object_type}: {a.object_name || a.object_id}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#334155", maxWidth: 300, wordBreak: "break-all" }}>
                          {a.detail || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#94a3b8" }}>{a.ip || "127.0.0.1"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 8. INACTIVATED DOCS */}
        {activeTab === "inactivated" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#1e293b" }}>
              Inactivated & Decommissioned Artifacts Ledger (§13.20)
            </h3>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>Querying Inactivation Records...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Artifact Code</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Title</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Version</th>
                    <th style={{ padding: "10px 14px", color: "#475569" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(inactivatedData?.docs || []).map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{d.artifact_code || "—"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.title}</td>
                      <td style={{ padding: "10px 14px" }}>v{d.version}</td>
                      <td style={{ padding: "10px 14px", color: "#ef4444", fontWeight: 700 }}>Inactivated</td>
                    </tr>
                  ))}
                  {(!inactivatedData?.docs || inactivatedData.docs.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                        No inactivated documents in the system.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
