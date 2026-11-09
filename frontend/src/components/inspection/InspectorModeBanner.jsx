import React from 'react';

export default function InspectorModeBanner({ onExit }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #78350f 0%, #b45309 50%, #78350f 100%)',
      color: '#fff',
      padding: '8px 24px',
      fontSize: 12,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>🏛️</span>
        <div>
          <span>HEALTH AUTHORITY INSPECTION MODE ACTIVE</span>
          <span style={{ margin: '0 8px', opacity: 0.6 }}>|</span>
          <span style={{ fontWeight: 400, opacity: 0.9 }}>
            21 CFR Part 11 &amp; ICH E6(R2) §5.5 — Strict Read-Only Lockdown Enforced. All navigation is audited.
          </span>
        </div>
      </div>

      <button
        onClick={onExit}
        style={{
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 4,
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
      >
        Exit Inspection View ✕
      </button>
    </div>
  );
}
