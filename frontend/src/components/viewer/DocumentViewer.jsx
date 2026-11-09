import React from 'react';

export default function DocumentViewer({ doc, onClose }) {
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
              <div><strong style={{ color: "#0f172a" }}>Today 10:42 AM</strong> - QA Reviewed</div>
              <div><strong style={{ color: "#0f172a" }}>Yesterday</strong> - Initial Upload</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
