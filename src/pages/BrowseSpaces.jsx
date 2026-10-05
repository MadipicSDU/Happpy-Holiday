import usePagination from '../usePagination';
import React, { useState, useRef, useEffect } from 'react';
import { Search, Users, MapPin, ArrowRight, ArrowLeft, CalendarDays, Check, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import { PageHeading, EmptyState, VenueArt, ErrorNotice, Pricing, Pagination } from '../components/UI';
import { api } from '../services/api';
import { money, categoryName, bookingPayload, localInput, zone, period } from '../utils';

export default function BrowseSpaces({ venues, availableServices, token, onBookSpace }) {
  const [search, setSearch] = useState(''), [capacity, setCapacity] = useState('');
  const [venue, setVenue] = useState(null), [startsAt, setStartsAt] = useState(''), [endsAt, setEndsAt] = useState(''), [guests, setGuests] = useState('');
  const [quantities, setQuantities] = useState({}), [quote, setQuote] = useState(null), [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [step, setStep] = useState('details');
  const controller = useRef(null), reviewTitle = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (step === 'review') reviewTitle.current?.focus(); }, [step]);
  const filtered = venues.filter(item => `${item.name} ${item.address}`.toLowerCase().includes(search.toLowerCase()) && (!capacity || item.capacity >= Number(capacity)));
  const pagination = usePagination(filtered, `${search}|${capacity}`, 12);
  const open = item => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(14, 0, 0, 0);
    const end = new Date(tomorrow); end.setHours(18);
    setVenue(item); setStartsAt(localInput(tomorrow)); setEndsAt(localInput(end)); setGuests(Math.min(50, item.capacity));
    setQuantities({}); setError(''); setQuote(null); setPayload(null); setStep('details');
  };
  const review = async event => {
    event.preventDefault(); if (busy) return; setError('');
    try {
      const body = bookingPayload(venue, startsAt, endsAt, guests, quantities);
      setBusy(true); controller.current = new AbortController();
      const result = await api.orders.quote(token, body, controller.current.signal);
      setPayload(body); setQuote(result); setStep('review');
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (busy || !quote || !payload) return; setBusy(true); setError('');
    try { await onBookSpace(payload); setVenue(null); }
    catch (err) {
      setStep('details'); setQuote(null);
      setError(err.message + (err.status === 0 ? ' Refresh your bookings before retrying if the connection was interrupted.' : ''));
    } finally { setBusy(false); }
  };
  return <><PageHeading eyebrow="Venue catalogue" title="Find your kind of space." description="Browse locations, choose your rental period, and put together the details." />
    <div className="catalogue-toolbar"><label className="search-field"><Search size={18} /><input aria-label="Search venues by name or address" placeholder="Search by venue or location" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="capacity-filter"><Users size={17} /><span className="sr-only">Minimum capacity</span><select aria-label="Minimum guest capacity" value={capacity} onChange={event => setCapacity(event.target.value)}><option value="">Any capacity</option><option value="50">50+ guests</option><option value="100">100+ guests</option><option value="200">200+ guests</option><option value="300">300+ guests</option></select></label><span className="catalogue-count">{filtered.length} {filtered.length === 1 ? 'venue' : 'venues'}</span></div>
    <div className="venue-grid">{pagination.items.map(item => <article className="venue-card" key={item.id}><div className="venue-visual"><VenueArt venue={item} /><span className="capacity-badge"><Users size={14} />Up to {item.capacity} guests</span></div><div className="venue-card-body"><p className="eyebrow">Event space</p><h2>{item.name}</h2><p className="venue-address"><MapPin size={15} />{item.address}</p><p className="venue-description">{item.description || 'Choose your dates to check availability and build your package.'}</p><div className="venue-card-footer"><div><strong>{money(item.pricePerHour)}</strong><span>per rental hour</span></div><button className="button secondary" onClick={() => open(item)}>Plan booking<ArrowUpRightIcon /></button></div></div></article>)}</div>
    <Pagination pagination={pagination} />
    {!filtered.length && <EmptyState title={venues.length ? 'No venues match your search' : 'The catalogue is currently empty'} description={venues.length ? 'Try a different location or a smaller guest capacity.' : 'Check back when new spaces have been added.'} action={venues.length ? <button className="button secondary" onClick={() => { setSearch(''); setCapacity(''); }}>Clear filters</button> : null} />}
    <Modal isOpen={Boolean(venue)} onClose={() => setVenue(null)} title={step === 'details' ? 'Build your booking' : 'Review your order'} busy={busy} wide footer={step === 'review' ? <><button className="button secondary" disabled={busy} onClick={() => { setStep('details'); setQuote(null); setError(''); }}><ArrowLeft size={16} />Edit details</button><button className="button primary" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit for manager review'}<ArrowRight size={17} /></button></> : <><span className="small muted">No payment is taken on submission.</span><button className="button primary" type="submit" form="booking-form" disabled={busy}>{busy ? 'Checking dates and price…' : 'Review price'}<ArrowRight size={17} /></button></>}>
      <ErrorNotice message={error} />
      {venue && step === 'details' && <form id="booking-form" onSubmit={review} className="booking-layout"><div><div className="selected-venue"><VenueArt venue={venue} compact /><div><h3>{venue.name}</h3><p className="muted small">{venue.address}</p><span className="small">{money(venue.pricePerHour)} / hour · Up to {venue.capacity} guests</span></div></div>
        <fieldset disabled={busy}><div className="section-heading"><h3><span className="step-number">1</span>Your rental period</h3></div><p className="field-help">Local time · {zone()}. Overnight and multi-day rentals are supported.</p><div className="form-row"><label className="field">Start date & time<input type="datetime-local" required min={localInput(new Date())} value={startsAt} onInput={event => setStartsAt(event.target.value)} /></label><label className="field">End date & time<input type="datetime-local" required min={startsAt} value={endsAt} onInput={event => setEndsAt(event.target.value)} /></label></div><label className="field">Expected guests<input type="number" min={1} max={venue.capacity} step={1} required value={guests} onChange={event => setGuests(event.target.value)} /><span className="field-help">Maximum capacity: {venue.capacity} guests.</span></label>
        <div className="section-heading services-heading"><h3><span className="step-number">2</span>Add services</h3><span className="small muted">Optional</span></div><p className="field-help">Prices are per unit. Choose the number of servings or equipment units you need.</p>
        <div className="service-options">{availableServices.map(service => {
          const selected = Object.hasOwn(quantities, service.id);
          return <div key={service.id} className={`service-option ${selected ? 'selected' : ''}`}><label className="service-choice"><input type="checkbox" checked={selected} onChange={event => setQuantities(previous => { const next = { ...previous }; if (event.target.checked) next[service.id] = 1; else delete next[service.id]; return next; })} /><div><span className="small muted">{categoryName(service.category)}</span><strong>{service.name}</strong>{service.description && <p>{service.description}</p>}<span>{money(service.price)} / unit</span></div></label>{selected && <label className="quantity-field">Quantity<input aria-label={`Quantity for ${service.name}`} type="number" min={1} max={100000} step={1} required value={quantities[service.id]} onChange={event => setQuantities(previous => ({ ...previous, [service.id]: event.target.value }))} /></label>}</div>;
        })}{!availableServices.length && <p className="muted small">No extra services are currently listed. You can still book a venue.</p>}</div></fieldset></div>
        <aside className="booking-note"><span className="empty-icon"><CalendarDays size={25} /></span><h3>A clear plan, before you commit.</h3><p>Review price checks the requested dates and calculates your package using current catalogue rates.</p><ul><li>Reserve up to three venues at any one time.</li><li>Submit each venue as a separate order.</li><li>Your order is assigned to a manager for review.</li></ul><p className="small">Availability is checked again when you submit.</p></aside>
      </form>}
      {step === 'review' && quote && <div className="review-layout"><div><h3 ref={reviewTitle} tabIndex={-1} className="review-title">{quote.premiseName}</h3><p className="muted">{quote.address}</p><dl className="details-grid"><div><dt>Rental period</dt><dd>{period(quote)}</dd></div><div><dt>Guest count</dt><dd>{payload.guests}</dd></div></dl><p className="small muted">Times shown in {zone()}.</p><div className="notice notice-info"><Check size={19} /><span>Dates were available when this price was calculated. We will check again on submission.</span></div><p className="small muted">This is an order quote. Submission creates a pending booking for manager review.</p></div><Pricing quote={quote} title="Your package" /></div>}
    </Modal>
  </>;
}
function ArrowUpRightIcon() { return <ArrowRight size={16} />; }
