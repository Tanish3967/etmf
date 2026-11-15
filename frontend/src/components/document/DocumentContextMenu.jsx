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

  const isCheckedOut = Boolean(targetDoc.checked_out_by) || targetDoc.status === 'Checked Out';
  const items = [
    { l: "View Document", i: "👁️", ax: "view" },
    { l: "Advance Workflow State", i: "⚡", ax: "advance" },
    { l: "Controlled / Compliant Download", i: "📥", ax: "download" },
    { l: "Download Original File", i: "📄", ax: "download_original" },
    { l: "Edit / View Metadata", i: "⚙️", ax: "props" },
    { l: "Document & Workflow History", i: "📜", ax: "hist" },
    { l: "View Access History", i: "👣", ax: "access_history" },
    { l: isCheckedOut ? "Check In Document (New Version)" : "Check Out Document", i: "🔓", ax: "checkout" },
    ...(isCheckedOut ? [{ l: "Uncheck Document (Release Lock)", i: "↩️", ax: "uncheck" }] : []),
    { l: "Quality Check (Audit Plan)", i: "✅", ax: "qc" },
    { l: "Self-Assign / Claim Task", i: "🙋", ax: "self_assign" },
    { l: targetDoc.is_pinned ? "Unpin Document" : "Pin Document", i: "📌", ax: "pin" },
    { l: "Copy Document", i: "📋", ax: "copy" },
    { l: "Move Document", i: "📂", ax: "move" },
    { l: "Redact Document Content", i: "⬛", ax: "redact" },
    { l: "Action Sticky Notes", i: "📝", ax: "notes" },
    { l: (targetDoc.is_blinded || targetDoc.confidential) ? "Unblind Document" : "Blind Document", i: "🔒", ax: "blind" },
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
    } else if (opt.ax === 'advance') {
      onOpenModal({ type: 'advance_workflow', doc: targetDoc });
    } else if (opt.ax === 'download') {
      onOpenModal({ type: 'download', doc: targetDoc });
    } else if (opt.ax === 'download_original') {
      try {
        const res = await api.post(`/documents/${targetDoc.id}/download`, { type: 'original', reason: 'Direct Original Download' });
        alert(`${res.data.message || 'Download recorded'} (Watermark: ${res.data.watermark})`);
      } catch (err) {
        alert(err.response?.data?.error || 'Download failed');
      }
    } else if (opt.ax === 'props') {
      onOpenModal({ type: 'metadata', doc: targetDoc });
    } else if (opt.ax === 'hist') {
      onOpenModal({ type: 'history', doc: targetDoc });
    } else if (opt.ax === 'access_history') {
      try {
        const res = await api.get(`/documents/${targetDoc.id}/access-history`);
        const rows = res.data?.history || [];
        const msg = rows.slice(0, 8).map(h => `• [${h.created_at}] ${h.user_name}: ${h.action} (v${h.version || '1.0'})`).join('\n');
        alert(`Access History for "${targetDoc.title}" (${rows.length} events):\n\n${msg || 'No access records yet.'}`);
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to load access history');
      }
    } else if (opt.ax === 'checkout') {
      try {
        if (isCheckedOut) {
          const reason = window.prompt('Enter Check-In comments (creates new version):', 'Updated clinical content') || 'Check-in revision';
          await api.post(`/documents/${targetDoc.id}/checkin`, { incrementVersion: true, reason });
          alert(`Checked in new version for: ${targetDoc.title || targetDoc.id}`);
        } else {
          await api.post(`/documents/${targetDoc.id}/checkout`);
          alert(`Checked out document: ${targetDoc.title || targetDoc.id}`);
        }
        onRefresh();
      } catch (err) {
        alert(err.response?.data?.error || "Error updating checkout status");
      }
    } else if (opt.ax === 'uncheck') {
      try {
        await api.post(`/documents/${targetDoc.id}/uncheck`);
        alert(`Check-out lock released for: ${targetDoc.title || targetDoc.id}`);
        onRefresh();
      } catch (err) {
        alert(err.response?.data?.error || "Error releasing check-out lock");
      }
    } else if (opt.ax === 'qc') {
      onOpenModal({ type: 'quality_check', doc: targetDoc });
    } else if (opt.ax === 'self_assign') {
      try {
        await api.patch(`/documents/${targetDoc.id}/self-assign`, { role: 'reviewer', release: false });
        alert(`Self-assigned "${targetDoc.title}" for review.`);
        onRefresh();
      } catch (err) {
        alert(err.response?.data?.error || 'Self-assign failed');
      }
    } else if (opt.ax === 'pin') {
      try {
        await api.patch(`/documents/${targetDoc.id}/pin`, { isPinned: !targetDoc.is_pinned });
        onRefresh();
      } catch (err) {
        alert(err.response?.data?.error || 'Pin update failed');
      }
    } else if (opt.ax === 'copy') {
      const targetArtifact = window.prompt('Target Artifact Code for Copy:', targetDoc.artifact_code || '01.01.01');
      if (targetArtifact) {
        try {
          await api.post(`/documents/${targetDoc.id}/copy`, { artifactCode: targetArtifact });
          alert('Document copied successfully!');
          onRefresh();
        } catch (err) {
          alert(err.response?.data?.error || 'Copy failed');
        }
      }
    } else if (opt.ax === 'move') {
      const targetArtifact = window.prompt('Target Artifact Code for Move:', targetDoc.artifact_code || '01.01.02');
      if (targetArtifact) {
        try {
          await api.patch(`/documents/${targetDoc.id}/move`, { artifactCode: targetArtifact, reason: 'User initiated folder move' });
          alert('Document moved successfully!');
          onRefresh();
        } catch (err) {
          alert(err.response?.data?.error || 'Move failed');
        }
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
          if (err.response?.status === 409 && err.response?.data?.code === 'AUDITED_DOC_LOCKED') {
            alert(
              `🔒 INACTIVATION PROHIBITED (21 CFR Part 11 & GCP Audit Trail Requirement)\n\n` +
              `Document "${targetDoc.title}" has been formally audited in Quality Control Plan (${err.response.data.audit_plan_id || 'Active Plan'}) and is permanently locked against deletion or inactivation.\n\n` +
              `Reason: Regulatory retention mandates preservation of all audited trial master file artifacts.`
            );
          } else {
            alert(err.response?.data?.error || "Error inactivating document");
          }
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
