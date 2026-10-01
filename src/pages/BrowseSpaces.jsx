import React, { useState } from 'react';
import { Users } from 'lucide-react';
import Modal from '../components/Modal';

export default function BrowseSpaces({ venues, availableServices, onBookSpace, showToast }) {
  const [selectedVenue, setSelectedVenue]     = useState(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [loading, setLoading]                 = useState(false);

  // Booking form state
  const [eventDate,  setEventDate]  = useState('');
  const [startTime,  setStartTime]  = useState('14:00');
  const [endTime,    setEndTime]    = useState('20:00');
  const [guestCount, setGuestCount] = useState(100);
  const [selectedServices, setSelectedServices] = useState([]);

  const openBookModal = (venue) => {
    setSelectedVenue(venue);
    setSelectedServices([]);
    setIsBookModalOpen(true);
  };

  // Calculate duration in hours between two HH:MM strings
  const calcHours = (start, end) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(1, Math.ceil(diff / 60));
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVenue) return;

    const durationHours = calcHours(startTime, endTime);

    setLoading(true);
    try {
      await onBookSpace({
        premiseId:     selectedVenue.id,           // Guid — what the API needs
        rawDate:       new Date(eventDate).toISOString(), // ISO date for the API
        guests:        Number(guestCount),
        durationHours,
        serviceIds:    selectedServices,
        // UI-only fields for optimistic display
        venue:         selectedVenue.name,
        image:         selectedVenue.image,
        date:          `${eventDate} (${startTime}–${endTime})`,
      });
      setIsBookModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="browse-spaces-page">
      <div className="page-header">
        <h1 className="page-title">Browse Spaces</h1>
        <p className="page-subtitle">Discover and reserve premium architectural venues for your upcoming milestones.</p>
      </div>

      {venues.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          Loading venues…
        </div>
      )}

      <div className="spaces-grid">
        {venues.map((venue) => (
          <div key={venue.id} className="space-card">
            <div className="space-image-container">
              <img src={venue.image} alt={venue.name} className="space-image" />
              <span className="space-tag">{venue.tag}</span>
            </div>
            <div className="space-body">
              <div>
                <h3 className="space-title">{venue.name}</h3>
                <p className="space-desc">{venue.description}</p>
                <div className="event-meta-row" style={{ marginBottom: '14px' }}>
                  <div className="event-meta-item">
                    <Users size={14} />
                    <span>{venue.capacity}</span>
                  </div>
                </div>
              </div>
              <div className="space-footer">
                <div className="space-price">{venue.price} <span>/ hr</span></div>
                <button className="btn-solid-primary" onClick={() => openBookModal(venue)}>
                  Book Space
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title={`Reserve ${selectedVenue?.name}`}
        footer={
          <>
            <button className="btn-outline-neutral" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-solid-primary"
              onClick={handleBookingSubmit}
              disabled={loading}
            >
              {loading ? 'Booking…' : 'Confirm Reservation'}
            </button>
          </>
        }
      >
        <form onSubmit={handleBookingSubmit}>
          <div className="form-group">
            <label>Event Date</label>
            <input
              type="date"
              value={eventDate}
              min={today}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label>Expected Guests</label>
            <input
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              min={1}
              max={selectedVenue?.rawCapacity || 500}
              required
            />
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Additional Services</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '8px' }}>
              {availableServices?.map(service => (
                <label key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(service.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedServices([...selectedServices, service.id]);
                      else setSelectedServices(selectedServices.filter(id => id !== service.id));
                    }}
                  />
                  <span>{service.name} <span style={{ color: '#64748b' }}>(+${service.price})</span></span>
                </label>
              ))}
              {(!availableServices || availableServices.length === 0) && (
                <span style={{ fontSize: '13px', color: '#64748b' }}>No services available</span>
              )}
            </div>
          </div>

          {/* Price summary */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: '8px', padding: '12px 16px', marginTop: '20px',
            fontSize: '13px', color: '#475569',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>Estimated Total:</span>
            <strong style={{ color: '#0f172a', fontSize: '15px' }}>
              ${(
                (selectedVenue?.rawPrice || 0) * calcHours(startTime, endTime) +
                selectedServices.reduce((sum, id) => sum + (availableServices?.find(s => s.id === id)?.price || 0), 0)
              ).toLocaleString()}
            </strong>
          </div>
        </form>
      </Modal>
    </div>
  );
}
