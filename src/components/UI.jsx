import React, { useState, useEffect } from 'react';
import demoPhotos from '../../docs/venue-photo-sources.json';
import { Building2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { money, period, dateTime, categoryName, statusNames } from '../utils';

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
export function Pagination({ pagination, disabled = false }) {
  const { page, pages, total, start, end, setPage } = pagination;
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Results pages"><span role="status">Showing {start}–{end} of {total}</span><div><button type="button" className="button secondary small-button" disabled={disabled || page === 1} onClick={() => setPage(page - 1)}>Previous page</button><span>Page {page} of {pages}</span><button type="button" className="button secondary small-button" disabled={disabled || page === pages} onClick={() => setPage(page + 1)}>Next page</button></div></nav>;
}
export function VenueArt({ venue, compact = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [venue.imageUrl]);
  const demoPhoto = demoPhotos.find(photo => photo.imageUrl === venue.imageUrl);
  return venue.imageUrl && !failed ? <div className={`venue-photo ${compact ? 'compact' : ''}`}><img className="venue-image" src={venue.imageUrl} alt={demoPhoto ? `Illustrative event space photo for ${venue.name}` : venue.name} loading="lazy" onError={() => setFailed(true)} />{demoPhoto && !compact && <a className="venue-photo-credit" href={demoPhoto.source} target="_blank" rel="noopener noreferrer" title="Illustrative stock photo, not a photograph of this demo venue">Illustrative photo · Unsplash</a>}</div>
    : <div className={`venue-art ${compact ? 'compact' : ''}`}><Building2 size={compact ? 26 : 56} strokeWidth={1} /><span>{compact ? '' : 'Venue photo unavailable'}</span></div>;
}
export function Pricing({ quote, title = 'Price breakdown' }) {
  if (!quote) return null;
  return <section className="pricing"><div className="section-heading"><h3>{title}</h3><span className="muted small">KZT</span></div>
    {quote.legacyEstimate && <div className="notice notice-warning">Historical rental details are estimated. The original order total is preserved.</div>}
    <div className="price-line"><div><strong>{quote.rental.name}</strong><span>{Number(quote.durationHours).toLocaleString('en-KZ', { maximumFractionDigits: 4 })} hours × {money(quote.rental.unitPrice)}/hour</span></div><strong>{money(quote.rental.amount)}</strong></div>
    {quote.services.map(line => <div className="price-line" key={line.id}><div><strong>{line.name}</strong><span>{line.quantity} units × {money(line.unitPrice)} · {categoryName(line.category)}</span></div><strong>{money(line.amount)}</strong></div>)}
    {!quote.services.length && <p className="small muted">No additional services selected.</p>}
    {quote.rentalDiscount > 0 && <div className="price-line"><div><strong>Rental promotion ({quote.promotionPercent}%)</strong><span>Applies to venue rental only.</span></div><strong>−{money(quote.rentalDiscount)}</strong></div>}
    <div className="price-total"><span>Total order value</span><strong>{money(quote.totalAmount)}</strong></div>
  </section>;
}
export function CancellationDetails({ order, compact = false }) {
  if (order.status !== 'cancelled') return null;
  const cancellation = order.cancellation;
  const role = { client: 'Client', manager: 'Manager', admin: 'Administrator' }[cancellation?.role];
  return <div className={compact ? 'cancellation-summary' : 'cancellation-details'}>
    {cancellation ? <><p><strong>Cancelled by {cancellation.name}</strong>{role && <span> · {role}</span>}</p><p className="small muted">{dateTime(cancellation.at)}</p></>
      : <p className="small muted">Cancellation attribution was not recorded for this booking.</p>}
  </div>;
}
export function OrderDetails({ order }) {
  return <><div className="detail-head"><div><p className="eyebrow">Reservation</p><h3>{order.venue}</h3><p className="muted">{order.address}</p></div><Status status={order.status} /></div>
    <dl className="details-grid"><div><dt>Rental period</dt><dd>{period(order)}</dd></div><div><dt>Expected guests</dt><dd>{order.guests}</dd></div><div><dt>Reference</dt><dd className="reference">{order.id}</dd></div><div><dt>Manager assignment</dt><dd>{order.managerId ? 'Assigned' : 'Not yet assigned'}</dd></div></dl>
    <CancellationDetails order={order} />
    {order.revision && <div className="booking-revision"><span>Revision {order.revision}</span><span>Change deadline: {dateTime(order.changeDeadline)}</span><span>Recorded payment applied: {money(order.paidAmount)}</span>{order.pendingChangeId && <strong>Change request awaiting review</strong>}</div>}
    {order.pricing && <Pricing quote={order.pricing} />}
    {order.status === 'pending' && <p className="small muted">Your order has been submitted for manager review. Submission does not confirm the booking.</p>}
  </>;
}
