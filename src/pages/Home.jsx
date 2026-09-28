import React from 'react';
import { Search, Calendar, Users, Clock } from 'lucide-react';

export default function Home({ onNavigate, nextEvent }) {
  const event = nextEvent || {
    id: 'HH-492318',
    title: 'Alex & Sarah Wedding Reception',
    venue: 'Grand Ballroom Atrium',
    date: 'Oct 14, 2025 (10:00 AM - 16:00 PM)',
    guests: 120,
    status: 'confirmed',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=600&auto=format&fit=crop'
  };

  return (
    <div className="home-page">
      <div className="page-header">
        <h1 className="page-title">Welcome back, Alex</h1>
        <p className="page-subtitle">Find, book, and manage beautiful event spaces for any occasion.</p>
      </div>

      {/* Quick Action Cards */}
      <div className="quick-actions-grid">
        <div className="quick-action-card">
          <div className="quick-action-left">
            <div className="action-icon-bubble">
              <Search size={22} strokeWidth={2.2} />
            </div>
            <div className="action-info">
              <h3>Browse Spaces</h3>
              <p>Explore wedding halls, corporate halls, and banquet spaces.</p>
            </div>
          </div>
          <button 
            className="btn-outline-primary"
            onClick={() => onNavigate('spaces')}
          >
            Explore
          </button>
        </div>

        <div className="quick-action-card">
          <div className="quick-action-left">
            <div className="action-icon-bubble">
              <Calendar size={22} strokeWidth={2.2} />
            </div>
            <div className="action-info">
              <h3>My Events</h3>
              <p>View and manage your current bookings and service checklists.</p>
            </div>
          </div>
          <button 
            className="btn-outline-primary"
            onClick={() => onNavigate('events')}
          >
            View Bookings
          </button>
        </div>
      </div>

      {/* Your Next Event Section */}
      <div className="next-event-section">
        <div className="section-label">Your Next Event</div>
        <div className="next-event-card">
          <div className="event-card-left">
            <img 
              src={event.image} 
              alt={event.venue} 
              className="event-venue-thumb" 
            />
            <div className="event-venue-details">
              <h3 className="event-venue-title">{event.venue}</h3>
              <div className="event-meta-row">
                <div className="event-meta-item">
                  <Calendar size={15} />
                  <span>{event.date}</span>
                </div>
                <div className="event-meta-item">
                  <Users size={15} />
                  <span>{event.guests} Guests</span>
                </div>
              </div>
            </div>
          </div>

          <div className="event-card-right">
            <span className="status-badge confirmed">Booking Confirmed</span>
            <span className="ref-code">Ref: {event.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
