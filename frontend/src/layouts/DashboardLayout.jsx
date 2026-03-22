import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderTree, Activity, LogOut, ShieldAlert } from 'lucide-react';

export default function DashboardLayout({ onLogout }) {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('etmf_user') || '{}');

  const navItems = [
    { name: 'My Tasks', path: '/tasks', icon: LayoutDashboard },
    { name: 'TMF Repository', path: '/repository', icon: FolderTree },
    { name: 'AI Governance', path: '/governance', icon: Activity },
    { name: 'System Admin', path: '/admin', icon: ShieldAlert },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      
      {/* Sidebar Navigation */}
      <aside className="glass-panel" style={{ width: '260px', borderRadius: '0', display: 'flex', flexDirection: 'column', borderRight: 'var(--glass-border)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ color: 'var(--accent-blue)', margin: 0, fontSize: '20px' }}>eTMF Pro</h2>
          <span style={{ fontSize: '12px', color: 'var(--sla-green-text)', fontWeight: 500 }}>Live · Ph3 Oncology</span>
        </div>

        <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link 
                key={item.name} 
                to={item.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  borderRadius: '8px', color: isActive ? 'white' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  textDecoration: 'none', fontWeight: isActive ? 500 : 400,
                  transition: 'background 0.2s'
                }}
              >
                <Icon size={18} color={isActive ? 'var(--accent-blue)' : 'currentColor'} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Mini */}
        <div style={{ padding: '20px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.role}</div>
            </div>
            <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>

    </div>
  );
}
