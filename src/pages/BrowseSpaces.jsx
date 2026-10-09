import React, { useState, useMemo } from 'react';
import { Users, Check, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';

const CATEGORY_STYLES = {
  'Catering': { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  'FoodPreparation': { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  'Decoration': { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
  'EquipmentRental': { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' },
  'Equipment & Lighting': { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' },
  'Entertainment': { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  'Photography': { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  'Logistics': { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
};

function formatCategory(cat = '') {
  if (cat === 'FoodPreparation') return 'Catering';
  if (cat === 'EquipmentRental') return 'Equipment';
  return cat || 'General';
}

export default function BrowseSpaces({ venues, availableServices = [], onBookSpace, showToast }) {
  const [selectedVenue, setSelectedVenue]     = useState(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [loading, setLoading]                 = useState(false);

  // Booking form state
  const [eventDate,  setEventDate]  = useState('');
  const [startTime,  setStartTime]  = useState('14:00');
  const [endTime,    setEndTime]    = useState('20:00');
  const [guestCount, setGuestCount] = useState(100);
  const [selectedServices, setSelectedServices] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [serviceSearch, setServiceSearch] = useState('');

  const openBookModal = (venue) => {
    setSelectedVenue(venue);
    setSelectedServices([]);
    setActiveCategory('All');
    setServiceSearch('');
    setIsBookModalOpen(true);
  };

  // Calculate duration in hours between two HH:MM strings
  const calcHours = (start, end) => {
    if (!start || !end) return 1;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(1, Math.ceil(diff / 60));
  };

  const categories = useMemo(() => {
    const list = new Set();
    availableServices.forEach(s => {
      list.add(formatCategory(s.category));
    });
    return ['All', ...Array.from(list)];
  }, [availableServices]);

  const filteredServices = useMemo(() => {
    return availableServices.filter(s => {
      const matchCat = activeCategory === 'All' || formatCategory(s.category) === activeCategory;
      const matchSearch = !serviceSearch ||
        s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(serviceSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [availableServices, activeCategory, serviceSearch]);

  const toggleService = (id) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVenue) return;

    const durationHours = calcHours(startTime, endTime);

    setLoading(true);
    try {
      await onBookSpace({
        premiseId:     selectedVenue.id,
        rawDate:       new Date(eventDate).toISOString(),
        guests:        Number(guestCount),
        durationHours,
        serviceIds:    selectedServices,
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
  const durationHours = calcHours(startTime, endTime);
  const baseRental = (selectedVenue?.rawPrice || 0) * durationHours;
  const servicesTotal = selectedServices.reduce((sum, id) => {
    const s = availableServices.find(item => item.id === id);
    return sum + (s?.price || 0);
  }, 0);
  const totalAmount = baseRental + servicesTotal;

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
                <div className="space-price">
                  {venue.rawPrice ? `${venue.rawPrice.toLocaleString()} ₸` : venue.price} <span>/ hr</span>
                </div>
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
              {loading ? 'Booking…' : `Confirm Reservation · ${totalAmount.toLocaleString()} ₸`}
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

          {/* Comfortable Services Selection */}
          <div className="form-group" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#2563eb" />
                Additional Event Services
              </label>
              {selectedServices.length > 0 && (
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '12px' }}>
                  {selectedServices.length} selected (+{servicesTotal.toLocaleString()} ₸)
                </span>
              )}
            </div>

            {/* Category Pills & Search */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {categories.map(cat => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: activeCategory === cat ? '#2563eb' : '#f1f5f9',
                    color: activeCategory === cat ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Services Cards List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '6px',
              border: '1px solid #f1f5f9',
              borderRadius: '10px',
              padding: '8px'
            }}>
              {filteredServices.map(service => {
                const isSelected = selectedServices.includes(service.id);
                const catLabel = formatCategory(service.category);
                const tagStyle = CATEGORY_STYLES[service.category] || CATEGORY_STYLES[catLabel] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

                return (
                  <div
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: `2px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                        background: isSelected ? '#2563eb' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                            {service.name}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '1px 8px',
                            borderRadius: '10px',
                            background: tagStyle.bg,
                            color: tagStyle.text,
                            border: `1px solid ${tagStyle.border}`
                          }}>
                            {catLabel}
                          </span>
                        </div>
                        {service.description && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {service.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      fontWeight: '700',
                      fontSize: '13px',
                      color: isSelected ? '#2563eb' : '#0f172a',
                      marginLeft: '12px',
                      whiteSpace: 'nowrap'
                    }}>
                      +{service.price.toLocaleString()} ₸
                    </div>
                  </div>
                );
              })}

              {filteredServices.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8', fontSize: '13px' }}>
                  No services found in this category.
                </div>
              )}
            </div>
          </div>

          {/* Transparent Price Summary */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            marginTop: '20px',
            fontSize: '13px',
            color: '#475569'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>Base Space Rental ({durationHours} hrs):</span>
              <span>{baseRental.toLocaleString()} ₸</span>
            </div>
            {selectedServices.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#2563eb' }}>
                <span>Additional Services ({selectedServices.length}):</span>
                <span>+{servicesTotal.toLocaleString()} ₸</span>
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '8px',
              borderTop: '1px solid #e2e8f0',
              marginTop: '4px'
            }}>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>Estimated Total:</span>
              <strong style={{ color: '#0f172a', fontSize: '16px' }}>
                {totalAmount.toLocaleString()} ₸
              </strong>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
