import React, { useState } from 'react';
import { Users, DollarSign, Calendar, CheckCircle2 } from 'lucide-react';
import Modal from '../components/Modal';

export default function BrowseSpaces({ venues, onBookSpace, showToast }) {
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  // Booking form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('2025-11-20');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('20:00');
  const [guestCount, setGuestCount] = useState(100);

  const openBookModal = (venue) => {
    setSelectedVenue(venue);
    setEventTitle(`${venue.name} Reception`);
    setIsBookModalOpen(true);
  };

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    if (!selectedVenue) return;

    const newId = `HH-${Math.floor(100000 + Math.random() * 900000)}`;
    const formattedDate = `${eventDate} (${startTime} - ${endTime})`;

    onBookSpace({
      id: newId,
      title: eventTitle || `${selectedVenue.name} Gathering`,
      date: formattedDate,
      guests: Number(guestCount),
      venue: selectedVenue.name,
      status: 'pending',
      statusLabel: 'Pending',
      feeNotice: `* Cancellation fee applies 7 days before event`,
      image: selectedVenue.image
    });

    setIsBookModalOpen(false);
    showToast(`Space booked successfully! Reference: ${newId}`);
  };

  return (
    <div className="browse-spaces-page">
      <div className="page-header">
        <h1 className="page-title">Browse Spaces</h1>
        <p className="page-subtitle">Discover and reserve premium architectural venues for your upcoming milestones.</p>
      </div>

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
                <div className="space-price">
                  {venue.price} <span>/ event</span>
                </div>
                <button 
                  className="btn-solid-primary"
                  onClick={() => openBookModal(venue)}
                >
                  Book Space
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Book Space Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title={`Reserve ${selectedVenue?.name}`}
        footer={
          <>
            <button 
              className="btn-outline-neutral" 
              onClick={() => setIsBookModalOpen(false)}
            >
              Cancel
            </button>
            <button 
              className="btn-solid-primary" 
              onClick={handleBookingSubmit}
            >
              Confirm Reservation
            </button>
          </>
        }
      >
        <form onSubmit={handleBookingSubmit}>
          <div className="form-group">
            <label>Event Name</label>
            <input 
              type="text" 
              value={eventTitle} 
              onChange={(e) => setEventTitle(e.target.value)} 
              placeholder="e.g. Annual Gala Dinner" 
              required 
            />
          </div>

          <div className="form-group">
            <label>Event Date</label>
            <input 
              type="date" 
              value={eventDate} 
              onChange={(e) => setEventDate(e.target.value)} 
              required 
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Start Time</label>
              <input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Expected Guests</label>
            <input 
              type="number" 
              value={guestCount} 
              onChange={(e) => setGuestCount(e.target.value)} 
              min={1} 
              max={500} 
              required 
            />
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 16px',
            marginTop: '12px',
            fontSize: '13px',
            color: '#475569',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Standard Space Fee:</span>
            <strong style={{ color: '#0f172a', fontSize: '15px' }}>{selectedVenue?.price}</strong>
          </div>
        </form>
      </Modal>
    </div>
  );
}
