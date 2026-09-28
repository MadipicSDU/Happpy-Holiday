import React, { useState } from 'react';
import { initialTimelineSlots } from '../data/mockData';
import { Send, CheckCircle2 } from 'lucide-react';

export default function VenueSchedule({ showToast }) {
  const [timelineData, setTimelineData] = useState(initialTimelineSlots);

  // Invoice generator state matching Figma values exactly
  const [clientName, setClientName] = useState('Sarah Jenkins');
  const [bookingRef, setBookingRef] = useState('HH-492318');
  const [amount, setAmount] = useState('$1,800.00');
  const [dueDate, setDueDate] = useState('Oct 24, 2025');

  // Invoice preview state
  const [previewInvoice, setPreviewInvoice] = useState({
    invNumber: '#INV-2025-082',
    venueTitle: 'The Crystal Greenhouse Booking',
    rentalSubtitle: '12 hours space rental · Sarah Jenkins',
    totalDue: '$1,800.00'
  });

  const handleGenerateInvoice = (e) => {
    e.preventDefault();
    const invCode = `#INV-2025-${Math.floor(100 + Math.random() * 900)}`;
    setPreviewInvoice({
      invNumber: invCode,
      venueTitle: bookingRef === 'HH-492318' ? 'Grand Ballroom Atrium Booking' : 'The Crystal Greenhouse Booking',
      rentalSubtitle: `12 hours space rental · ${clientName}`,
      totalDue: amount.startsWith('$') ? amount : `$${amount}`
    });
    showToast(`Invoice ${invCode} generated for ${clientName}!`);
  };

  const handleSendInvoice = () => {
    showToast(`Invoice ${previewInvoice.invNumber} sent to ${clientName}!`);
  };

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <div className="venue-schedule-page">
      <div className="page-header">
        <h1 className="page-title">Venue Schedule</h1>
        <p className="page-subtitle">Coordinate weekly hall occupancy and issue verified client invoices.</p>
      </div>

      <div className="schedule-invoice-layout">
        {/* Left: Venue Timeline */}
        <div className="timeline-card">
          <div className="timeline-top-bar">
            <span className="timeline-title">Weekly Timeline (Oct 12 - Oct 18)</span>
            <div className="timeline-legend">
              <div className="legend-item">
                <span className="legend-square corporate"></span>
                <span>Corporate</span>
              </div>
              <div className="legend-item">
                <span className="legend-square social"></span>
                <span>Social</span>
              </div>
            </div>
          </div>

          <div className="timeline-grid">
            {/* Header row */}
            <div></div>
            {days.map((day) => (
              <div key={day} className="timeline-header-cell">{day}</div>
            ))}

            {/* Venue rows */}
            {timelineData.map((row) => (
              <React.Fragment key={row.venue}>
                <div className="venue-row-name">{row.venue}</div>
                <div className="timeline-row-tracks">
                  {/* Slot guide grid lines */}
                  {days.map((d, idx) => (
                    <div 
                      key={idx} 
                      className="timeline-slot-divider"
                      style={{ borderRight: idx === 4 ? 'none' : '1px dashed #e2e8f0' }}
                    />
                  ))}

                  {/* Render events spanning tracks */}
                  {row.events.map((evt) => {
                    const colWidthPercent = 20; // 5 columns = 20% each
                    const leftPercent = (evt.startCol - 1) * colWidthPercent;
                    const widthPercent = evt.spanCols * colWidthPercent - 1;

                    return (
                      <div
                        key={evt.id}
                        className={`timeline-event-bar ${evt.type}`}
                        style={{
                          left: `calc(${leftPercent}% + 4px)`,
                          width: `calc(${widthPercent}% - 8px)`
                        }}
                        title={`${evt.title} (${row.venue})`}
                      >
                        {evt.title}
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right: Invoice Generator + Invoice Preview */}
        <div className="invoice-column">
          {/* Invoice Generator Card */}
          <div className="invoice-gen-card">
            <h2 className="invoice-card-title">Invoice Generator</h2>
            <form onSubmit={handleGenerateInvoice}>
              <div className="form-group">
                <label>Client Name</label>
                <input 
                  type="text" 
                  value={clientName} 
                  onChange={(e) => setClientName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Booking Reference</label>
                <input 
                  type="text" 
                  value={bookingRef} 
                  onChange={(e) => setBookingRef(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Amount (USD)</label>
                  <input 
                    type="text" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input 
                    type="text" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <button type="submit" className="btn-full-primary">
                Generate Invoice
              </button>
            </form>
          </div>

          {/* Invoice Preview Card */}
          <div className="invoice-preview-card">
            <div className="preview-top-row">
              <span className="preview-badge">INVOICE PREVIEW</span>
              <span className="preview-inv-number">{previewInvoice.invNumber}</span>
            </div>

            <h3 className="preview-heading">{previewInvoice.venueTitle}</h3>
            <p className="preview-subtext">{previewInvoice.rentalSubtitle}</p>

            <div className="preview-total-row">
              <span className="preview-total-label">Total Due:</span>
              <span className="preview-total-val">{previewInvoice.totalDue}</span>
            </div>

            <button 
              className="btn-full-primary" 
              onClick={handleSendInvoice}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Send size={15} />
              <span>Send to Client</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
