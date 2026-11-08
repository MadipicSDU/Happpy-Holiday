import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Edit3 } from 'lucide-react';
import { api } from '../services/api';
import { bookingPayload, dateTime, localInput, money, period } from '../utils';
import ServicePicker from './ServicePicker';
import { ErrorNotice, Loading, Pricing } from './UI';

export default function OrderChanges({ order, token, role, venues = [], services = [], onRefresh }) {
  const [history, setHistory] = useState([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(null), [preview, setPreview] = useState(null), [reviewNote, setReviewNote] = useState('');
  const client = role === 'client', pending = history.find(change => change.status === 'pending');
  const eligible = ['pending', 'awaiting-payment', 'confirmed'].includes(order.status) && new Date(order.changeDeadline) > new Date();
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    api.changes.list(token, order.id, abort.signal).then(setHistory).catch(error => { if (!abort.signal.aborted) setError(error.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [token, order.id, order.revision, order.pendingChangeId, version]);
  useEffect(() => { setEditing(false); setPreview(null); }, [order.id, order.revision]);
  const begin = () => {
    setDraft({ premiseId: order.premiseId, startsAt: localInput(new Date(order.startsAt)), endsAt: localInput(new Date(order.endsAt)), guests: order.guests,
      quantities: Object.fromEntries(order.pricing.services.map(line => [line.id, line.quantity])), reason: '' });
    setPreview(null); setError(''); setEditing(true);
  };
  const update = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setPreview(null); setError(''); };
  const act = async action => {
    if (busy) return; setBusy(true); setError('');
    try { await action(); setEditing(false); setPreview(null); setVersion(value => value + 1); onRefresh?.(); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const venue = venues.find(venue => venue.id === draft.premiseId);
      const body = { expectedRevision: order.revision, booking: bookingPayload(venue, draft.startsAt, draft.endsAt, draft.guests, draft.quantities), reason: draft.reason };
      if (!preview) setPreview(await api.changes.quote(token, order.id, body));
      else { await api.changes.create(token, order.id, { ...body, expectedTotal: preview.pricing.totalAmount }); setEditing(false); setPreview(null); setVersion(value => value + 1); onRefresh?.(); }
    } catch (error) { setError(error.message); setPreview(null); } finally { setBusy(false); }
  };
  const venue = venues.find(venue => venue.id === draft?.premiseId);
  return <section className="workflow-panel"><div className="section-heading"><div><h3>Booking changes</h3><p className="small muted">Changes must be requested and approved before {dateTime(order.changeDeadline)}.</p></div>{client && eligible && !pending && !editing && !loading && <button className="button secondary small-button" onClick={begin}><Edit3 size={15} />Request a change</button>}</div>
    <ErrorNotice message={error} />
    {loading ? <Loading label="Loading change requests…" /> : <>
      {pending && <article className="change-request-card"><div className="workflow-state">Awaiting manager review · Original booking remains reserved</div><h4>{pending.pricing.premiseName}</h4><p>{period(pending.pricing)} · {pending.guests} guests</p>{pending.reason && <p className="small">{pending.reason}</p>}<div className="change-totals"><span>Current value<strong>{money(pending.previousPricing.totalAmount)}</strong></span><ArrowRight size={18} /><span>Proposed value<strong>{money(pending.pricing.totalAmount)}</strong></span><span>Price change<strong>{pending.priceDelta > 0 ? '+' : ''}{money(pending.priceDelta)}</strong></span></div><details className="workflow-details"><summary>View proposed services and prices</summary><Pricing quote={pending.pricing} /></details>
        {client ? <button type="button" className="button secondary small-button" disabled={busy} onClick={() => act(() => api.changes.withdraw(token, order.id, pending.id))}>Withdraw request</button> : <><label className="field">Review note <span className="optional">Optional</span><textarea maxLength={1000} value={reviewNote} disabled={busy} onChange={event => setReviewNote(event.target.value)} /></label><p className="small muted">Approval reschedules the booking and withdraws previous staff briefs. Additional costs are invoiced; lower paid totals receive a demo credit.</p><div className="workflow-actions"><button className="button secondary" disabled={busy} onClick={() => act(() => api.changes.review(token, order.id, pending.id, { approve: false, note: reviewNote }))}>Reject request</button><button className="button primary" disabled={busy} onClick={() => act(() => api.changes.review(token, order.id, pending.id, { approve: true, note: reviewNote }))}>Approve change & update invoice</button></div></>}
      </article>}
      {client && !eligible && !pending && <p className="small muted">The change window is closed or this booking is no longer active. Contact your manager if you need help.</p>}
      {!pending && !editing && eligible && <p className="small muted">{client ? 'You can propose new dates, a different venue, guest numbers, or services without a change penalty.' : 'No change requests awaiting review.'}</p>}
      {editing && draft && <form className="change-request-form" onSubmit={submit}><fieldset disabled={busy || Boolean(preview)}><label className="field">Venue<select required value={draft.premiseId} onChange={event => update('premiseId', event.target.value)}>{venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name} · {venue.capacity} guests</option>)}</select></label><div className="form-row"><label className="field">New start date & time<input type="datetime-local" required value={draft.startsAt} onChange={event => update('startsAt', event.target.value)} /></label><label className="field">New end date & time<input type="datetime-local" required min={draft.startsAt} value={draft.endsAt} onChange={event => update('endsAt', event.target.value)} /></label></div><label className="field">New guest count<input type="number" required min={1} max={venue?.capacity} value={draft.guests} onChange={event => update('guests', event.target.value)} /></label><label className="field">Reason for change <span className="optional">Optional</span><textarea maxLength={1000} value={draft.reason} onChange={event => update('reason', event.target.value)} /></label></fieldset>
        <ServicePicker services={services} quantities={draft.quantities} onChange={value => { setDraft(previous => ({ ...previous, quantities: typeof value === 'function' ? value(previous.quantities) : value })); setPreview(null); }} guests={draft.guests} disabled={busy || Boolean(preview)} />
        {preview && <div className="change-preview"><Pricing quote={preview.pricing} title="Proposed package" /><div className="change-totals"><span>Price change<strong>{preview.priceDelta > 0 ? '+' : ''}{money(preview.priceDelta)}</strong></span><span>Due after approval<strong>{money(preview.amountDue)}</strong></span>{preview.demoCredit > 0 && <span>Demo credit after approval<strong>{money(preview.demoCredit)}</strong></span>}</div><p className="small muted">Your current booking stays unchanged until your manager approves this request. Availability is checked again on approval.</p></div>}
        <div className="workflow-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => { setEditing(false); setPreview(null); setError(''); }}>Keep current booking</button>{preview && <button type="button" className="button secondary" disabled={busy} onClick={() => setPreview(null)}><ArrowLeft size={15} />Edit request</button>}<button className="button primary" type="submit" disabled={busy}>{busy ? 'Checking…' : preview ? 'Send change request' : 'Review change & price'}</button></div>
      </form>}
      {history.some(change => change.status !== 'pending') && <details className="workflow-details"><summary>Change history ({history.filter(change => change.status !== 'pending').length})</summary>{history.filter(change => change.status !== 'pending').map(change => <article className="change-history-item" key={change.id}><strong>{change.status} · {change.pricing.premiseName}</strong><p className="small">{period(change.pricing)} · {money(change.pricing.totalAmount)}</p><p className="small muted">Requested {dateTime(change.requestedAt)}{change.reviewedByName && ` · Reviewed by ${change.reviewedByName}`}</p>{change.reviewNote && <p className="small">{change.reviewNote}</p>}</article>)}</details>}
    </>}
  </section>;
}
