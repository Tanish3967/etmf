import { useState } from "react";

const T = { bar: "#0073e6", border: "#d1d5db", textMuted: "#6b7280" };

export default function Reports() {
  const [activeReport, setActiveReport] = useState("Completeness");

  // Section 8.14 list of 19 Reports
  const REPORTS = [
    "Application Users", "Blinded/Unblinded Documents", "Completeness",
    "Compliance", "Controlled Document Tracking", "Document Copy Log",
    "Document Expiry", "Document Exports", "Document Move Log",
    "Document Workflows", "Folder History", "Inactive Documents",
    "Inventory", "Notes", "Quality", "Queries", "Removed Documents",
    "Scheduled Jobs", "Timeliness"
  ];

  return (
    <div style={{ display: "flex", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 4, minHeight: "100%" }}>
      
      {/* 8.14 Reports Left Navigation */}
      <div style={{ width: 260, borderRight: `1px solid ${T.border}`, padding: "10px 0" }}>
        <div style={{ padding: "12px 20px", fontWeight: 700, color: T.bar, borderBottom: `1px solid ${T.border}` }}>Available Reports</div>
        <div style={{ overflowY: "auto", height: "calc(100vh - 160px)" }}>
          {REPORTS.map(r => (
            <div 
              key={r}
              onClick={() => setActiveReport(r)}
              style={{ padding: "10px 20px", fontSize: 12, cursor: "pointer", background: activeReport === r ? "#e0f2fe" : "transparent", fontWeight: activeReport === r ? 600 : 400 }}
            >
              📄 {r}
            </div>
          ))}
        </div>
      </div>

      {/* Report Viewer Area */}
      <div style={{ flex: 1, padding: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
           <h2 style={{ margin: 0, color: T.textBase }}>{activeReport} Report</h2>
           <div style={{ display: "flex", gap: 12 }}>
             <button style={{ padding: "6px 12px", border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 12 }}>Excel Export</button>
             <button style={{ padding: "6px 12px", border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 12 }}>PDF Export</button>
           </div>
        </div>

        <div style={{ padding: 20, background: "#f9fafb", border: `1px solid ${T.border}`, borderRadius: 4, marginBottom: 24, display: "flex", gap: 16 }}>
           <div><div style={{ fontSize: 11, marginBottom: 4 }}>Classification</div><select style={{ padding: 6, width: 140 }}><option>eTMF Repo</option></select></div>
           <div><div style={{ fontSize: 11, marginBottom: 4 }}>Study</div><select style={{ padding: 6, width: 140 }}><option>Oncology 001</option></select></div>
           <button style={{ padding: "6px 16px", background: T.bar, color: "#fff", border: "none", cursor: "pointer", marginTop: 18, height: 28, borderRadius: 4 }}>Generate</button>
        </div>

        {/* Placeholder for Generated Data */}
        <div style={{ textAlign: "center", padding: 60, color: T.textMuted, border: `1px dashed ${T.border}`, borderRadius: 4 }}>
           Data grid generated for {activeReport} based on classification filters. Connect to /api/reports endpoint.
        </div>
      </div>

    </div>
  );
}
