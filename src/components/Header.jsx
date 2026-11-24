import React from 'react';
import { CalendarDays, LayoutDashboard, Building2, CalendarCheck2, Users, BarChart3, Settings2, User as UserRound, LogOut, ClipboardList } from 'lucide-react';

// One source of truth for navigation: the sidebar, the mobile tab bar and the breadcrumb in the top bar all read it.
// `short` is the label used in the mobile bottom tab bar, where space is tight.
const clientLinks = [
  { id: 'home', label: 'Overview', short: 'Home', icon: LayoutDashboard },
  { id: 'spaces', label: 'Find a venue', short: 'Venues', icon: Building2 },
  { id: 'events', label: 'My bookings', short: 'Bookings', icon: CalendarCheck2 },
  { id: 'profile', label: 'My profile', short: 'Profile', icon: UserRound },
];
const managerLinks = [
  { id: 'dashboard', label: 'Dashboard', short: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', short: 'Orders', icon: CalendarCheck2 },
  { id: 'clients', label: 'Assigned clients', short: 'Clients', icon: Users },
  { id: 'schedule', label: 'Venue occupancy', short: 'Occupancy', icon: CalendarDays },
  { id: 'analytics', label: 'Reports', short: 'Reports', icon: BarChart3 },
];
export function navLinks(role) {
  if (role === 'staff') return [{ id: 'briefs', label: 'Execution briefs', short: 'Briefs', icon: ClipboardList }];
  if (role === 'client') return clientLinks;
  if (role === 'admin') return [{ id: 'admin', label: 'Administration', short: 'Admin', icon: Settings2 }, ...managerLinks.map(link => link.id === 'clients' ? { ...link, label: 'Clients' } : link)];
  return managerLinks;
}
export const workspaceName = role => role === 'client' ? 'Your workspace' : role === 'staff' ? 'Execution workspace' : 'Management workspace';
const roleName = role => ({ admin: 'Administrator', manager: 'Manager', staff: 'Service staff' }[role] || 'Client account');

export default function Header({ currentRole, activeTab, setActiveTab, currentUser, onLogout }) {
  const links = navLinks(currentRole);
  const initials = currentUser.displayName.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return <aside className="sidebar">
    <button className="brand" onClick={() => setActiveTab(links[0].id)} aria-label={`Happy Holiday — go to ${links[0].label}`}><span className="brand-mark"><CalendarDays size={22} /></span><span>happy holiday<span className="brand-caption">A space for every occasion</span></span></button>
    <div className="workspace-label" id="nav-label">{workspaceName(currentRole)}</div>
    <nav aria-labelledby="nav-label" className={`main-nav nav-count-${links.length}`}>{links.map(({ id, label, short, icon: Icon }) => <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon size={19} aria-hidden="true" /><span className="nav-label-long">{label}</span><span className="nav-label-short" aria-hidden="true">{short}</span></button>)}</nav>
    <div className="sidebar-bottom"><div className="user-profile"><span className="avatar" aria-hidden="true">{initials}</span><div><strong>{currentUser.displayName}</strong><span>{roleName(currentRole)}</span></div></div>
    <button className="signout" onClick={onLogout}><LogOut size={17} aria-hidden="true" />Sign out</button></div>
  </aside>;
}
