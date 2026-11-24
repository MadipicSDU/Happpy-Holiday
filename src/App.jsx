import React, { useState, useEffect, useRef } from 'react';
import Header, { navLinks, workspaceName } from './components/Header';
import BackToTop from './components/BackToTop';
import NotificationBell from './components/NotificationBell';
import { checkForChanges, loadNotifications, saveNotifications } from './notifications';
import Home from './pages/Home';
import MyEvents from './pages/MyEvents';
import BrowseSpaces from './pages/BrowseSpaces';
import OrderQueue from './pages/OrderQueue';
import MyClients from './pages/MyClients';
import VenueSchedule from './pages/VenueSchedule';
import Analytics from './pages/Analytics';
import Auth from './pages/Auth';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import ManagerDashboard from './pages/ManagerDashboard';
import StaffWorkspace from './pages/StaffWorkspace';
import { api } from './services/api';
import { Loading, ErrorNotice, StartupSkeleton } from './components/UI';
import { CheckCircle2, AlertCircle, RefreshCw, X, ChevronRight } from 'lucide-react';

const initialToken = () => { try { return localStorage.getItem('token'); } catch { return null; } };
const defaultTab = role => role === 'admin' ? 'admin' : role === 'manager' ? 'dashboard' : role === 'staff' ? 'briefs' : 'home';
const tabs = role => role === 'staff' ? ['briefs'] : role === 'client' ? ['home', 'spaces', 'events', 'profile'] : role === 'admin' ? ['admin', 'dashboard', 'orders', 'clients', 'schedule', 'analytics'] : ['dashboard', 'orders', 'clients', 'schedule', 'analytics'];
export default function App() {
  const [token, setToken] = useState(initialToken), [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home'), [version, setVersion] = useState(0);
  const [data, setData] = useState({ venues: [], services: [], orders: [], clients: [] });
  const [loading, setLoading] = useState(Boolean(token)), [error, setError] = useState(''), [authMessage, setAuthMessage] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null), [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());
  const [openOrderId, setOpenOrderId] = useState(null), [notes, setNotes] = useState([]);
  const navigate = (tab, orderId = null) => { setOpenOrderId(orderId); window.location.hash = tab; setActiveTab(tab); };
  const showToast = (message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts(previous => [...previous.slice(-2), { id, message, type }]);
    const timer = setTimeout(() => { setToasts(previous => previous.filter(toast => toast.id !== id)); timers.current.delete(timer); }, 6000);
    timers.current.add(timer);
  };
  const logout = (message = '') => {
    try { localStorage.removeItem('token'); localStorage.removeItem('currentUser'); } catch {}
    setToken(null); setUser(null); setData({ venues: [], services: [], orders: [], clients: [] });
    setUpdatedAt(null); setError(''); setLoading(false); setAuthMessage(message); setToasts([]);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };
  useEffect(() => {
    const expired = () => logout('Your session has expired. Please sign in again.');
    window.addEventListener('session-expired', expired);
    return () => { window.removeEventListener('session-expired', expired); for (const timer of timers.current) clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (!token) return;
    const abort = new AbortController();
    setLoading(true); setError('');
    (async () => {
      try {
        const profile = await api.users.me(token, abort.signal);
        const [venues, services, orders, clients] = profile.role === 'staff' ? [[], [], [], []] : await Promise.all([
          api.premises.getAll(token, abort.signal), api.services.getAll(token, abort.signal), api.orders.getAll(token, abort.signal),
          profile.role === 'client' ? Promise.resolve([]) : api.clients.getAll(token, abort.signal),
        ]);
        if (abort.signal.aborted) return;
        setUser(profile); setData({ venues, services, orders, clients }); setUpdatedAt(new Date());
        try { localStorage.setItem('currentUser', JSON.stringify(profile)); } catch {}
        const hash = window.location.hash.slice(1);
        if (!tabs(profile.role).includes(hash)) navigate(defaultTab(profile.role)); else setActiveTab(hash);
      } catch (err) { if (err.name !== 'AbortError' && !abort.signal.aborted && err.status !== 401) setError(err.message); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, [token, version]);
  useEffect(() => {
    if (!user) return;
    const change = () => {
      const tab = window.location.hash.slice(1);
      if (tabs(user.role).includes(tab)) setActiveTab(tab); else navigate(defaultTab(user.role));
    };
    window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change);
  }, [user?.role]);
  useEffect(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [activeTab]);
  // Notifications: compare orders with what this user last saw; quietly re-check orders every 30 s.
  useEffect(() => { setNotes(user ? loadNotifications(user.id) : []); }, [user?.id]);
  useEffect(() => {
    if (!user || user.role === 'staff' || !updatedAt) return;
    const fresh = checkForChanges(user, data.orders);
    if (!fresh.length) return;
    setNotes(loadNotifications(user.id));
    showToast(fresh.length === 1 ? `${fresh[0].title}: ${fresh[0].detail}` : `${fresh.length} updates on your ${user.role === 'client' ? 'bookings' : 'orders'} — see the bell at the top.`, 'info');
  }, [data.orders, user?.id, updatedAt]);
  useEffect(() => {
    if (!token || !user || user.role === 'staff') return undefined;
    const abort = new AbortController();
    let pending = false;
    const poll = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const orders = await api.orders.getAll(token, abort.signal);
        if (!abort.signal.aborted) {
          setData(previous => ({ ...previous, orders }));
          setUpdatedAt(new Date());
        }
      } catch (error) {
        if (!abort.signal.aborted && error.status !== 401) setError(error.message);
      } finally { pending = false; }
    };
    const timer = setInterval(poll, 30000); document.addEventListener('visibilitychange', poll);
    return () => { abort.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [token, user?.id]);
  const updateNotes = next => { setNotes(next); if (user) saveNotifications(user.id, next); };
  const openNote = item => { updateNotes(notes.map(note => note.id === item.id ? { ...note, read: true } : note)); navigate(user.role === 'client' ? 'events' : 'orders', `${item.orderId}|${item.tab}`); };
  const login = (accessToken, profile) => {
    try { localStorage.setItem('token', accessToken); localStorage.setItem('currentUser', JSON.stringify(profile)); } catch {}
    setAuthMessage(''); setData({ venues: [], services: [], orders: [], clients: [] }); setUpdatedAt(null);
    setToken(accessToken); setUser(profile); navigate(defaultTab(profile.role));
  };
  const refresh = () => setVersion(value => value + 1);
  const refreshOrder = async (id, signal) => {
    const updated = await api.orders.get(token, id, signal);
    if (!signal.aborted) setData(previous => ({ ...previous, orders: previous.orders.map(order => order.id === id ? updated : order) }));
  };
  const book = async payload => {
    const created = await api.orders.create(token, payload);
    setData(previous => ({ ...previous, orders: [created, ...previous.orders] }));
    navigate('events'); showToast('Your order was submitted and assigned to a manager.');
    return created;
  };
  const cancel = async (id, body) => {
    const { order: updated } = await api.cancellations.cancel(token, id, body);
    setData(previous => ({ ...previous, orders: previous.orders.map(order => order.id === id ? { ...order, ...updated } : order) }));
    showToast('Booking cancelled. The venue has been released.');
    return updated;
  };
  const saveProfile = async body => {
    const profile = await api.users.saveProfile(token, body);
    setUser(profile); try { localStorage.setItem('currentUser', JSON.stringify(profile)); } catch {}
    showToast('Contact details saved.'); return profile;
  };
  if (!token) return <Auth onLogin={login} initialMessage={authMessage} />;
  if (!user || !updatedAt) return loading ? <StartupSkeleton /> : <div className="startup"><div className="brand-wordmark">happy holiday</div>
    <ErrorNotice message={error || 'Unable to load your workspace.'} onRetry={refresh} /><button className="button secondary" onClick={() => logout()}>Return to sign in</button></div>;
  const client = user.role === 'client', management = ['manager', 'admin'].includes(user.role);
  const links = navLinks(user.role), current = links.find(link => link.id === activeTab) || links[0], CurrentIcon = current.icon;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <Header currentRole={user.role} currentUser={user} activeTab={activeTab} setActiveTab={navigate} onLogout={() => logout()} />
    <div className="workspace"><header className="workspace-bar">
      <nav className="location-crumbs" aria-label="You are here"><button type="button" className="crumb-root" onClick={() => navigate(links[0].id)}>{workspaceName(user.role)}</button><ChevronRight size={15} aria-hidden="true" /><span className="crumb-current" aria-current="page"><CurrentIcon size={16} aria-hidden="true" />{current.label}</span></nav>
      <div>{user.role !== 'staff' && <NotificationBell items={notes} onOpen={openNote} onReadAll={() => updateNotes(notes.map(note => ({ ...note, read: true })))} onClear={() => updateNotes([])} onPanelOpen={() => setToasts([])} />}<span className="update-time" role="status">{loading ? 'Updating…' : `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span><button className="icon-button" aria-label="Refresh data" title="Refresh data" onClick={refresh} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div></header>
      <main id="main-content" className="main-wrapper" tabIndex={-1}>
        <ErrorNotice message={error ? `${error} Showing the last loaded data.` : ''} onRetry={refresh} />
        {client && activeTab === 'home' && <Home currentUser={user} orders={data.orders} onNavigate={navigate} />}
        {client && activeTab === 'spaces' && <BrowseSpaces venues={data.venues} availableServices={data.services} token={token} orders={data.orders} onBookSpace={book} />}
        {client && activeTab === 'events' && <MyEvents openOrderId={openOrderId} venues={data.venues} services={data.services} orders={data.orders} onCancel={cancel} onNavigate={navigate} token={token} onRefresh={refresh} onRefreshOrder={refreshOrder} />}
        {client && activeTab === 'profile' && <Profile user={user} onSave={saveProfile} />}
        {management && activeTab === 'dashboard' && <ManagerDashboard token={token} refreshVersion={version} isAdmin={user.role === 'admin'} onOpenOrder={(id, tab) => navigate('orders', tab ? `${id}|${tab}` : id)} />}
        {user.role === 'staff' && activeTab === 'briefs' && <StaffWorkspace token={token} refreshVersion={version} />}
        {management && activeTab === 'orders' && <OrderQueue openOrderId={openOrderId} orders={data.orders} onCancel={cancel} isAdmin={user.role === 'admin'} token={token} onRefresh={refresh} onRefreshOrder={refreshOrder} />}
        {management && activeTab === 'clients' && <MyClients clients={data.clients} showToast={showToast} isAdmin={user.role === 'admin'} />}
        {management && activeTab === 'schedule' && <VenueSchedule token={token} refreshVersion={version} onOpenOrder={id => navigate('orders', id)} />}
        {management && activeTab === 'analytics' && <Analytics orders={data.orders} venues={data.venues} services={data.services} token={token} refreshVersion={version} isAdmin={user.role === 'admin'} />}
        {user.role === 'admin' && activeTab === 'admin' && <AdminDashboard token={token} showToast={showToast} venues={data.venues} services={data.services} onRefresh={refresh} currentUser={user} />}
      </main><BackToTop /><footer className="workspace-footer"><span>Happy Holiday · Event spaces & services</span><span>All prices in KZT</span></footer>
    </div>
    <div className="toast-container">{toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      {toast.type === 'error' ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}<span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToasts(previous => previous.filter(item => item.id !== toast.id))}><X size={16} /></button>
    </div>)}</div>
  </div>;
}
