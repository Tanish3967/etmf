import { useState } from "react";

const T = { bar: "#0073e6", border: "#d1d5db", textMuted: "#6b7280" };

export default function QualityControl() {
  const [activeTab, setActiveTab] = useState("Audit Plan");

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 4, minHeight: "100%" }}>
      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: "#f9fafb" }}>
        {["Audit Plan", "Monitor Audit Activities"].map(tab => (
          <div 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            style={{ padding: "12px 24px", fontSize: 13, fontWeight: activeTab === tab ? 700 : 500, color: activeTab === tab ? T.bar : T.textMuted, borderBottom: activeTab === tab ? `3px solid ${T.bar}` : "3px solid transparent", cursor: "pointer" }}
          >
            {tab}
          </div>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {activeTab === "Audit Plan" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Active Audit Plans</h2>
              <button style={{ background: T.bar, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>+ Add Quality Audit</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.bar, color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>Audit Name</th>
                  <th style={{ padding: 10 }}>Agenda</th>
                  <th style={{ padding: 10 }}>Start Date</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>Auditor Name</th>
                  <th style={{ padding: 10 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { n: "AUDIT.S", a: "Test", d: "07-Feb-2026", s: "Planned", au: "SystemAdmin" },
                  { n: "eTMF Audit", a: "Testing new release", d: "06-Sep-2026", s: "Inprogress", au: "Karthikeyan" }
                ].map((a, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: 10, color: T.bar }}>{a.n}</td>
                    <td style={{ padding: 10 }}>{a.a}</td>
                    <td style={{ padding: 10 }}>{a.d}</td>
                    <td style={{ padding: 10 }}>{a.s}</td>
                    <td style={{ padding: 10 }}>{a.au}</td>
                    <td style={{ padding: 10 }}>✏️ 🗑️</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Monitor Audit Activities" && (
          <div>
             <h2 style={{ fontSize: 16, marginBottom: 16 }}>Quality Check Tracking (Section 11)</h2>
             <div style={{ display: "flex", gap: 40, marginTop: 40, justifyContent: "center" }}>
                {/* Visualizing the Pie Charts from Sect 8.14.15 */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 140, height: 140, borderRadius: "50%", background: "conic-gradient(#10B981 0% 81%, #FCD34D 81% 100%)", margin: "0 auto 16px auto" }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>QC Completion Rate</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Green: 81% Success</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 140, height: 140, borderRadius: "50%", background: "#0EA5E9", margin: "0 auto 16px auto" }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>QC Rejection Reason</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Blue: 100% Content Related</div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
