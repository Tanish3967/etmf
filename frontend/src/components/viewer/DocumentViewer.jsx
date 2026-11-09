import React from 'react';

export default function DocumentViewer({
  doc,
  onClose,
  onSignDocument,
  onAdvanceWorkflow,
  onViewAuditHistory
}) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", animation: "fadeIn 0.2s" }}>
      {/* Viewer Main Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f1f5f9" }}>
        <div style={{ height: 60, background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 20, cursor: "pointer" }} onClick={onClose}>✕</span>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{doc.title || doc.name || "Clinical Study Report.pdf"}</div>
            <span className={`badge ${doc.status === 'Approved' || doc.status === 'Published' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>
              {doc.status || "Draft"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", background: "#1e293b", padding: "6px 16px", borderRadius: 20 }}>
            <span style={{ cursor: "pointer" }}>➖</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>125%</span>
            <span style={{ cursor: "pointer" }}>➕</span>
            <div style={{ width: 1, height: 16, background: "#475569", margin: "0 8px" }} />
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Page 1 of 42</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {onAdvanceWorkflow && (
              <button
                className="btn-secondary"
                onClick={() => onAdvanceWorkflow(doc)}
                style={{ background: "#1e293b", color: "#38bdf8", borderColor: "#0284c7", fontSize: 12 }}
              >
                ⚡ Advance Workflow
              </button>
            )}
            {onSignDocument && (
              <button
                className="btn-primary"
                onClick={() => onSignDocument(doc)}
                style={{ background: "#059669", fontSize: 12 }}
              >
                ✍️ Sign Document (Part 11)
              </button>
            )}
          </div>
        </div>

        {/* PDF Canvas Mock */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 850, minHeight: 1100, background: "white", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", borderRadius: 4, padding: 60 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 700 }}>CLINICAL TRIAL MASTER FILE RECORD</div>
                <h1 style={{ margin: "4px 0 0 0", color: "#0f172a", fontSize: 22 }}>{doc.title || "Clinical Study Protocol"}</h1>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="badge badge-info" style={{ fontSize: 12 }}>Version {doc.version || "1.0"}</span>
              </div>
            </div>

            <p style={{ marginTop: 40, lineHeight: 1.8, color: "#334155", textAlign: "justify" }}>
              This document outlines the standard operating procedures, clinical endpoints, and regulatory compliance
              manifests for evaluation phase trials. The electronic Trial Master File (eTMF) maintains the definitive,
              inspection-ready record pursuant to ICH E6(R2), 21 CFR Part 11, and European Union Annex 11.
            </p>

            <div style={{ marginTop: 40, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 13, color: "#0f172a", textTransform: "uppercase" }}>Regulatory Certification Block</h3>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                <div><strong>Artifact Identifier:</strong> {doc.artifact_code || "02.01.01"}</div>
                <div><strong>Lifecycle Status:</strong> {doc.status || "Draft"}</div>
                <div><strong>Confidentiality:</strong> {doc.confidential ? "RESTRICTED / BLINDED" : "UNRESTRICTED"}</div>
              </div>
            </div>

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
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 1, overflowY: "auto" }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Lifecycle Status</div>
            <div style={{ display: "inline-block", background: doc.status === 'Approved' ? "#d1fae5" : "#fef3c7", color: doc.status === 'Approved' ? "#047857" : "#b45309", padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
              {doc.status || "Draft"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Version Number</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>v{doc.version || "1.0"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Uploaded / Authored By</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, background: "#e0f2fe", color: "#0ea5e9", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                {(doc.uploadedBy || doc.author || "Elena Vasquez").charAt(0)}
              </div>
              {doc.uploadedBy || doc.author || "Elena Vasquez"}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>ALCOA+ Audit Trail</div>
              {onViewAuditHistory && (
                <button
                  onClick={() => onViewAuditHistory(doc)}
                  style={{ fontSize: 11, background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontWeight: 600 }}
                >
                  View Full History ➔
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                <strong style={{ color: "#0f172a" }}>Current Status:</strong> {doc.status || "Draft"}
              </div>
              <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                <strong style={{ color: "#0f172a" }}>Artifact Code:</strong> {doc.artifact_code || "02.01.01"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
