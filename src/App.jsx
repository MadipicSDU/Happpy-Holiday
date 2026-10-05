import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
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
import { api } from './services/api';
import { Loading, ErrorNotice } from './components/UI';
import { CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

const initialToken = () => { try { return localStorage.getItem('token'); } catch { return null; } };
const defaultTab = role => role === 'admin' ? 'admin' : role === 'manager' ? 'orders' : 'home';
const tabs = role => role === 'client' ? ['home', 'spaces', 'events', 'profile'] : role === 'admin' ? ['admin', 'orders', 'clients', 'schedule', 'analytics'] : ['orders', 'clients', 'schedule', 'analytics'];
export default function App() {
  const [token, setToken] = useState(initialToken), [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home'), [version, setVersion] = useState(0);
  const [data, setData] = useState({ venues: [], services: [], orders: [], clients: [] });
  const [loading, setLoading] = useState(Boolean(token)), [error, setError] = useState(''), [authMessage, setAuthMessage] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null), [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());
  const navigate = tab => { window.location.hash = tab; setActiveTab(tab); };
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
        const [venues, services, orders, clients] = await Promise.all([
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
  const login = (accessToken, profile) => {
    try { localStorage.setItem('token', accessToken); localStorage.setItem('currentUser', JSON.stringify(profile)); } catch {}
    setAuthMessage(''); setData({ venues: [], services: [], orders: [], clients: [] }); setUpdatedAt(null);
    setToken(accessToken); setUser(profile); navigate(defaultTab(profile.role));
  };
  const refresh = () => setVersion(value => value + 1);
  const book = async payload => {
    const created = await api.orders.create(token, payload);
    setData(previous => ({ ...previous, orders: [created, ...previous.orders] }));
    navigate('events'); showToast('Your order was submitted and assigned to a manager.');
    return created;
  };
  const cancel = async id => {
    const updated = await api.orders.updateStatus(token, id, 'cancelled');
    setData(previous => ({ ...previous, orders: previous.orders.map(order => order.id === id ? { ...order, ...updated } : order) }));
    showToast('Booking cancelled. The venue has been released.');
  };
  const saveProfile = async body => {
    const profile = await api.users.saveProfile(token, body);
    setUser(profile); try { localStorage.setItem('currentUser', JSON.stringify(profile)); } catch {}
    showToast('Contact details saved.'); return profile;
  };
  if (!token) return <Auth onLogin={login} initialMessage={authMessage} />;
  if (!user || !updatedAt) return <div className="startup"><div className="brand-wordmark">happy holiday</div>
    {loading ? <Loading label="Opening your workspace…" /> : <><ErrorNotice message={error || 'Unable to load your workspace.'} onRetry={refresh} /><button className="button secondary" onClick={() => logout()}>Return to sign in</button></>}</div>;
  const client = user.role === 'client';
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <Header currentRole={user.role} currentUser={user} activeTab={activeTab} setActiveTab={navigate} onLogout={() => logout()} />
    <div className="workspace"><div className="workspace-bar"><span>{client ? 'Plan your next occasion' : 'Happy Holiday operations'}</span><div><span className="update-time">Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button className="icon-button" aria-label="Refresh workspace" onClick={refresh} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div></div>
      <main id="main-content" className="main-wrapper" tabIndex={-1}>
        <ErrorNotice message={error ? `${error} Showing the last loaded data.` : ''} onRetry={refresh} />
        {client && activeTab === 'home' && <Home currentUser={user} orders={data.orders} onNavigate={navigate} />}
        {client && activeTab === 'spaces' && <BrowseSpaces venues={data.venues} availableServices={data.services} token={token} orders={data.orders} onBookSpace={book} />}
        {client && activeTab === 'events' && <MyEvents orders={data.orders} onCancel={cancel} onNavigate={navigate} />}
        {client && activeTab === 'profile' && <Profile user={user} onSave={saveProfile} />}
        {!client && activeTab === 'orders' && <OrderQueue orders={data.orders} onCancel={cancel} isAdmin={user.role === 'admin'} />}
        {!client && activeTab === 'clients' && <MyClients clients={data.clients} showToast={showToast} isAdmin={user.role === 'admin'} />}
        {!client && activeTab === 'schedule' && <VenueSchedule token={token} refreshVersion={version} />}
        {!client && activeTab === 'analytics' && <Analytics orders={data.orders} venues={data.venues} isAdmin={user.role === 'admin'} />}
        {user.role === 'admin' && activeTab === 'admin' && <AdminDashboard token={token} showToast={showToast} venues={data.venues} services={data.services} onRefresh={refresh} currentUser={user} />}
      </main><footer className="workspace-footer"><span>Happy Holiday · Event spaces & services</span><span>All prices in KZT</span></footer>
    </div>
    <div className="toast-container">{toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      {toast.type === 'error' ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}<span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToasts(previous => previous.filter(item => item.id !== toast.id))}><X size={16} /></button>
    </div>)}</div>
  </div>;
}
