import React from 'react';
import { CalendarDays, LayoutDashboard, Building2, CalendarCheck2, Users, BarChart3, Settings2, User as UserRound, LogOut, ArrowUpRight } from 'lucide-react';
const clientLinks = [{ id: 'home', label: 'Overview', icon: LayoutDashboard }, { id: 'spaces', label: 'Find a venue', icon: Building2 }, { id: 'events', label: 'My bookings', icon: CalendarCheck2 }, { id: 'profile', label: 'My profile', icon: UserRound }];
const managerLinks = [{ id: 'orders', label: 'Orders', icon: CalendarCheck2 }, { id: 'clients', label: 'Assigned clients', icon: Users }, { id: 'schedule', label: 'Venue occupancy', icon: CalendarDays }, { id: 'analytics', label: 'Order overview', icon: BarChart3 }];
export default function Header({ currentRole, activeTab, setActiveTab, currentUser, onLogout }) {
  const links = currentRole === 'client' ? clientLinks : currentRole === 'admin' ? [{ id: 'admin', label: 'Administration', icon: Settings2 }, ...managerLinks.map(link => link.id === 'clients' ? { ...link, label: 'Clients' } : link)] : managerLinks;
  const initials = currentUser.displayName.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return <aside className="sidebar">
    <button className="brand" onClick={() => setActiveTab(links[0].id)} aria-label="Happy Holiday overview"><span className="brand-mark"><CalendarDays size={22} /></span><span>happy holiday<span className="brand-caption">A space for every occasion</span></span></button>
    <div className="workspace-label">{currentRole === 'client' ? 'Your workspace' : 'Management workspace'}</div>
    <nav aria-label="Main navigation">{links.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon size={19} /><span>{label}</span>{activeTab === id && <ArrowUpRight size={15} className="nav-arrow" />}</button>)}</nav>
    <div className="sidebar-bottom"><div className="user-profile"><span className="avatar">{initials}</span><div><strong>{currentUser.displayName}</strong><span>{currentRole === 'admin' ? 'Administrator' : currentRole === 'manager' ? 'Manager' : 'Client account'}</span></div></div>
    <button className="signout" onClick={onLogout}><LogOut size={17} />Sign out</button></div>
  </aside>;
}
