import React from 'react';

export default function RepositoryTable({
  filteredDocs,
  selectedTreeNode,
  setSelectedTreeNode,
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
  onOpenPlaceholderModal,
  onNavigateToFolder,
  onViewDocument
}) {
  const hasActiveFilters = Boolean(selectedTreeNode || searchQuery || (statusFilter && statusFilter !== 'All'));

  const handleResetFilters = () => {
    if (setSelectedTreeNode) setSelectedTreeNode(null);
    if (setSearchQuery) setSearchQuery('');
    if (setStatusFilter) setStatusFilter('All');
  };
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
          <div style={{ display: "flex", gap: 12, marginBottom: hasActiveFilters ? 10 : 16, alignItems: "center", flexWrap: "wrap" }}>
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
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-secondary"
                style={{ fontSize: 12, padding: "7px 12px", background: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" }}
                title="Clear all folder, search, and status filters"
              >
                ✕ Reset All Filters
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap", fontSize: 12 }}>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Active Filters:</span>
              {selectedTreeNode && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    fontWeight: 600,
                    border: "1px solid #bae6fd"
                  }}
                >
                  📁 Folder: {selectedTreeNode.name}
                  <button
                    type="button"
                    onClick={() => setSelectedTreeNode && setSelectedTreeNode(null)}
                    style={{ background: "none", border: "none", color: "#0369a1", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1, fontWeight: 700 }}
                    title="Clear folder filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {searchQuery && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "#fef3c7",
                    color: "#92400e",
                    fontWeight: 600,
                    border: "1px solid #fde68a"
                  }}
                >
                  🔍 &quot;{searchQuery}&quot;
                  <button
                    type="button"
                    onClick={() => setSearchQuery && setSearchQuery('')}
                    style={{ background: "none", border: "none", color: "#92400e", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1, fontWeight: 700 }}
                    title="Clear search query"
                  >
                    ×
                  </button>
                </span>
              )}
              {statusFilter && statusFilter !== 'All' && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "#f3e8ff",
                    color: "#6b21a8",
                    fontWeight: 600,
                    border: "1px solid #e9d5ff"
                  }}
                >
                  Status: {statusFilter}
                  <button
                    type="button"
                    onClick={() => setStatusFilter && setStatusFilter('All')}
                    style={{ background: "none", border: "none", color: "#6b21a8", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1, fontWeight: 700 }}
                    title="Clear status filter"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}

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
                  <th style={{ width: 90, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map(d => (
                  <tr
                    key={d.id}
                    onDoubleClick={() => onViewDocument && onViewDocument(d)}
                    onContextMenu={(e) => onRightClick(e, d)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
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
                    <td style={{ minWidth: 170 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <button
                          type="button"
                          onClick={() => onNavigateToFolder && onNavigateToFolder(d)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#0284c7",
                            fontWeight: 700,
                            letterSpacing: 0.3,
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: 12.5,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                          title={`Click to view in DIA Folder Tree (${d.artifact_code || d.zone})`}
                        >
                          <span style={{ textDecoration: "underline" }}>{d.id}</span>
                          <span style={{ fontSize: 11, textDecoration: "none" }}>📁↗</span>
                        </button>
                        <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                          <span>DIA Code:</span>
                          <span style={{
                            fontWeight: 700,
                            color: "#0369a1",
                            background: "#e0f2fe",
                            padding: "1px 6px",
                            borderRadius: 4,
                            border: "1px solid #bae6fd"
                          }}>
                            {d.artifact_code || "N/A"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-info">v{d.version}</span></td>
                    <td><span className={`badge ${d.status === 'Published' || d.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{d.status}</span></td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onViewDocument && onViewDocument(d)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          textAlign: "left",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                        title="Click to view document in website"
                      >
                        <span style={{ fontSize: 14 }}>📄</span>
                        <span style={{ fontWeight: 600, color: "#0284c7", textDecoration: "underline", fontSize: 13 }}>
                          {d.title}
                        </span>
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onNavigateToFolder && onNavigateToFolder(d)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "#64748b",
                          fontSize: 12.5,
                          cursor: "pointer",
                          textAlign: "left",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                        title="Click to view folder in DIA hierarchy"
                      >
                        <span>{d.zone || "01"} &gt; {d.section || "01.01"}</span>
                        <span style={{ fontSize: 10, color: "#0284c7" }}>↗</span>
                      </button>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDocument && onViewDocument(d);
                        }}
                        className="btn-primary"
                        style={{
                          fontSize: 11.5,
                          padding: "5px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: "#0284c7"
                        }}
                        title="View document in website"
                      >
                        <span>👁️</span> <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                        {hasActiveFilters ? "No documents match the current filters" : "No documents found in the repository"}
                      </div>
                      <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 440, margin: "0 auto 14px auto" }}>
                        {hasActiveFilters
                          ? "Try clearing folder selection, search keyword, or status filters to view all documents across all zones."
                          : "Upload documents or right-click any folder to add placeholders and start building your eTMF."}
                      </div>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="btn-primary"
                          style={{ fontSize: 13, padding: "8px 16px" }}
                        >
                          View All Documents (Reset Filters)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenUploadModal}
                          className="btn-primary"
                          style={{ fontSize: 13, padding: "8px 16px" }}
                        >
                          + Add Document
                        </button>
                      )}
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
