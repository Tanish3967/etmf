import React, { useState } from 'react';

export default function RepositoryTable({
  filteredDocs,
  selectedTreeNode,
  setSelectedTreeNode,
  selectedDocIds,
  setSelectedDocIds,
  searchQuery,
  setSearchQuery,
  searchBy = 'all',
  setSearchBy,
  statusFilter,
  setStatusFilter,
  advancedFilters = {},
  setAdvancedFilters,
  isInspectorMode,
  onRightClick,
  onOpenUploadModal,
  onOpenBulkDownloadModal,
  onOpenFilePlanModal,
  onOpenPlaceholderModal,
  onNavigateToFolder,
  onViewDocument,
  onRefresh
}) {
  const [showAdvSearchModal, setShowAdvSearchModal] = useState(false);
  const [gridZoom, setGridZoom] = useState(100);

  const hasAdvFilters = Boolean(
    advancedFilters?.country || advancedFilters?.workflowType || advancedFilters?.dateFrom || advancedFilters?.dateTo
  );
  const hasActiveFilters = Boolean(selectedTreeNode || searchQuery || (statusFilter && statusFilter !== 'All') || hasAdvFilters);

  const handleResetFilters = () => {
    if (setSelectedTreeNode) setSelectedTreeNode(null);
    if (setSearchQuery) setSearchQuery('');
    if (setSearchBy) setSearchBy('all');
    if (setStatusFilter) setStatusFilter('All');
    if (setAdvancedFilters) setAdvancedFilters({ country: '', workflowType: '', dateFrom: '', dateTo: '' });
  };

  // Accurate, non-leaking status counts across all clinical workflow stages
  const publishedCount = filteredDocs.filter(d => d.status === 'Published').length;
  const approvedCount = filteredDocs.filter(d => d.status === 'Approved' || d.status === 'Signed Off').length;
  const inQcReviewCount = filteredDocs.filter(d => d.status !== 'Published' && d.status !== 'Approved' && d.status !== 'Signed Off').length;

  const stats = [
    {
      l: "Total Records",
      v: filteredDocs.length,
      c: "#1e293b",
      bg: "#f8fafc",
      sc: "#cbd5e1",
      tooltip: "Total records matching current folder/search filters"
    },
    {
      l: "Published",
      v: publishedCount,
      c: "#047857",
      bg: "#d1fae5",
      sc: "#34d399",
      tooltip: "Finalized & published clinical records",
      onClick: () => setStatusFilter && setStatusFilter(statusFilter === 'Published' ? 'All' : 'Published')
    },
    {
      l: "Approved",
      v: approvedCount,
      c: "#1d4ed8",
      bg: "#dbeafe",
      sc: "#60a5fa",
      tooltip: "Part 11 e-signed & approved records",
      onClick: () => setStatusFilter && setStatusFilter(statusFilter === 'Approved' ? 'All' : 'Approved')
    },
    {
      l: "In QC / Review",
      v: inQcReviewCount,
      c: "#b45309",
      bg: "#fef3c7",
      sc: "#fbbf24",
      tooltip: "Active workflow records (Drafts, QC, Under Review, Pending Approval)"
    },
  ];

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", fontSize: `${gridZoom}%` }}>
      {/* Repository Header & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px 0" }}>
            Repository Center
          </h1>
          {/* Interactive Breadcrumb Bar (§7) */}
          <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{ background: "none", border: "none", padding: 0, color: "#0284c7", cursor: "pointer", fontWeight: 600 }}
            >
              🏠 Home
            </button>
            <span>&gt;</span>
            <button
              type="button"
              onClick={() => setSelectedTreeNode && setSelectedTreeNode(null)}
              style={{ background: "none", border: "none", padding: 0, color: "#0284c7", cursor: "pointer", fontWeight: 600 }}
            >
              Repository (TRIAL-2024-001)
            </button>
            {selectedTreeNode?.zoneCode && (
              <>
                <span>&gt;</span>
                <span>Zone {selectedTreeNode.zoneCode}</span>
              </>
            )}
            {selectedTreeNode?.sectionCode && (
              <>
                <span>&gt;</span>
                <span>Section {selectedTreeNode.sectionCode}</span>
              </>
            )}
            {selectedTreeNode ? (
              <>
                <span>&gt;</span>
                <strong style={{ color: "#0f172a" }}>{selectedTreeNode.name}</strong>
              </>
            ) : (
              <>
                <span>&gt;</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>All DIA v3.2 Folders</span>
              </>
            )}
          </div>
        </div>

        {/* Grid Toolbar Icons + Actions (§7) */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 4, borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={() => setSelectedTreeNode && setSelectedTreeNode(null)}
              style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
              title="Back / Collapse Folder Filter"
            >
              ⬅ Back
            </button>
            <button
              type="button"
              onClick={() => onRefresh && onRefresh()}
              style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
              title="Refresh Repository Grid"
            >
              🔄 Refresh
            </button>
            <button
              type="button"
              onClick={() => setGridZoom(z => (z >= 110 ? 90 : z + 10))}
              style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
              title="Toggle Grid Zoom (90% / 100% / 110%)"
            >
              🔍 {gridZoom}%
            </button>
          </div>

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
            <div
              key={s.l}
              onClick={s.onClick}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                cursor: s.onClick ? "pointer" : "default",
                userSelect: "none"
              }}
              title={s.tooltip || s.l}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{s.l}</div>
              <div style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: s.bg,
                border: `3px solid ${s.sc}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 800,
                color: s.c,
                transition: "transform 0.15s ease",
                boxShadow: s.onClick ? "0 2px 4px rgba(0,0,0,0.05)" : "none"
              }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>

        {/* Filter and Table */}
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: hasActiveFilters ? 10 : 16, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search By Criteria Selector (§7) */}
            <select
              className="modern-input"
              style={{ width: 175 }}
              value={searchBy}
              onChange={e => setSearchBy && setSearchBy(e.target.value)}
              title="Search By Criteria (Supports '%' wildcard)"
            >
              <option value="all">Search By: All Metadata</option>
              <option value="id">Document ID / Code</option>
              <option value="title">Document Name (%)</option>
              <option value="display_name">Display Name (%)</option>
              <option value="artifact_code">DIA Artifact Code</option>
            </select>

            <input
              className="modern-input"
              style={{ width: 290 }}
              placeholder="Search (use % for wildcard matching)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

            <select
              className="modern-input"
              style={{ width: 185 }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All 15 Lifecycle States</option>
              <option value="Draft">Draft</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Under Review">Under Review</option>
              <option value="Review Complete">Review Complete</option>
              <option value="More Info Requested">More Info Requested</option>
              <option value="Review Rejected">Review Rejected</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approve Rejected">Approve Rejected</option>
              <option value="Approved">Approved</option>
              <option value="Pending Signoff">Pending Signoff</option>
              <option value="Signed Off">Signed Off</option>
              <option value="Signoff Rejected">Signoff Rejected</option>
              <option value="Pending Publish">Pending Publish</option>
              <option value="Published">Published</option>
              <option value="Unpublish">Unpublish</option>
              <option value="Superseded">Superseded</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAdvSearchModal(true)}
              className="btn-secondary"
              style={{ fontSize: 12, padding: "7px 12px" }}
            >
              🔎 Advanced Search {hasAdvFilters ? '●' : ''}
            </button>

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
                  🔍 [{searchBy}] &quot;{searchQuery}&quot;
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
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span className={`badge ${d.status === 'Published' || d.status === 'Approved' || d.status === 'Signed Off' ? 'badge-success' : 'badge-warning'}`}>
                          {d.status}
                        </span>
                        {d.workflow_type && (
                          <span style={{ fontSize: 10, color: "#64748b" }}>{d.workflow_type}</span>
                        )}
                      </div>
                    </td>
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

      {/* Advanced Search Modal (§7) */}
      {showAdvSearchModal && (
        <div
          onClick={() => setShowAdvSearchModal(false)}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 520, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}
          >
            <div style={{ padding: "16px 20px", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>🔎 Advanced Multi-Field Search</h3>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Clinevo eTMF 4.3 §7 — Country, Workflow Archetype &amp; Date Range</div>
              </div>
              <span style={{ cursor: "pointer" }} onClick={() => setShowAdvSearchModal(false)}>✕</span>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>COUNTRY</label>
                <input
                  className="modern-input"
                  style={{ width: "100%" }}
                  placeholder="e.g. USA, UK, Germany, India"
                  value={advancedFilters?.country || ''}
                  onChange={e => setAdvancedFilters && setAdvancedFilters(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>WORKFLOW ARCHETYPE</label>
                <select
                  className="modern-input"
                  style={{ width: "100%" }}
                  value={advancedFilters?.workflowType || ''}
                  onChange={e => setAdvancedFilters && setAdvancedFilters(prev => ({ ...prev, workflowType: e.target.value }))}
                >
                  <option value="">All Workflow Archetypes</option>
                  <option value="AutoPublish">AutoPublish</option>
                  <option value="Review and Approve">Review and Approve</option>
                  <option value="All Reviewer and Approver">All Reviewer and Approver</option>
                  <option value="Review Approve with Signoff">Review Approve with Signoff</option>
                  <option value="Only Review">Only Review</option>
                  <option value="Only Approve">Only Approve</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>DATE FROM</label>
                  <input
                    type="date"
                    className="modern-input"
                    style={{ width: "100%" }}
                    value={advancedFilters?.dateFrom || ''}
                    onChange={e => setAdvancedFilters && setAdvancedFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>DATE TO</label>
                  <input
                    type="date"
                    className="modern-input"
                    style={{ width: "100%" }}
                    value={advancedFilters?.dateTo || ''}
                    onChange={e => setAdvancedFilters && setAdvancedFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAdvancedFilters && setAdvancedFilters({ country: '', workflowType: '', dateFrom: '', dateTo: '' })}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowAdvSearchModal(false)}
                >
                  Apply Filters ({filteredDocs.length} Matches)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
