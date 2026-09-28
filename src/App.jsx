import React, { useState } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import MyEvents from './pages/MyEvents';
import BrowseSpaces from './pages/BrowseSpaces';
import OrderQueue from './pages/OrderQueue';
import MyClients from './pages/MyClients';
import VenueSchedule from './pages/VenueSchedule';
import Analytics from './pages/Analytics';
import { 
  initialEvents, 
  initialClients, 
  initialOrders, 
  initialVenues 
} from './data/mockData';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  // Role: 'client' | 'manager'
  const [currentRole, setRole] = useState('client');
  // Active navigation tab
  const [activeTab, setActiveTab] = useState('home');

  // Shared application state
  const [events, setEvents] = useState(initialEvents);
  const [orders, setOrders] = useState(initialOrders);
  const [clients, setClients] = useState(initialClients);
  const [venues, setVenues] = useState(initialVenues);

  // Toast system
  const [toasts, setToasts] = useState([]);

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  // Event handlers
  const handleUpdateEvent = (id, updatedFields) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updatedFields } : e))
    );
  };

  const handleCancelEvent = (id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleBookSpace = (newEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
    // Also create corresponding manager order
    const newOrder = {
      id: `ORD-${Math.floor(5550 + Math.random() * 500)}`,
      client: 'Alex Wong',
      venue: newEvent.venue,
      eventDate: newEvent.date.split(' ')[0],
      status: 'awaiting-payment',
      statusLabel: 'Awaiting Payment',
      amount: '$1,800.00',
      guests: newEvent.guests
    };
    setOrders((prev) => [newOrder, ...prev]);
    setActiveTab('events');
  };

  const handleUpdateOrderStatus = (orderId, newStatus, newLabel) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: newStatus, statusLabel: newLabel }
          : o
      )
    );
  };

  // Find next upcoming confirmed event
  const nextEvent = events.find((e) => e.isNext) || events[0];

  return (
    <div className="app-container">
      <Header
        currentRole={currentRole}
        setRole={setRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="main-wrapper">
        {/* Client Portal Views */}
        {currentRole === 'client' && (
          <>
            {activeTab === 'home' && (
              <Home 
                onNavigate={(tab) => setActiveTab(tab)} 
                nextEvent={nextEvent}
              />
            )}
            {activeTab === 'events' && (
              <MyEvents
                events={events}
                onUpdateEvent={handleUpdateEvent}
                onCancelEvent={handleCancelEvent}
                showToast={showToast}
              />
            )}
            {activeTab === 'spaces' && (
              <BrowseSpaces
                venues={venues}
                onBookSpace={handleBookSpace}
                showToast={showToast}
              />
            )}
          </>
        )}

        {/* Manager Portal Views */}
        {currentRole === 'manager' && (
          <>
            {activeTab === 'orders' && (
              <OrderQueue
                orders={orders}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                showToast={showToast}
              />
            )}
            {activeTab === 'clients' && (
              <MyClients
                clients={clients}
                showToast={showToast}
              />
            )}
            {activeTab === 'schedule' && (
              <VenueSchedule
                showToast={showToast}
              />
            )}
            {activeTab === 'analytics' && (
              <Analytics />
            )}
          </>
        )}
      </main>

      {/* Floating Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <CheckCircle2 size={18} color="#2563eb" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
