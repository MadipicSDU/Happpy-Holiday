import React from 'react';
import { Calendar, LogOut } from 'lucide-react';

export default function Header({ currentRole, activeTab, setActiveTab, currentUser, onLogout }) {
  const isManager = currentRole === 'manager' || currentRole === 'admin';
  const isAdmin = currentRole === 'admin';

  const clientLinks = [
    { id: 'home',   label: 'Home' },
    { id: 'spaces', label: 'Browse Spaces' },
    { id: 'events', label: 'My Events' },
  ];

  const managerLinks = [
    { id: 'orders',    label: 'Order Queue' },
    { id: 'clients',   label: 'My Clients' },
    { id: 'schedule',  label: 'Schedule' },
    { id: 'analytics', label: 'Analytics' },
  ];

  let links = clientLinks;
  if (isAdmin) {
    links = [{ id: 'admin', label: 'Admin Dashboard' }, ...managerLinks];
  } else if (isManager) {
    links = managerLinks;
  }

  const initials = currentUser?.displayName
    ? currentUser.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const roleLabel = currentUser?.role === 'admin'
    ? 'Admin'
    : currentUser?.role === 'manager'
    ? 'Manager'
    : 'Client';

  return (
    <header className="site-header">
      <div className="header-container">
        {/* Brand */}
        <div
          className="brand-wrapper"
          onClick={() => setActiveTab(isManager ? 'orders' : 'home')}
          style={{ cursor: 'pointer' }}
        >
          <div className="brand-icon">
            <Calendar size={18} strokeWidth={2.4} />
          </div>
          <span className="brand-text">Happy Holiday</span>
        </div>

        {/* Nav */}
        <nav className="nav-links">
          {links.map(link => (
            <button
              key={link.id}
              className={`nav-item ${activeTab === link.id ? 'active' : ''}`}
              onClick={() => setActiveTab(link.id)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right side — user info + logout only, no role switcher */}
        <div className="header-right">
          <div className="user-profile">
            <div className="user-avatar" title={roleLabel}>{initials}</div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span className="user-name">{currentUser?.displayName || 'User'}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{roleLabel}</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Logout"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: '6px', padding: '6px 12px',
              cursor: 'pointer', color: '#64748b', fontSize: '13px'
            }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
