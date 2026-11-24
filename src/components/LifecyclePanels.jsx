import React, { useState } from 'react';
import { Printer, Star } from 'lucide-react';
import { api } from '../services/api';
import useLiveData from '../useLiveData';
import { ErrorNotice, Loading } from './UI';
import { dateTime, money } from '../utils';
import { canReview } from '../lifecycle';

const optional = promise => promise.catch(error => { if (error.status === 404) return null; throw error; });
export function ClientSchedule({ order, token, refreshVersion }) {
  const live = useLiveData(signal => optional(api.execution.schedule(token, order.id, signal)), [token, order.id, order.revision, refreshVersion]);
  return <section className="printable-document"><ErrorNotice message={live.error} onRetry={live.refresh} />{live.busy && !live.data ? <Loading label="Loading event schedule…" />
    : live.data ? <><div className="section-heading"><h3>Final event schedule</h3><button className="button secondary small-button" onClick={() => window.print()}><Printer size={15} />Print / save PDF</button></div><p className="small muted">Finalized {dateTime(live.data.finalizedAt)} · Revision {live.data.revision}</p>
      <div className="schedule-activities">{live.data.activities.map(activity => <article className="panel" key={activity.id}><strong>{activity.activity}</strong><p>{activity.serviceName}</p><p className="small muted">{dateTime(activity.startsAt)} – {dateTime(activity.endsAt)}</p></article>)}</div></>
      : !live.error && <p className="notice notice-info">Your manager has not published a final schedule for this booking revision yet.</p>}</section>;
}

export function CancellationStatement({ order, token, staff, refreshVersion }) {
  const live = useLiveData(signal => optional(api.cancellations.get(token, order.id, signal)), [token, order.id, refreshVersion]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const statement = live.data;
  const settle = async () => {
    if (busy) return; setBusy(true); setError('');
    try { await api.cancellations.settle(token, order.id); live.refresh(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <section className="printable-document"><ErrorNotice message={live.error || error} onRetry={live.refresh} />{live.busy && !statement ? <Loading label="Loading cancellation statement…" /> : statement ? <>
    <div className="section-heading"><h3>Cancellation statement</h3><button className="button secondary small-button" onClick={() => window.print()}><Printer size={15} />Print / save PDF</button></div>
    <p className="reference">{statement.number}</p><p className="small muted">Issued {dateTime(statement.createdAt)} · Booking revision {statement.orderRevision}</p>
    <dl className="details-grid"><div><dt>Order value</dt><dd>{money(statement.orderAmount)}</dd></div><div><dt>Payment applied</dt><dd>{money(statement.paidAmount)}</dd></div><div><dt>Penalty ({statement.ratePercent}%)</dt><dd>{money(statement.penaltyAmount)}</dd></div><div><dt>Refund due</dt><dd>{money(statement.refundAmount)}</dd></div><div><dt>Additional amount due</dt><dd>{money(statement.amountDue)}</dd></div><div><dt>Settlement</dt><dd>{statement.status === 'settled' ? 'Settled' : statement.status === 'refund-pending' ? 'Refund pending' : 'Payment due'}</dd></div></dl>
    {statement.reason && <p><strong>Cancellation reason:</strong> {statement.reason}</p>}
    {statement.settledAt ? <p className="notice notice-info">{statement.isDemo ? 'Demo settlement recorded. No money was transferred.' : 'No further payment or refund is required.'} {dateTime(statement.settledAt)} {statement.settlementReference}</p>
      : <><p className="notice notice-warning">{statement.refundAmount > 0 ? 'Your manager must process the refund separately.' : 'The cancellation penalty remains due.'} Demo settlement does not move real money.</p>
        {statement.demoSettlementEnabled && (staff || statement.amountDue > 0) && <button className="button primary" disabled={busy} onClick={settle}>{busy ? 'Recording…' : statement.refundAmount > 0 ? 'Record demo refund' : 'Pay outstanding penalty · Demo'}</button>}
        {!statement.demoSettlementEnabled && <p className="small muted">Settlement is unavailable until a real payment provider is configured.</p>}</>}
  </> : !live.error && <p className="notice notice-info">No cancellation statement was recorded for this historical booking.</p>}</section>;
}

export function EventReview({ order, token, staff = false, refreshVersion }) {
  const live = useLiveData(signal => optional(api.reviews.get(token, order.id, signal)), [token, order.id, refreshVersion]);
  const [rating, setRating] = useState('5'), [comment, setComment] = useState(''), [ratings, setRatings] = useState({});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api.reviews.submit(token, order.id, { rating: Number(rating), comment: comment.trim(), services: Object.entries(ratings).filter(([, value]) => value !== '').map(([serviceId, value]) => ({ serviceId, rating: Number(value) })) }); live.refresh(); }
    catch (err) { setError(err.message); if (err.status === 409) live.refresh(); } finally { setBusy(false); }
  };
  const choices = [1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>);
  return <section><ErrorNotice message={live.error || error} onRetry={live.refresh} />{live.busy && !live.data ? <Loading label="Loading event review…" /> : live.data ? <>
    <h3><Star size={18} aria-hidden="true" /> Venue rating: {live.data.rating} / 5</h3><p>{live.data.comment || 'No written comment.'}</p><p className="small muted">Submitted {dateTime(live.data.submittedAt)}</p>
    {live.data.services.map(service => <p key={service.serviceId}>{service.serviceName}: <strong>{service.rating} / 5</strong></p>)}
  </> : !staff && canReview(order) ? <form className="review-form" onSubmit={submit}><h3>How was your event?</h3><p className="small muted">One review per completed event. Venue and service ratings are counted separately.</p><fieldset disabled={busy}>
    <label className="field">Venue rating<select required value={rating} onChange={event => setRating(event.target.value)}>{choices}</select></label>
    {(order.pricing?.services || []).map(service => <label className="field" key={service.id}>{service.name} <span className="optional">Optional</span><select value={ratings[service.id] || ''} onChange={event => setRatings(previous => ({ ...previous, [service.id]: event.target.value }))}><option value="">No service rating</option>{choices}</select></label>)}
    <label className="field">Your feedback <span className="optional">Optional</span><textarea maxLength={2000} rows={4} value={comment} onChange={event => setComment(event.target.value)} /></label><button className="button primary" type="submit">{busy ? 'Submitting…' : 'Submit review'}</button>
  </fieldset></form> : !live.error && <p className="notice notice-info">{staff ? 'The client has not submitted a review.' : 'Reviews become available after your paid event has completed.'}</p>}</section>;
}
