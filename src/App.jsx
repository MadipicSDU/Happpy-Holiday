import React, { useState, useEffect } from 'react';
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
import { api } from './services/api';
import { CheckCircle2 } from 'lucide-react';

const IMAGES = [
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop',
];

function venueImage(name = '') {
  return IMAGES[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % IMAGES.length];
}

function getDefaultTab(role) {
  if (role === 'admin') return 'admin';
  return (role === 'manager') ? 'orders' : 'home';
}

export default function App() {
  // ── Auth (persisted synchronously) ─────────────────────────────
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('currentUser')); } catch { return null; }
  });

  // ── Navigation ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('currentUser'));
      return u ? getDefaultTab(u.role) : 'home';
    } catch { return 'home'; }
  });

  // ── All data from API (no mock data) ───────────────────────────
  const [venues,  setVenues]  = useState([]);
  const [orders,  setOrders]  = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [toasts,  setToasts]  = useState([]);

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  // ── Fetch everything from the API ──────────────────────────────
  useEffect(() => {
    if (!token) return;

    // Premises / venues
    api.premises.getAll(token).then(data =>
      setVenues(data.map(p => ({
        id:          p.id,
        name:        p.name,
        address:     p.address,
        tag:         'Rental Venue',
        capacity:    `${p.capacity} Guests`,
        rawCapacity: p.capacity,
        price:       `$${p.pricePerHour}/hr`,
        rawPrice:    p.pricePerHour,
        description: p.description || p.address,
        image:       p.imageUrl || venueImage(p.name),
        imageUrl:    p.imageUrl
      })))
    ).catch(console.error);

    // Services
    api.services.getAll(token).then(setServices).catch(console.error);

    // Orders (client sees own, manager sees all)
    api.orders.getAll(token).then(setOrders).catch(console.error);

    // Clients list — manager only
    if (isManager) {
      api.clients.getAll(token).then(setClients).catch(console.error);
    }
  }, [token]);   // intentionally only re-run on token change

  // ── Auth ───────────────────────────────────────────────────────
  const handleLogin = (accessToken, user) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setToken(accessToken);
    setCurrentUser(user);
    setActiveTab(getDefaultTab(user.role));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    setToken(null);
    setCurrentUser(null);
    setVenues([]); setOrders([]); setClients([]);
  };

  // ── Toast ──────────────────────────────────────────────────────
  const showToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // ── Book a space → POST /api/orders ────────────────────────────
  const handleBookSpace = async (payload) => {
    try {
      const created = await api.orders.create(token, {
        premiseId:    payload.premiseId,
        eventDate:    payload.rawDate,
        guests:       payload.guests,
        durationHours: payload.durationHours,
        serviceIds:   payload.serviceIds || [],
      });
      // Add the new order to the list immediately (optimistic)
      setOrders(prev => [created, ...prev]);
      setActiveTab('events');
      showToast(`✓ Booking confirmed! Reference: ${created.id}`);
    } catch (err) {
      showToast('❌ Booking failed — please try again.');
      throw err; // re-throw so BrowseSpaces can reset its loading state
    }
  };

  // ── Manager: update order status ───────────────────────────────
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const updated = await api.orders.updateStatus(token, orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      showToast(`Order ${orderId} → "${updated.statusLabel}"`);
    } catch {
      showToast('Failed to update order status.');
    }
  };

  // ── Guard ──────────────────────────────────────────────────────
  if (!token || !currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  // Map API orders to the shape MyEvents expects
  const events = orders.map(o => ({
    id:          o.id,
    title:       o.venue || 'Event',
    date:        o.eventDate,
    guests:      o.guests,
    venue:       o.venue,
    status:      o.status,
    statusLabel: o.statusLabel,
    feeNotice:   o.status === 'confirmed' ? '* Cancellation fee may apply' : null,
    image:       venueImage(o.venue),
    isNext:      o.status === 'confirmed',
  }));

  const nextEvent = events.find(e => e.status === 'confirmed') || events[0];

  return (
    <div className="app-container">
      <Header
        currentRole={currentUser?.role || 'client'}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-wrapper">
        {/* Client pages */}
        {!isManager && (
          <>
            {activeTab === 'home'   && <Home onNavigate={setActiveTab} nextEvent={nextEvent} currentUser={currentUser} />}
            {activeTab === 'events' && (
              <MyEvents
                events={events}
                onUpdateEvent={() => {}}
                onCancelEvent={() => {}}
                showToast={showToast}
              />
            )}
            {activeTab === 'spaces' && (
              <BrowseSpaces venues={venues} availableServices={services} onBookSpace={handleBookSpace} showToast={showToast} />
            )}
          </>
        )}

        {/* Manager / Admin pages */}
        {isManager && (
          <>
            {activeTab === 'admin'     && currentUser?.role === 'admin' && (
              <AdminDashboard token={token} showToast={showToast} venues={venues} setVenues={setVenues} services={services} setServices={setServices} />
            )}
            {activeTab === 'orders'    && (
              <OrderQueue orders={orders} onUpdateOrderStatus={handleUpdateOrderStatus} showToast={showToast} />
            )}
            {activeTab === 'clients'   && <MyClients clients={clients} showToast={showToast} />}
            {activeTab === 'schedule'  && <VenueSchedule showToast={showToast} />}
            {activeTab === 'analytics' && <Analytics orders={orders} venues={venues} />}
          </>
        )}
      </main>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <CheckCircle2 size={18} color="#2563eb" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
