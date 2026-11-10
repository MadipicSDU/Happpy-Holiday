import ServicePicker from '../components/ServicePicker';
import AlternativeVenues from '../components/AlternativeVenues';
import BookingSummary from '../components/BookingSummary';
import usePagination from '../usePagination';
import React, { useState, useRef, useEffect } from 'react';
import { Search, Users, MapPin, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import Modal from '../components/Modal';
import { PageHeading, EmptyState, VenueArt, ErrorNotice, Pagination } from '../components/UI';
import { api } from '../services/api';
import { money, bookingPayload, localInput, zone, period } from '../utils';

export default function BrowseSpaces({ venues, availableServices, token, onBookSpace }) {
  const [search, setSearch] = useState(''), [capacity, setCapacity] = useState('');
  const [venue, setVenue] = useState(null), [startsAt, setStartsAt] = useState(''), [endsAt, setEndsAt] = useState(''), [guests, setGuests] = useState('');
  const [quantities, setQuantities] = useState({}), [quote, setQuote] = useState(null), [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [step, setStep] = useState('period');
  const [alternativeRequest, setAlternativeRequest] = useState(null);
  const controller = useRef(null), reviewTitle = useRef(null), bookingForm = useRef(null), alternatives = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (step === 'review') reviewTitle.current?.focus(); }, [step]);
  useEffect(() => { setAlternativeRequest(null); setError(''); }, [venue?.id, startsAt, endsAt, guests]);
  const filtered = venues.filter(item => `${item.name} ${item.address}`.toLowerCase().includes(search.toLowerCase()) && (!capacity || item.capacity >= Number(capacity)));
  const pagination = usePagination(filtered, `${search}|${capacity}`, 12);
  const open = item => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(14, 0, 0, 0);
    const end = new Date(tomorrow); end.setHours(18);
    setVenue(item); setStartsAt(localInput(tomorrow)); setEndsAt(localInput(end)); setGuests(Math.min(50, item.capacity));
    setQuantities({}); setError(''); setQuote(null); setPayload(null); setStep('period');
    setAlternativeRequest(null);
  };
  const next = event => {
    event.preventDefault(); if (busy) return;
    try { bookingPayload(venue, startsAt, endsAt, guests, quantities); setError(''); setStep('services'); }
    catch (err) { setError(err.message); }
  };
  const review = async event => {
    event.preventDefault(); if (busy) return;
    const submitter = event.nativeEvent.submitter;
    let body, failed = false;
    try {
      body = bookingPayload(venue, startsAt, endsAt, guests, quantities);
      setBusy(true); controller.current = new AbortController();
      const result = await api.orders.quote(token, body, controller.current.signal);
      setPayload(body); setQuote(result); setError(''); setAlternativeRequest(null); setStep('review');
    } catch (err) {
      if (err.name !== 'AbortError') { failed = true; setError(err.message); }
      setAlternativeRequest(err.status === 409 && body ? body : null);
      if (err.status === 409 || err.status === 400) setStep('period');
    } finally {
      setBusy(false);
      if (failed) requestAnimationFrame(() => { if (submitter?.isConnected) submitter.focus({ preventScroll: true }); });
    }
  };
  const showAlternatives = () => {
    const target = alternatives.current, body = target?.closest('.modal-body');
    if (!body) return;
    body.scrollTo({ top: body.scrollTop + target.getBoundingClientRect().top - body.getBoundingClientRect().top - 20,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  };
  const chooseAlternative = item => {
    setVenue(item); setQuote(null); setPayload(null); setAlternativeRequest(null); setError('');
    requestAnimationFrame(() => {
      bookingForm.current?.closest('.modal-body')?.scrollTo({ top: 0 });
      bookingForm.current?.querySelector('input')?.focus({ preventScroll: true });
    });
  };
  const submit = async () => {
    if (busy || !quote || !payload) return; setBusy(true); setError('');
    try { await onBookSpace(payload); setVenue(null); }
    catch (err) {
      setStep('period'); setQuote(null);
      setError(err.message + (err.status === 0 ? ' Refresh your bookings before retrying if the connection was interrupted.' : ''));
      if (err.status === 409 && payload) setAlternativeRequest(payload);
    } finally { setBusy(false); }
  };
  return <><PageHeading eyebrow="Venue catalogue" title="Find your kind of space." description="Browse locations, choose your rental period, and put together the details." />
    <div className="catalogue-toolbar"><label className="search-field"><Search size={18} /><input aria-label="Search venues by name or address" placeholder="Search by venue or location" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="capacity-filter"><Users size={17} /><span className="sr-only">Minimum capacity</span><select aria-label="Minimum guest capacity" value={capacity} onChange={event => setCapacity(event.target.value)}><option value="">Any capacity</option><option value="50">50+ guests</option><option value="100">100+ guests</option><option value="200">200+ guests</option><option value="300">300+ guests</option></select></label><span className="catalogue-count">{filtered.length} {filtered.length === 1 ? 'venue' : 'venues'}</span></div>
    <div className="venue-grid">{pagination.items.map(item => <article className="venue-card" key={item.id}><div className="venue-visual"><VenueArt venue={item} /><span className="capacity-badge"><Users size={14} />Up to {item.capacity} guests</span></div><div className="venue-card-body"><p className="eyebrow">Event space</p><h2>{item.name}</h2><p className="venue-address"><MapPin size={15} />{item.address}</p><p className="venue-description">{item.description || 'Choose your dates to check availability and build your package.'}</p><div className="venue-card-footer"><div><strong>{money(item.pricePerHour)}</strong><span>per rental hour</span>{item.promotionPercent > 0 && <span className="promotion-label">{item.promotionPercent}% off venue rental</span>}</div><button className="button secondary" onClick={() => open(item)}>Plan booking<ArrowUpRightIcon /></button></div></div></article>)}</div>
    <Pagination pagination={pagination} />
    {!filtered.length && <EmptyState title={venues.length ? 'No venues match your search' : 'The catalogue is currently empty'} description={venues.length ? 'Try a different location or a smaller guest capacity.' : 'Check back when new spaces have been added.'} action={venues.length ? <button className="button secondary" onClick={() => { setSearch(''); setCapacity(''); }}>Clear filters</button> : null} />}
    <Modal isOpen={Boolean(venue)} onClose={() => setVenue(null)} title="Book a venue" busy={busy} wide steps
      tabs={[{ id: 'period', label: 'Date & guests' }, { id: 'services', label: 'Services' }, { id: 'review', label: 'Review & submit', disabled: !quote }]}
      activeTab={step} onTabChange={id => { if (id === 'review' && !quote) return; setError(''); if (id !== 'review') setQuote(null); setStep(id); }}
      sidePanel={venue && <BookingSummary key={venue.id} venue={venue} services={availableServices} startsAt={startsAt} endsAt={endsAt} guests={guests} quantities={quantities} quote={step === 'review' ? quote : null} />}
      footer={step === 'period' ? <><button type="button" className="button secondary" disabled={busy} onClick={() => setVenue(null)}>Cancel</button><button className="button primary" type="submit" form="booking-form" disabled={busy}>Next: services<ArrowRight size={17} /></button></>
        : step === 'services' ? <><button type="button" className="button secondary" disabled={busy} onClick={() => { setError(''); setStep('period'); }}><ArrowLeft size={16} />Back</button><button className="button primary" type="submit" form="booking-form" disabled={busy}>{busy ? 'Checking dates and price…' : 'Review price'}<ArrowRight size={17} /></button></>
        : <><button type="button" className="button secondary" disabled={busy} onClick={() => { setStep('services'); setQuote(null); setError(''); }}><ArrowLeft size={16} />Back</button><button type="button" className="button primary" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit for manager review'}<ArrowRight size={17} /></button></>}>
      {venue && <div className="booking-feedback" aria-busy={busy}><ErrorNotice message={error} />{alternativeRequest && step === 'period' && <button type="button" className="text-button" disabled={busy} onClick={showAlternatives}>View alternative venues<ArrowRight size={16} /></button>}</div>}
      {venue && step === 'period' && <form ref={bookingForm} id="booking-form" onSubmit={next} className="booking-layout" noValidate><div><div className="selected-venue"><VenueArt venue={venue} compact /><div><h3>{venue.name}</h3><p className="muted small">{venue.address}</p><span className="small">{money(venue.pricePerHour)} / hour · Up to {venue.capacity} guests</span></div></div>
        <fieldset disabled={busy}><div className="section-heading"><h3>Rental period</h3></div><p className="field-help">Local time · {zone()}. Overnight and multi-day rentals are supported.</p><div className="form-row"><label className="field">Start date & time<input type="datetime-local" required min={localInput(new Date())} value={startsAt} onInput={event => setStartsAt(event.target.value)} /></label><label className="field">End date & time<input type="datetime-local" required min={startsAt} value={endsAt} onInput={event => setEndsAt(event.target.value)} /></label></div><label className="field">Expected guests<input type="number" min={1} max={venue.capacity} step={1} required value={guests} onChange={event => setGuests(event.target.value)} /><span className="field-help">Maximum capacity: {venue.capacity} guests.</span></label>
        </fieldset><p className="small muted">Submit each venue as a separate order. You can reserve up to three venues at any one time.</p></div>
      </form>}
      {venue && step === 'services' && <form ref={bookingForm} id="booking-form" onSubmit={review} className="booking-layout"><ServicePicker services={availableServices} quantities={quantities} onChange={setQuantities} guests={guests} disabled={busy} /></form>}
      {venue && step === 'period' && alternativeRequest && <div ref={alternatives} tabIndex={-1} role="region" aria-label="Alternative venues"><AlternativeVenues token={token} request={alternativeRequest} onChoose={chooseAlternative} /></div>}
      {step === 'review' && quote && <div className="review-layout"><div><h3 ref={reviewTitle} tabIndex={-1} className="review-title">{quote.premiseName}</h3><p className="muted">{quote.address}</p><dl className="details-grid"><div><dt>Rental period</dt><dd>{period(quote)}</dd></div><div><dt>Guest count</dt><dd>{payload.guests}</dd></div></dl><p className="small muted">Times shown in {zone()}.</p><div className="notice notice-info"><Check size={19} /><span>Dates were available when this price was calculated. We will check again on submission.</span></div><p className="small muted">Check your package in the receipt on the right. Submission creates a pending booking for manager review. No payment is taken now.</p></div></div>}
    </Modal>
  </>;
}
function ArrowUpRightIcon() { return <ArrowRight size={16} />; }
