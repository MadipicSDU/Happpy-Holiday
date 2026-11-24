import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowLeft, CalendarDays, Users, Package, Building2, CheckCircle2, XCircle, Undo2, FileText } from 'lucide-react';
import { api } from '../services/api';
import { bookingPayload, localInput, money, day, time, hours, deadline, dateTime } from '../utils';
import { bookingEstimate } from '../bookingEstimate';
import ServicePicker from './ServicePicker';
import { ErrorNotice, Loading, Req } from './UI';

const SECTIONS = [['when', 'Date & time', CalendarDays, 'Move the event or make it longer'], ['guests', 'Guests', Users, 'More or fewer people'], ['services', 'Services', Package, 'Add or remove catering, music…'], ['venue', 'Venue', Building2, 'Switch to another space']];
const outcomeLabels = { rejected: 'Change request rejected', withdrawn: 'Change request withdrawn', expired: 'Change request expired', cancelled: 'Change request closed with booking' };
const servicesText = pricing => pricing?.services?.length ? pricing.services.map(line => `${line.name} ×${line.quantity}`).join(', ') : 'No services';
const timeText = pricing => pricing?.startsAt ? `${time(pricing.startsAt)}–${time(pricing.endsAt)} · ${hours(pricing)} h` : '—';

// "Was → becomes" for every part of a booking (#25): changed rows are highlighted, unchanged rows stay quiet.
export function ChangeDiff({ before, after, guestsBefore, guestsAfter, totalLabel = 'Total' }) {
  const rows = [
    ['Venue', before.premiseName, after.premiseName],
    ['Date', before.startsAt && day(before.startsAt), after.startsAt && day(after.startsAt)],
    ['Time', timeText(before), timeText(after)],
    ['Guests', String(guestsBefore), String(guestsAfter)],
    ['Services', servicesText(before), servicesText(after)],
  ];
  const delta = after.totalAmount == null ? null : Number(after.totalAmount) - Number(before.totalAmount);
  return <table className="change-diff"><thead><tr><th /><th>Now</th><th aria-label="becomes" /><th>Requested</th></tr></thead><tbody>
    {rows.map(([label, a, b]) => <tr key={label} className={a !== b ? 'is-changed' : ''}><th scope="row">{label}</th><td>{a}</td><td aria-hidden="true">{a !== b && <ArrowRight size={14} />}</td><td>{b}</td></tr>)}
    <tr className="change-diff-total"><th scope="row">{totalLabel}</th><td>{money(before.totalAmount)}</td><td aria-hidden="true"><ArrowRight size={14} /></td><td>{after.totalAmount == null ? '—' : money(after.totalAmount)}{delta != null && <span className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{delta > 0 ? '+' : delta < 0 ? '−' : '±'}{money(Math.abs(delta))}</span>}</td></tr>
  </tbody></table>;
}

// footerNode (optional): a DOM node in the dialog footer; when given, this panel's actions render there instead of inline.
export default function OrderChanges({ order, token, role, venues = [], services = [], onRefresh, footerNode = null, onOpenTab, refreshVersion }) {
  const [history, setHistory] = useState([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(null), [preview, setPreview] = useState(null), [reviewNote, setReviewNote] = useState(''), [step, setStep] = useState('what');
  const client = role === 'client', pending = history.find(change => change.status === 'pending');
  const dl = deadline(order.changeDeadline);
  const eligible = ['pending', 'awaiting-payment', 'confirmed'].includes(order.status) && dl.tone !== 'closed';
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    api.changes.list(token, order.id, abort.signal).then(setHistory).catch(error => { if (!abort.signal.aborted) setError(error.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [token, order.id, order.revision, order.pendingChangeId, version, refreshVersion]);
  useEffect(() => { setEditing(false); setPreview(null); }, [order.id, order.revision]);
  const begin = section => {
    setDraft({ premiseId: order.premiseId, startsAt: localInput(new Date(order.startsAt)), endsAt: localInput(new Date(order.endsAt)), guests: order.guests,
      quantities: Object.fromEntries(order.pricing.services.map(line => [line.id, line.quantity])), reason: '', sections: [section || 'when'] });
    setPreview(null); setError(''); setEditing(true); setStep(section ? 'details' : 'what');
  };
  const update = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setPreview(null); setError(''); };
  const toggleSection = key => setDraft(previous => ({ ...previous, sections: previous.sections.includes(key) ? previous.sections.filter(item => item !== key) : [...previous.sections, key] }));
  const act = async action => {
    if (busy) return; setBusy(true); setError('');
    try { await action(); setEditing(false); setPreview(null); setReviewNote(''); setVersion(value => value + 1); onRefresh?.(); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  const venue = venues.find(venue => venue.id === draft?.premiseId);
  // live estimate while the client edits (#26): the price moves next to the fields that change it
  const estimate = useMemo(() => draft && venue ? bookingEstimate({ venue, services, startsAt: draft.startsAt, endsAt: draft.endsAt, guests: draft.guests, quantities: draft.quantities }) : null, [draft, venue, services]);
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const body = { expectedRevision: order.revision, booking: bookingPayload(venue, draft.startsAt, draft.endsAt, draft.guests, draft.quantities), reason: draft.reason };
      if (!preview) { setPreview(await api.changes.quote(token, order.id, body)); setStep('review'); }
      else { await api.changes.create(token, order.id, { ...body, expectedTotal: preview.pricing.totalAmount }); setEditing(false); setPreview(null); setVersion(value => value + 1); onRefresh?.(); }
    } catch (error) { setError(error.message); setPreview(null); } finally { setBusy(false); }
  };
  const actions = content => footerNode ? createPortal(content, footerNode) : <div className="workflow-actions">{content}</div>;
  const reviewed = history.filter(change => change.status !== 'pending');
  const latest = !pending && reviewed[0];
  const after = preview?.pricing || (estimate && { ...estimate.pricing, totalAmount: estimate.pricing.totalAmount });
  return <section className="workflow-panel changes-panel">
    {/* The countdown lives only in the order summary on the left; here we state the exact deadline once. */}
    <div className="section-heading"><div><h3>Booking changes</h3><p className="small muted">{eligible ? `Changes are free until ${day(order.changeDeadline)}, ${time(order.changeDeadline)}.` : 'The change window is closed for this booking.'}</p></div></div>
    <ErrorNotice message={error} />
    {loading ? <Loading label="Loading change requests…" /> : <>
      {latest && !editing && <div className={`change-outcome is-${latest.status}`}>{latest.status === 'approved' ? <CheckCircle2 size={22} /> : latest.status === 'rejected' ? <XCircle size={22} /> : <Undo2 size={22} />}
        <div><strong>{latest.status === 'approved' ? `Change approved · booking is now revision ${order.revision}` : outcomeLabels[latest.status] || 'Change request closed'}</strong>
          <p>{latest.status === 'approved' ? (latest.priceDelta > 0 ? `${client ? 'An invoice' : 'The client was invoiced'} for the difference of ${money(latest.priceDelta)}.` : latest.priceDelta < 0 ? `${money(-latest.priceDelta)} returned as demo credit.` : 'The price did not change.') : latest.status === 'rejected' ? `${latest.reviewedByName ? `By ${latest.reviewedByName}. ` : ''}${latest.reviewNote || 'The original booking stays as it was.'}` : 'The original booking stays as it was.'}
            {latest.reviewedAt && <span className="muted"> · {dateTime(latest.reviewedAt)}</span>}</p></div>
        {latest.status === 'approved' && latest.priceDelta !== 0 && onOpenTab && <button type="button" className="button secondary small-button" onClick={() => onOpenTab('invoice')}><FileText size={15} />Open invoice</button>}</div>}

      {pending && <article className="change-request-card">
        <div className="change-card-head"><span className="workflow-state">{client ? 'Pending review · waiting for your manager' : 'Pending review · waiting for your decision'}</span><span className="small muted">Requested {dateTime(pending.requestedAt)} · the current booking stays reserved meanwhile</span></div>
        {pending.reason && <p className="change-reason">“{pending.reason}”</p>}
        <ChangeDiff before={pending.previousPricing} after={pending.pricing} guestsBefore={order.guests} guestsAfter={pending.guests} />
        {client ? actions(<button type="button" className="button secondary" disabled={busy} onClick={() => act(() => api.changes.withdraw(token, order.id, pending.id))}>Withdraw request</button>)
          : <><label className="field">Note for the client <span className="optional">Optional</span><textarea rows={2} maxLength={1000} value={reviewNote} disabled={busy} onChange={event => setReviewNote(event.target.value)} /></label>
            <p className="small muted">Approving reschedules the booking, sends {pending.priceDelta > 0 ? `an invoice for ${money(pending.priceDelta)}` : pending.priceDelta < 0 ? `a demo credit of ${money(-pending.priceDelta)}` : 'no new invoice'} and withdraws earlier staff briefs.</p>
            {actions(<><button className="button secondary" disabled={busy} onClick={() => act(() => api.changes.review(token, order.id, pending.id, { approve: false, note: reviewNote }))}>Reject</button><button className="button primary" disabled={busy} onClick={() => act(() => api.changes.review(token, order.id, pending.id, { approve: true, note: reviewNote }))}><CheckCircle2 size={16} />Approve change</button></>)}</>}
      </article>}

      {!editing && <div className="change-rules"><strong>Change rules</strong><ul>
        <li>Requests are accepted until {day(order.changeDeadline)}, {time(order.changeDeadline)} — {Math.round((new Date(order.startsAt) - new Date(order.changeDeadline)) / 86400000)} days before the event. After that, changes are closed.</li>
        <li>Only one request can be pending. The manager must approve it before the deadline. Moving the event earlier can bring the deadline forward.</li>
        <li>The current booking stays reserved until a change is approved.</li>
        <li>If the new total is higher, the difference is invoiced and the booking is <em>Confirmed</em> again once it is paid; a lower total is returned as credit.</li>
        <li>An approved change withdraws the staff schedule, so the manager plans and sends it again.</li>
      </ul></div>}
      {client && eligible && !pending && !editing && <div className="change-start"><p className="change-start-title">What would you like to change?</p><div className="change-start-grid">{SECTIONS.map(([key, label, Icon, hint]) => <button type="button" key={key} className="change-start-card" onClick={() => begin(key)}><Icon size={20} /><strong>{label}</strong><span>{hint}</span></button>)}</div><p className="small muted">Your manager approves every change. Until then your current booking stays exactly as it is.</p></div>}
      {!client && !pending && !latest && <p className="empty-line">No change requests for this booking.</p>}
      {client && !eligible && !pending && <p className="empty-line">The change window has closed. Contact your manager if something important changed.</p>}

      {/* Variant B: a three-step wizard — what, new details, review & send (#21, #22, #25, #26) */}
      {editing && draft && <div className="change-wizard">
        <ol className="wizard-steps">{[['what', 'What to change'], ['details', 'New details'], ['review', 'Review & send']].map(([key, label], index) => <li key={key} className={key === step ? 'current' : ['what', 'details', 'review'].indexOf(step) > index ? 'done' : ''}><span>{['what', 'details', 'review'].indexOf(step) > index ? '✓' : index + 1}</span>{label}</li>)}</ol>
        <form id={`change-form-${order.id}`} className="change-request-form" onSubmit={submit}>
          {step === 'what' && <div className="change-start-grid">{SECTIONS.map(([key, label, Icon, hint]) => <button type="button" key={key} aria-pressed={draft.sections.includes(key)} className={`change-start-card ${draft.sections.includes(key) ? 'selected' : ''}`} onClick={() => toggleSection(key)}><Icon size={20} /><strong>{label}</strong><span>{hint}</span></button>)}</div>}
          {step === 'details' && <><fieldset disabled={busy}>
            {draft.sections.includes('venue') && <label className="field"><span className="field-label">Venue<Req /></span><select required value={draft.premiseId} onChange={event => update('premiseId', event.target.value)}>{venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name} · up to {venue.capacity} guests</option>)}</select></label>}
            {draft.sections.includes('when') && <div className="form-row"><label className="field"><span className="field-label">Starts<Req /></span><input type="datetime-local" step={900} required value={draft.startsAt} onChange={event => update('startsAt', event.target.value)} /></label><label className="field"><span className="field-label">Ends<Req /></span><input type="datetime-local" step={900} required min={draft.startsAt} value={draft.endsAt} onChange={event => update('endsAt', event.target.value)} /></label></div>}
            {draft.sections.includes('guests') && <label className="field"><span className="field-label">Guests<Req /></span><input type="number" required min={1} max={venue?.capacity} value={draft.guests} onChange={event => update('guests', event.target.value)} /><span className="field-help">Up to {venue?.capacity} guests in {venue?.name}.</span></label>}
            <label className="field">Why are you changing it? <span className="optional">Optional</span><textarea rows={2} maxLength={1000} value={draft.reason} onChange={event => update('reason', event.target.value)} /></label>
          </fieldset>
          {draft.sections.includes('services') && <ServicePicker services={services} quantities={draft.quantities} onChange={value => { setDraft(previous => ({ ...previous, quantities: typeof value === 'function' ? value(previous.quantities) : value })); setPreview(null); }} guests={draft.guests} disabled={busy} />}
          {estimate?.pricing?.totalAmount != null && <p className="wizard-estimate">Estimated new total <strong>{money(estimate.pricing.totalAmount)}</strong> · now {money(order.pricing.totalAmount)}</p>}</>}
          {step === 'review' && preview && <div className="change-compare"><p className="change-compare-title">Checked price</p><ChangeDiff before={order.pricing} after={preview.pricing} guestsBefore={order.guests} guestsAfter={Number(draft.guests)} />
            <p className="small">{preview.amountDue > 0 ? <>Due after approval: <strong>{money(preview.amountDue)}</strong></> : preview.demoCredit > 0 ? <>Demo credit after approval: <strong>{money(preview.demoCredit)}</strong></> : 'Nothing to pay after approval.'}</p>
            {draft.reason && <p className="change-reason">“{draft.reason}”</p>}<p className="small muted">Your manager approves the change. Until then your current booking stays exactly as it is.</p></div>}
        </form></div>}
      {editing && draft && actions(step === 'what' ? <><button type="button" className="button secondary" onClick={() => { setEditing(false); setError(''); }}>Keep current booking</button><button key="next" type="button" className="button primary" disabled={!draft.sections.length} onClick={() => setStep('details')}>Next: new details<ArrowRight size={16} /></button></>
        : step === 'details' ? <><button type="button" className="button secondary" disabled={busy} onClick={() => setStep('what')}><ArrowLeft size={15} />Back</button><button key="check" className="button primary" type="submit" form={`change-form-${order.id}`} disabled={busy}>{busy ? 'Checking…' : 'Check price'}<ArrowRight size={16} /></button></>
        : <><button type="button" className="button secondary" disabled={busy} onClick={() => { setPreview(null); setStep('details'); }}><ArrowLeft size={15} />Back</button><button key="send" className="button primary" type="submit" form={`change-form-${order.id}`} disabled={busy}>{busy ? 'Sending…' : 'Send change request'}</button></>)}

      {reviewed.length > (latest ? 1 : 0) && <div className="change-history"><h4>Earlier requests</h4>{reviewed.slice(latest ? 1 : 0).map(change => <div className="change-history-row" key={change.id}><span className={`history-dot is-${change.status}`} /><span><strong>{change.status[0].toUpperCase() + change.status.slice(1)}</strong> · {day(change.pricing.startsAt)}, {timeText(change.pricing)} · {money(change.pricing.totalAmount)}</span><span className="small muted">{dateTime(change.requestedAt)}</span></div>)}</div>}
    </>}
  </section>;
}
