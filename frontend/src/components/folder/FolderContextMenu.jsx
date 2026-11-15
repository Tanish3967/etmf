import React from 'react';

export default function FolderContextMenu({ x, y, node, onClose, onAction }) {
  const items = [
    { id: 'add_placeholder', label: '+ Add Expected Placeholder', icon: '📝' },
    { id: 'file_plan', label: 'Configure File Plan (EDL)', icon: '📋' },
    { id: 'assign_group', label: 'Assign User Group (Cascade)', icon: '👥' },
    { id: 'revoke_privileges', label: 'Revoke Group Privileges', icon: '🚫' },
    { id: 'toggle_lock', label: 'Lock / Unlock Folder', icon: '🔒', color: '#b45309' },
    { id: 'pin_user', label: 'Pin / Unpin (User Level)', icon: '⭐' },
    { id: 'pin_enterprise', label: 'Pin / Unpin (Enterprise Level)', icon: '📌' },
    { id: 'update_milestone', label: 'Update Milestone Dates', icon: '📅' },
    { id: 'distribution', label: 'Distribution & Notifications', icon: '📧' },
    { id: 'tmf_index', label: 'Generate TMF Index', icon: '📑' },
    { id: 'export_folder', label: 'Export Folder Archive (ZIP)', icon: '📦' },
    { id: 'view_properties', label: 'Folder Properties & Inventory', icon: 'ℹ️' },
    { id: 'view_history', label: 'View Folder Audit History', icon: '📜' },
  ];

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 420 : y),
        left: Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 260 : x),
        width: 250,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
        zIndex: 2000,
        padding: 6,
        animation: 'fadeIn 0.15s ease'
      }}
    >
      <div style={{
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 700,
        color: '#0ea5e9',
        borderBottom: '1px solid #f1f5f9',
        marginBottom: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        📁 {node?.name || 'Folder Node'}
      </div>

      {items.map(item => (
        <div
          key={item.id}
          onClick={() => {
            onClose();
            onAction(item.id, node);
          }}
          style={{
            padding: '6px 10px',
            fontSize: 11.5,
            fontWeight: 500,
            cursor: 'pointer',
            color: item.color || '#334155',
            borderRadius: 6,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            transition: 'background 0.1s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
