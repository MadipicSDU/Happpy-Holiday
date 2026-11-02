import React, { useId, useState } from 'react';
import { Receipt, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { bookingEstimate } from '../bookingEstimate';
import { money, dateTime, categoryName, zone } from '../utils';

const price = value => value === null || value === undefined ? '—' : money(value);

export default function BookingSummary({ venue, services, startsAt, endsAt, guests, quantities, quote }) {
  const [expanded, setExpanded] = useState(false), contentsId = useId();
  const estimate = quote ? null : bookingEstimate({ venue, services, startsAt, endsAt, guests, quantities });
  const pricing = quote || estimate.pricing;
  return <section className={`booking-summary ${expanded ? 'is-expanded' : ''}`} aria-label="Live price summary">
    <header className="booking-summary-header"><div className="booking-summary-heading"><Receipt size={20} /><h3>Your booking summary</h3></div>
      <span className={`booking-summary-status ${quote ? 'is-checked' : ''}`}>{quote ? <><Check size={13} />Server-checked quote</> : 'Live estimate'}</span>
      <button type="button" className="text-button booking-summary-toggle" aria-expanded={expanded} aria-controls={contentsId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide breakdown' : 'Show breakdown'}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    </header>
    <div id={contentsId} className="booking-summary-scroll" tabIndex={0} role="region" aria-label="Receipt details and line items">
      <div className="booking-summary-venue"><p className="eyebrow">Event space</p><h4>{pricing.premiseName}</h4><p>{pricing.address}</p></div>
      <dl className="booking-summary-dates"><div><dt>From</dt><dd>{startsAt ? dateTime(pricing.startsAt) : 'Choose a start'}</dd></div><div><dt>Until</dt><dd>{endsAt ? dateTime(pricing.endsAt) : 'Choose an end'}</dd></div><div><dt>Guests</dt><dd>{guests || '—'}</dd></div></dl><p className="small muted">Local time · {zone()}</p>
      <div className="booking-summary-line"><div><strong>Venue rental</strong><span>{pricing.durationHours === null ? 'Choose your rental period' : `${Number(pricing.durationHours).toLocaleString('en-KZ', { maximumFractionDigits: 4 })} hours × ${money(pricing.rental.unitPrice)}`}</span></div><strong>{price(pricing.rental.amount)}</strong></div>
      {pricing.promotionPercent > 0 && <div className="booking-summary-line booking-summary-discount"><div><strong>Rental promotion</strong><span>{pricing.promotionPercent}% off venue rental</span></div><strong>{pricing.rentalDiscount === null ? '—' : `−${money(pricing.rentalDiscount)}`}</strong></div>}
      <p className="booking-summary-services-label">Additional services · {pricing.services.length}</p>
      {pricing.services.map(line => <div className="booking-summary-line" key={line.id}><div><strong>{line.name}</strong><span>{line.quantity || '—'} × {price(line.unitPrice)}{line.category && ` · ${categoryName(line.category)}`}</span></div><strong>{price(line.amount)}</strong></div>)}
      {!pricing.services.length && <p className="small muted">Venue only. Add services from the catalogue to build your package.</p>}
      <p className="booking-summary-help">{quote ? 'Availability is checked again when you submit. Your booking goes to a manager for review.' : 'Based on current catalogue rates. Review price checks availability and the final amount before you submit.'}</p>
    </div>
    <footer className="booking-summary-total"><div><span>{quote ? 'Quoted total' : 'Estimated total'} <small>KZT</small></span><strong role="status" aria-live="polite" aria-atomic="true"><span className="sr-only">{quote ? 'Quoted total: ' : 'Estimated total: '}</span>{price(pricing.totalAmount)}</strong></div>
      {estimate?.issue && <p className="booking-summary-issue">{estimate.issue}</p>}
      <p className="small muted">No payment is taken on submission.</p>
    </footer>
  </section>;
}
