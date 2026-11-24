import React, { useState, useEffect, useCallback } from "react";
import api from "../../api";

export default function TmfManagerWorkspace() {
  const [studyId, setStudyId] = useState("study-001");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [completeness, setCompleteness] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [reviewRules, setReviewRules] = useState([]);
  const [overdueData, setOverdueData] = useState(null);
  const [ruDistributions, setRuDistributions] = useState([]);
  const [inspectorGrants, setInspectorGrants] = useState([]);
  const [eisfData, setEisfData] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadStudyData = useCallback(async () => {
    try {
      const [dashRes, compRes, msRes, asnRes, rrRes, ovRes, ruRes, inspRes, eisfRes] = await Promise.all([
        api.get(`/studies/${studyId}/tmf-dashboard`),
        api.get(`/studies/${studyId}/completeness`),
        api.get(`/studies/${studyId}/milestones`),
        api.get(`/studies/${studyId}/assignments`),
        api.get(`/studies/${studyId}/review-rules`),
        api.get(`/studies/${studyId}/overdue-followup`),
        api.get(`/studies/${studyId}/ru-distributions`),
        api.get(`/studies/${studyId}/inspector-grants`),
        api.get(`/studies/${studyId}/eisf`),
      ]);
      setDashboard(dashRes.data);
      setCompleteness(compRes.data);
      setMilestones(msRes.data?.milestones || []);
      setAssignments(asnRes.data?.assignments || []);
      setReviewRules(rrRes.data?.rules || []);
      setOverdueData(ovRes.data);
      setRuDistributions(ruRes.data?.distributions || []);
      setInspectorGrants(inspRes.data?.grants || []);
      setEisfData(eisfRes.data);
    } catch (err) {
      console.error("Failed to load TMF Manager Console data:", err);
    }
  }, [studyId]);

  useEffect(() => {
    loadStudyData();
  }, [loadStudyData]);

  const handleSetMilestoneActualDate = async (code) => {
    const actualDate = window.prompt(`Step 9: Enter Actual Date (YYYY-MM-DD) for Milestone ${code}:`, new Date().toISOString().split("T")[0]);
    if (!actualDate) return;
    setMessage(null);
    setError(null);
    try {
      const res = await api.post(`/studies/${studyId}/milestones/${code}/actual-date`, { actualDate });
      setMessage(res.data.message);
      loadStudyData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to set milestone actual date.");
    }
  };

  const handleOverdueAction = async (itemId, action) => {
    setMessage(null);
    setError(null);
    try {
      const res = await api.post(`/studies/${studyId}/overdue-followup/${itemId}/action`, { action });
      setMessage(res.data.message);
      loadStudyData();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action} overdue item.`);
    }
  };

  const handleAcknowledgeRu = async (distId) => {
    const password = window.prompt("21 CFR Part 11 E-Signature: Enter your password to confirm you have Read & Understood this document:", "Clinion@123");
    if (!password) return;
    setMessage(null);
    setError(null);
    try {
      const res = await api.post(`/studies/${studyId}/ru-distributions/${distId}/acknowledge`, { password });
      setMessage(res.data.message);
      loadStudyData();
    } catch (err) {
      setError(err.response?.data?.error || "Part 11 e-signature verification failed.");
    }
  };

  const handleExportInspectionPack = async () => {
    setMessage(null);
    setError(null);
    try {
      const res = await api.post(`/studies/${studyId}/inspection-pack`);
      setMessage(`${res.data.message} (${res.data.totalCertifiedDocuments} certified documents -> ${res.data.downloadUrl})`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate inspection pack.");
    }
  };

  const TABS = [
    { id: "dashboard", label: "Study Dashboard & Readiness (Step 10)" },
    { id: "milestones", label: "Milestones M01–M12 (Step 9)" },
    { id: "assignments", label: "Team & Review Rules (Steps 6–7)" },
    { id: "overdue", label: "Overdue Follow-Up (Step 11)" },
    { id: "ru", label: "R&U Distributions (Step 13)" },
    { id: "inspectors", label: "Inspector Access & eISF (Step 19)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            TMF Manager Unified Console (Ref 3 Steps 6–19)
          </h2>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            {dashboard?.study?.protocolNumber || "ONCO-2024-301"} — {dashboard?.study?.title || "Phase III Oncology Trial"} • Model: {dashboard?.study?.tmfModelVersion || "DIA v3.2"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontWeight: 600 }}
          >
            <option value="study-001">ONCO-2024-301 (Phase III)</option>
            <option value="study-002">CARDIO-2024-112 (Phase II)</option>
          </select>
          <button
            type="button"
            onClick={handleExportInspectionPack}
            style={{ padding: "8px 14px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            📦 Export Certified Inspection Pack
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: 12, borderRadius: 8, background: "#f0fdf4", color: "#166534", fontSize: 13, border: "1px solid #bbf7d0" }}>
          ✅ {message}
        </div>
      )}
      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, border: "1px solid #fecaca" }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: activeTab === t.id ? "1px solid #0284c7" : "1px solid transparent",
              background: activeTab === t.id ? "#e0f2fe" : "transparent",
              color: activeTab === t.id ? "#0369a1" : "#64748b",
              fontWeight: activeTab === t.id ? 700 : 500,
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 24 }}>
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
              <div style={{ padding: 14, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>EDL COMPLETENESS</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#0284c7" }}>{completeness?.edlCompleteness ?? 0}%</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>(Satisfied + Waived) / Total Due</div>
              </div>
              <div style={{ padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>READINESS SCORE</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#16a34a" }}>{completeness?.inspectionReadinessScore?.total ?? 0}/100</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Target: ≥90 pts</div>
              </div>
              <div style={{ padding: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c" }}>OVERDUE EDL ITEMS</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#dc2626" }}>{overdueData?.totalOverdue ?? 0}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Remind ➔ Escalate ➔ Reassign</div>
              </div>
              <div style={{ padding: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>OPEN QUALITY ISSUES</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#d97706" }}>{dashboard?.kpis?.openQIsCount ?? 0}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Study / Country / Site / Doc</div>
              </div>
              <div style={{ padding: 14, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>FPI MILESTONE (M05)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{dashboard?.study?.fpiActualDate || "2025-02-04"}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Planned: {dashboard?.study?.fpiPlannedDate || "2025-02-01"}</div>
              </div>
            </div>

            <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 700 }}>Completeness by Country & Risk Classification</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {(dashboard?.completenessByCountry || []).map((c) => (
                <div key={c.country} style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{c.country} ({c.sitesCount} sites)</span>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: c.riskLevel === "On Track" ? "#dcfce7" : "#fef3c7", color: c.riskLevel === "On Track" ? "#166534" : "#92400e" }}>
                      {c.riskLevel}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0284c7", marginTop: 6 }}>{c.completeness}% Complete</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "milestones" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>
              Step 9: Milestone Actual Dates & Automatic EDL Triggering (M01–M12)
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>Code</th>
                  <th style={{ padding: "10px 12px" }}>Milestone</th>
                  <th style={{ padding: "10px 12px" }}>Level</th>
                  <th style={{ padding: "10px 12px" }}>Due Days</th>
                  <th style={{ padding: "10px 12px" }}>Planned Date</th>
                  <th style={{ padding: "10px 12px" }}>Actual Date</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "#0284c7" }}>{m.code}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{m.name}</td>
                    <td style={{ padding: "10px 12px" }}>{m.level}</td>
                    <td style={{ padding: "10px 12px" }}>{m.code === "M11" ? "Ongoing" : `+${m.due_days}d`}</td>
                    <td style={{ padding: "10px 12px" }}>{m.planned_date || "—"}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{m.actual_date || "Not Set"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: m.status === "Reached" || m.status === "Active" ? "#dcfce7" : "#f1f5f9", color: m.status === "Reached" || m.status === "Active" ? "#166534" : "#475569" }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {m.code !== "M11" && (
                        <button type="button" onClick={() => handleSetMilestoneActualDate(m.code)} style={{ padding: "4px 10px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Set Actual Date
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "assignments" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <h4 style={{ margin: "0 0 10px 0" }}>Step 6: Scoped User Assignments (WHO + SCOPE)</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: 8 }}>User</th>
                    <th style={{ padding: 8 }}>Study Role</th>
                    <th style={{ padding: 8 }}>Countries / Sites Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 8, fontWeight: 700 }}>{a.user_name || a.user_id}</td>
                      <td style={{ padding: 8 }}>{a.study_role}</td>
                      <td style={{ padding: 8 }}>{(a.scope_countries || []).join(", ")} / {(a.scope_sites || []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 style={{ margin: "0 0 10px 0" }}>Step 7: Hierarchical Review Rules (Artifact ➔ Zone ➔ Study ➔ Catch-all)</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: 8 }}>Priority</th>
                    <th style={{ padding: 8 }}>Scope</th>
                    <th style={{ padding: 8 }}>Reviewer ➔ Approver</th>
                    <th style={{ padding: 8 }}>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRules.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 8, fontWeight: 800 }}>#{r.priority} ({r.scope_type})</td>
                      <td style={{ padding: 8 }}>{r.scope_label || r.scope_target}</td>
                      <td style={{ padding: 8 }}>{r.reviewer_name || r.reviewer_role} ➔ {r.approver_name || r.approver_role}</td>
                      <td style={{ padding: 8 }}>{r.sla_days}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "overdue" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>
              Step 11: Overdue EDL Follow-Up (Ordered Escalation: Remind ➔ Escalate ➔ Reassign)
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>Artifact</th>
                  <th style={{ padding: 10 }}>Aging Bucket</th>
                  <th style={{ padding: 10 }}>Escalation Stage</th>
                  <th style={{ padding: 10 }}>Ordered Actions</th>
                </tr>
              </thead>
              <tbody>
                {(overdueData?.items || []).map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 10, fontWeight: 700 }}>{item.artifact_code} — {item.artifact_name}</td>
                    <td style={{ padding: 10, color: "#dc2626", fontWeight: 600 }}>{item.agingBucket} ({item.daysOverdue}d)</td>
                    <td style={{ padding: 10 }}>{item.escalationStage}</td>
                    <td style={{ padding: 10, display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => handleOverdueAction(item.id, "Remind")} style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>1. Remind CRA</button>
                      <button type="button" onClick={() => handleOverdueAction(item.id, "Escalate")} style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>2. Escalate</button>
                      <button type="button" onClick={() => handleOverdueAction(item.id, "Reassign")} style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>3. Reassign</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "ru" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>
              Step 13: Read & Understood (R&U) Amendment Distributions (21 CFR Part 11 E-Signature)
            </h3>
            {ruDistributions.map((dist) => (
              <div key={dist.id} style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12, background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{dist.title} (v{dist.version})</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{dist.reason} • Deadline: {dist.deadline_date} • Acknowledged: {dist.acknowledgedCount}/{dist.totalRecipients} ({dist.completionPct}%)</div>
                  </div>
                  <button type="button" onClick={() => handleAcknowledgeRu(dist.id)} style={{ padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✍️ Acknowledge Read & Understood (Part 11 E-Sig)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "inspectors" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <h4 style={{ margin: "0 0 10px 0" }}>Step 19: Time-Bound NDA-Gated Inspector Access Grants</h4>
              {inspectorGrants.map((g) => (
                <div key={g.id} style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{g.inspector_name} ({g.agency} — {g.inspection_type})</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Window: {g.valid_from} to {g.valid_until} • NDA Accepted: {g.nda_accepted_at ? "Yes" : "Pending"} • Status: {g.status}</div>
                </div>
              ))}
            </div>
            <div>
              <h4 style={{ margin: "0 0 10px 0" }}>Ref 2 §21: Electronic Investigator Site File (eISF) Sync</h4>
              <div style={{ padding: 14, border: "1px solid #bae6fd", background: "#f0f9ff", borderRadius: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{eisfData?.site?.site_code} — {eisfData?.site?.name} ({eisfData?.site?.country})</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>eISF Completeness: <strong>{eisfData?.eisfCompleteness ?? 100}%</strong> ({eisfData?.approvedSiteDocuments}/{eisfData?.totalSiteDocuments} Site Documents Approved)</div>
                <div style={{ fontSize: 12, color: "#0369a1", marginTop: 4 }}>Bi-Directional Sync Status: {eisfData?.biDirectionalSyncStatus}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
