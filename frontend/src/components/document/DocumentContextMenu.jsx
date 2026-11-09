import React from 'react';
import api from '../../api';

export default function DocumentContextMenu({
  contextMenu,
  onClose,
  onView,
  onOpenModal,
  onRefresh
}) {
  if (!contextMenu) return null;
  const targetDoc = contextMenu.doc;

  const items = [
    { l: "View Document", i: "👁️", ax: "view" },
    { l: "Controlled / Compliant Download", i: "📥", ax: "download" },
    { l: "Edit / View Metadata", i: "⚙️", ax: "props" },
    { l: "Document & Workflow History", i: "📜", ax: "hist" },
    { l: targetDoc.status === 'Checked Out' ? "Check In Document" : "Check Out Document", i: "🔓", ax: "checkout" },
    { l: "Redact Document Content", i: "⬛", ax: "redact" },
    { l: "Action Sticky Notes", i: "📝", ax: "notes" },
    { l: targetDoc.is_blinded ? "Unblind Document" : "Blind Document", i: "🔒", ax: "blind" },
    { l: "Link / Relate Documents", i: "🔗", ax: "link" },
    { l: "Raise Document Query", i: "❓", ax: "query" },
    { l: "Inactivate (Soft Delete)", i: "❌", c: "#dc2626", ax: "del" }
  ];

  const handleAction = async (opt, e) => {
    e.stopPropagation();
    onClose();

    if (opt.ax === 'view') {
      onView({
        ...targetDoc,
        version: targetDoc.version || "1.0",
        status: targetDoc.status || "Approved",
        uploadedBy: targetDoc.uploaded_by || targetDoc.author || "Clinical Lead"
      });
    } else if (opt.ax === 'download') {
      onOpenModal({ type: 'download', doc: targetDoc });
    } else if (opt.ax === 'props') {
      onOpenModal({ type: 'metadata', doc: targetDoc });
    } else if (opt.ax === 'hist') {
      onOpenModal({ type: 'history', doc: targetDoc });
    } else if (opt.ax === 'checkout') {
      try {
        const endpoint = targetDoc.status === 'Checked Out'
          ? `/documents/${targetDoc.id}/checkin`
          : `/documents/${targetDoc.id}/checkout`;
        await api.post(endpoint);
        alert(`Successfully updated checkout status for: ${targetDoc.title || targetDoc.id}`);
        onRefresh();
      } catch (err) {
        alert(err.response?.data?.error || "Error updating checkout status");
      }
    } else if (opt.ax === 'redact') {
      onOpenModal({ type: 'redact', doc: targetDoc });
    } else if (opt.ax === 'notes') {
      onOpenModal({ type: 'notes', doc: targetDoc });
    } else if (opt.ax === 'blind') {
      onOpenModal({ type: 'blind', doc: targetDoc });
    } else if (opt.ax === 'link') {
      onOpenModal({ type: 'link', doc: targetDoc });
    } else if (opt.ax === 'query') {
      onOpenModal({ type: 'query', doc: targetDoc });
    } else if (opt.ax === 'del') {
      if (window.confirm(`Are you sure you want to inactivate "${targetDoc.title || 'this document'}"?`)) {
        try {
          await api.delete(`/documents/${targetDoc.id}`);
          alert("Document record inactivated successfully.");
          onRefresh();
        } catch (err) {
          alert(err.response?.data?.error || "Error inactivating document");
        }
      }
    }
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "fixed",
        top: Math.min(contextMenu.y, window.innerHeight - 380),
        left: Math.min(contextMenu.x, window.innerWidth - 260),
        width: 250,
        maxHeight: "85vh",
        overflowY: "auto",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        zIndex: 1000,
        padding: 8,
        animation: "fadeIn 0.15s ease"
      }}
    >
      <div style={{
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 700,
        color: "#0ea5e9",
        borderBottom: "1px solid #f1f5f9",
        marginBottom: 4,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }}>
        Target: {targetDoc.title || targetDoc.name || "System Record"}
      </div>

      {items.map(opt => (
        <div
          key={opt.l}
          onClick={(e) => handleAction(opt, e)}
          style={{
            padding: "8px 12px",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            color: opt.c || "#334155",
            borderRadius: 6,
            display: "flex",
            gap: 10,
            alignItems: "center",
            transition: "background 0.1s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ width: 16, textAlign: "center" }}>{opt.i}</span> {opt.l}
        </div>
      ))}
    </div>
  );
}
