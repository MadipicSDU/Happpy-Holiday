import React from 'react';
import { Calendar, Repeat } from 'lucide-react';

export default function Header({ currentRole, setRole, activeTab, setActiveTab }) {
  const isManager = currentRole === 'manager';

  const clientLinks = [
    { id: 'home', label: 'Home' },
    { id: 'spaces', label: 'Browse Spaces' },
    { id: 'events', label: 'My Events' }
  ];

  const managerLinks = [
    { id: 'orders', label: 'Orders' },
    { id: 'clients', label: 'Clients' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'analytics', label: 'Analytics' }
  ];

  const links = isManager ? managerLinks : clientLinks;

  const toggleRole = () => {
    if (isManager) {
      setRole('client');
      setActiveTab('home');
    } else {
      setRole('manager');
      setActiveTab('orders');
    }
  };

  return (
    <header className="site-header">
      <div className="header-container">
        {/* Brand */}
        <div 
          className="brand-wrapper" 
          onClick={() => setActiveTab(isManager ? 'orders' : 'home')}
        >
          <div className="brand-icon">
            <Calendar size={18} strokeWidth={2.4} />
          </div>
          <span className="brand-text">Happy Holiday</span>
        </div>

        {/* Navigation items */}
        <nav className="nav-links">
          {links.map((link) => (
            <button
              key={link.id}
              className={`nav-item ${activeTab === link.id ? 'active' : ''}`}
              onClick={() => setActiveTab(link.id)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right side: Switcher & User Avatar */}
        <div className="header-right">
          <button 
            className="role-switcher-btn" 
            onClick={toggleRole}
            title="Toggle between Client and Manager portal views"
          >
            <Repeat size={13} />
            <span>{isManager ? 'Switch to Client View' : 'Switch to Manager View'}</span>
          </button>

          <div className="user-profile">
            <div className="user-avatar">
              {isManager ? 'M' : 'A'}
            </div>
            <span className="user-name">
              {isManager ? 'Manager Portal' : 'Alex Wong'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
