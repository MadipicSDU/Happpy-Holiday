import React, { useState } from 'react';
import { Calendar, Users } from 'lucide-react';
import Modal from '../components/Modal';

export default function MyEvents({ events, onUpdateEvent, onCancelEvent, showToast }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModifyOpen, setIsModifyOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  // Modify form state
  const [editDate, setEditDate] = useState('');
  const [editGuests, setEditGuests] = useState(100);
  const [editNotes, setEditNotes] = useState('');

  const openModifyModal = (evt) => {
    setSelectedEvent(evt);
    setEditDate(evt.date);
    setEditGuests(evt.guests);
    setEditNotes('');
    setIsModifyOpen(true);
  };

  const openCancelModal = (evt) => {
    setSelectedEvent(evt);
    setIsCancelOpen(true);
  };

  const handleSaveModification = (e) => {
    e.preventDefault();
    if (!selectedEvent) return;

    onUpdateEvent(selectedEvent.id, {
      date: editDate,
      guests: Number(editGuests)
    });

    setIsModifyOpen(false);
    showToast(`Booking ${selectedEvent.id} updated successfully!`);
  };

  const handleConfirmCancel = () => {
    if (!selectedEvent) return;

    onCancelEvent(selectedEvent.id);
    setIsCancelOpen(false);
    showToast(`Booking ${selectedEvent.id} has been cancelled.`);
  };

  return (
    <div className="my-events-page">
      <div className="page-header">
        <h1 className="page-title">My Events</h1>
        <p className="page-subtitle">Track, modify, or cancel your current space bookings.</p>
      </div>

      <div className="events-list">
        {events.map((event) => (
          <div key={event.id} className="event-item-card">
            <div className="event-item-main">
              {/* Status & Ref */}
              <div className="event-item-header">
                <span className={`status-badge ${event.status}`}>
                  {event.statusLabel}
                </span>
                <span className="ref-code">Ref: {event.id}</span>
              </div>

              {/* Title */}
              <h2 className="event-item-title">{event.title}</h2>

              {/* Details */}
              <div className="event-meta-row">
                <div className="event-meta-item">
                  <Calendar size={15} />
                  <span>{event.date}</span>
                </div>
                <div className="event-meta-item">
                  <Users size={15} />
                  <span>{event.guests} Guests at {event.venue}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="event-item-actions">
              <div className="action-buttons-group">
                <button 
                  className="btn-outline-primary"
                  onClick={() => openModifyModal(event)}
                >
                  Modify Booking
                </button>
                <button 
                  className="btn-outline-neutral"
                  onClick={() => openCancelModal(event)}
                >
                  Cancel
                </button>
              </div>

              {event.feeNotice && (
                <div className="fee-notice">
                  {event.feeNotice}
                </div>
              )}
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            No bookings found. Head over to <b>Browse Spaces</b> to book a venue!
          </div>
        )}
      </div>

      {/* Modify Booking Modal */}
      <Modal
        isOpen={isModifyOpen}
        onClose={() => setIsModifyOpen(false)}
        title={`Modify Booking - ${selectedEvent?.title}`}
        footer={
          <>
            <button 
              className="btn-outline-neutral" 
              onClick={() => setIsModifyOpen(false)}
            >
              Close
            </button>
            <button 
              className="btn-solid-primary" 
              onClick={handleSaveModification}
            >
              Save Changes
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveModification}>
          <div className="form-group">
            <label>Venue & Reference</label>
            <input 
              type="text" 
              value={`${selectedEvent?.venue} (${selectedEvent?.id})`} 
              disabled 
              style={{ background: '#f8fafc', color: '#64748b' }} 
            />
          </div>
          <div className="form-group">
            <label>Event Date & Schedule</label>
            <input 
              type="text" 
              value={editDate} 
              onChange={(e) => setEditDate(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Expected Guests</label>
            <input 
              type="number" 
              value={editGuests} 
              onChange={(e) => setEditGuests(e.target.value)} 
              min={1} 
              max={1000} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Special Requests / Adjustments</label>
            <textarea 
              rows={3} 
              className="form-control"
              placeholder="e.g. Need podium and projector arrangement..." 
              value={editNotes} 
              onChange={(e) => setEditNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontFamily: 'inherit',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </form>
      </Modal>

      {/* Cancel Booking Modal */}
      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Cancel Booking"
        footer={
          <>
            <button 
              className="btn-outline-neutral" 
              onClick={() => setIsCancelOpen(false)}
            >
              Keep Booking
            </button>
            <button 
              className="btn-solid-primary" 
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: '#334155', marginBottom: '14px' }}>
          Are you sure you want to cancel your reservation for <b>{selectedEvent?.title}</b>?
        </p>
        {selectedEvent?.feeNotice && (
          <div style={{
            background: '#fff7ed',
            border: '1px solid #ffedd5',
            padding: '12px 16px',
            borderRadius: '8px',
            color: '#c2410c',
            fontSize: '13px',
            fontWeight: '500'
          }}>
            {selectedEvent.feeNotice}
          </div>
        )}
      </Modal>
    </div>
  );
}
