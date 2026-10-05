import React, { useState } from 'react';
import { Building2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { money, period, categoryName, statusNames } from '../utils';

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}
export function Status({ status }) { return <span className={`status-badge status-${status}`}><span aria-hidden="true" />{statusNames[status] || status}</span>; }
export function ErrorNotice({ message, onRetry }) {
  return message ? <div className="notice notice-error" role="alert"><AlertCircle size={19} /><div>{message}</div>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div> : null;
}
export function EmptyState({ title, description, action, icon: Icon = Building2 }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={26} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function Loading({ label = 'Loading…' }) { return <div className="loading-state" role="status"><Loader2 className="spin" size={22} />{label}</div>; }
export function Pagination({ pagination }) {
  const { page, pages, total, start, end, setPage } = pagination;
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Results pages"><span role="status">Showing {start}–{end} of {total}</span><div><button className="button secondary small-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous page</button><span>Page {page} of {pages}</span><button className="button secondary small-button" disabled={page === pages} onClick={() => setPage(page + 1)}>Next page</button></div></nav>;
}
export function VenueArt({ venue, compact = false }) {
  const [failed, setFailed] = useState(false);
  return venue.imageUrl && !failed ? <img className={`venue-image ${compact ? 'compact' : ''}`} src={venue.imageUrl} alt={venue.name} onError={() => setFailed(true)} />
    : <div className={`venue-art ${compact ? 'compact' : ''}`}><Building2 size={compact ? 26 : 56} strokeWidth={1} /><span>{compact ? '' : 'Venue photo unavailable'}</span></div>;
}
export function Pricing({ quote, title = 'Price breakdown' }) {
  if (!quote) return null;
  return <section className="pricing"><div className="section-heading"><h3>{title}</h3><span className="muted small">KZT</span></div>
    {quote.legacyEstimate && <div className="notice notice-warning">Historical rental details are estimated. The original order total is preserved.</div>}
    <div className="price-line"><div><strong>{quote.rental.name}</strong><span>{Number(quote.durationHours).toLocaleString('en-KZ', { maximumFractionDigits: 4 })} hours × {money(quote.rental.unitPrice)}/hour</span></div><strong>{money(quote.rental.amount)}</strong></div>
    {quote.services.map(line => <div className="price-line" key={line.id}><div><strong>{line.name}</strong><span>{line.quantity} units × {money(line.unitPrice)} · {categoryName(line.category)}</span></div><strong>{money(line.amount)}</strong></div>)}
    {!quote.services.length && <p className="small muted">No additional services selected.</p>}
    <div className="price-total"><span>Total order value</span><strong>{money(quote.totalAmount)}</strong></div>
  </section>;
}
export function OrderDetails({ order }) {
  return <><div className="detail-head"><div><p className="eyebrow">Reservation</p><h3>{order.venue}</h3><p className="muted">{order.address}</p></div><Status status={order.status} /></div>
    <dl className="details-grid"><div><dt>Rental period</dt><dd>{period(order)}</dd></div><div><dt>Expected guests</dt><dd>{order.guests}</dd></div><div><dt>Reference</dt><dd className="reference">{order.id}</dd></div><div><dt>Manager assignment</dt><dd>{order.managerId ? 'Assigned' : 'Not yet assigned'}</dd></div></dl>
    {order.pricing && <Pricing quote={order.pricing} />}
    {order.status === 'pending' && <p className="small muted">Your order has been submitted for manager review. Submission does not confirm the booking.</p>}
  </>;
}
