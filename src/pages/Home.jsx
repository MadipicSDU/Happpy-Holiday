import React from 'react';
import { Search, Calendar, Users, Clock } from 'lucide-react';

export default function Home({ onNavigate, nextEvent, currentUser }) {
  // Use real display name, fallback to "User" if missing
  const firstName = currentUser?.displayName ? currentUser.displayName.split(' ')[0] : 'User';

  return (
    <div className="home-page">
      <div className="page-header">
        <h1 className="page-title">Welcome back, {firstName}</h1>
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
        
        {nextEvent ? (
          <div className="next-event-card">
            <div className="event-card-left">
              <img 
                src={nextEvent.image} 
                alt={nextEvent.venue} 
                className="event-venue-thumb" 
              />
              <div className="event-venue-details">
                <h3 className="event-venue-title">{nextEvent.venue}</h3>
                <div className="event-meta-row">
                  <div className="event-meta-item">
                    <Calendar size={15} />
                    <span>{nextEvent.date}</span>
                  </div>
                  <div className="event-meta-item">
                    <Users size={15} />
                    <span>{nextEvent.guests} Guests</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="event-card-right">
              <span className={`status-badge ${nextEvent.status}`}>{nextEvent.statusLabel}</span>
              <span className="ref-code">Ref: {nextEvent.id}</span>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <Calendar size={32} style={{ opacity: 0.5, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>You don't have any upcoming events.</p>
            <button 
              className="btn-solid-primary"
              onClick={() => onNavigate('spaces')}
            >
              Book a Space
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
