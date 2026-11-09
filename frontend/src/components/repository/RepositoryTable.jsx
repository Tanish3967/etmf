import React from 'react';

export default function RepositoryTable({
  filteredDocs,
  selectedTreeNode,
  selectedDocIds,
  setSelectedDocIds,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  isInspectorMode,
  onRightClick,
  onOpenUploadModal,
  onOpenBulkDownloadModal,
  onOpenFilePlanModal,
  onOpenPlaceholderModal
}) {
  const stats = [
    { l: "Total Records", v: filteredDocs.length, c: "#1e293b", bg: "#f8fafc", sc: "#cbd5e1" },
    { l: "Published", v: filteredDocs.filter(d => d.status === 'Published').length, c: "#047857", bg: "#d1fae5", sc: "#34d399" },
    { l: "Approved", v: filteredDocs.filter(d => d.status === 'Approved').length, c: "#1d4ed8", bg: "#dbeafe", sc: "#60a5fa" },
    { l: "In QC / Review", v: filteredDocs.filter(d => d.status === 'Pending Review' || d.status === 'Draft').length, c: "#b45309", bg: "#fef3c7", sc: "#fbbf24" },
  ];

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
      {/* Repository Header & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px 0" }}>
            Repository Center
          </h1>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Home / Clinical Trials / {selectedTreeNode ? <strong style={{ color: "#0284c7" }}>{selectedTreeNode.name}</strong> : <span style={{ color: "#0284c7" }}>All Folders</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={onOpenBulkDownloadModal}>
            ◪ Bulk Download {selectedDocIds.length > 0 ? `(${selectedDocIds.length})` : ''}
          </button>
          {!isInspectorMode ? (
            <>
              <button className="btn-secondary" onClick={onOpenFilePlanModal}>
                📋 File Plan (EDL)
              </button>
              <button className="btn-secondary" onClick={onOpenPlaceholderModal}>
                + Add Placeholder
              </button>
              <button className="btn-primary" onClick={onOpenUploadModal}>
                + Add Document
              </button>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, gap: 6 }}>
              <span>🔒</span> <span>Inspector Mode: Read-Only Lockdown</span>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ background: "#fff", overflow: "hidden" }}>
        {/* Curator Stats */}
        <div style={{ display: "flex", padding: 20, borderBottom: "1px solid #e2e8f0", gap: 30, justifyContent: "space-around" }}>
          {stats.map(s => (
            <div key={s.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{s.l}</div>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: s.bg, border: `3px solid ${s.sc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filter and Table */}
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input
              className="modern-input"
              style={{ width: 320 }}
              placeholder="Search Document ID or Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="modern-input"
              style={{ width: 180 }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Published">Published</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Draft">Draft</option>
              <option value="Checked Out">Checked Out</option>
            </select>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={filteredDocs.length > 0 && selectedDocIds.length === filteredDocs.length}
                      onChange={e => {
                        if (e.target.checked) setSelectedDocIds(filteredDocs.map(d => d.id));
                        else setSelectedDocIds([]);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th>Document ID</th>
                  <th>Version</th>
                  <th>Workflow Status</th>
                  <th>Document Name</th>
                  <th>Zone / Section</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map(d => (
                  <tr key={d.id} onContextMenu={(e) => onRightClick(e, d)} style={{ cursor: "context-menu" }}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(d.id)}
                        onChange={() => {
                          setSelectedDocIds(prev =>
                            prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                          );
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ color: "#0ea5e9", fontWeight: 700, letterSpacing: 0.5 }}>{d.artifact_code || `DOC_${d.id.substring(0, 8)}`}</td>
                    <td><span className="badge badge-info">v{d.version}</span></td>
                    <td><span className={`badge ${d.status === 'Published' || d.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{d.status}</span></td>
                    <td style={{ fontWeight: 500 }}>{d.title}</td>
                    <td style={{ color: "#64748b", fontSize: 13 }}>{d.zone || "01"} &gt; {d.section || "01.01"}</td>
                  </tr>
                ))}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                      No documents match the selected folder or search query. Right-click folder to add a placeholder or upload.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
