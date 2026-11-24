import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { ErrorNotice, Loading } from './UI';
import { period, money, dateTime } from '../utils';
import { api } from '../services/api';
import { cancellationConfirmation } from '../lifecycle';
export default function CancelBookingDialog({ order, token, onClose, onCancel, onCancelled }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [quote, setQuote] = useState(null), [loading, setLoading] = useState(false), [version, setVersion] = useState(0), [reason, setReason] = useState('');
  useEffect(() => {
    if (!order) return;
    const abort = new AbortController(); setError(''); setQuote(null); setLoading(true); setReason('');
    api.cancellations.quote(token, order.id, abort.signal).then(value => { if (!abort.signal.aborted) setQuote(value); })
      .catch(err => { if (!abort.signal.aborted) setError(err.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [order?.id, token, version]);
  const cancel = async () => {
    if (busy || !quote) return; setBusy(true); setError('');
    try { const updated = await onCancel(order.id, cancellationConfirmation(quote, reason)); onClose(); onCancelled?.(updated); }
    catch (err) { setError(err.message); if (err.status === 409) setQuote(null); } finally { setBusy(false); }
  };
  const unpaid = quote?.paidAmount === 0;
  const timingMessage = quote?.isLate ? 'The change deadline has passed.' : 'This cancellation is before the change deadline.';
  return <Modal isOpen={Boolean(order)} title="Review cancellation" onClose={onClose} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={onClose}>Keep booking</button><button className="button danger" disabled={busy || loading || !quote} onClick={cancel}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></>}>
    <ErrorNotice message={error} onRetry={() => setVersion(value => value + 1)} /><h3>{order?.venue}</h3><p className="muted">{order && period(order)}</p>
    {loading ? <Loading label="Calculating cancellation amounts…" /> : quote && <><p className={`notice ${unpaid ? 'notice-info' : 'notice-warning'}`}>{unpaid ? 'This booking is unpaid. You can cancel it free of charge.' : timingMessage}</p>
      <dl className="details-grid"><div><dt>Change deadline</dt><dd>{dateTime(quote.changeDeadline)}</dd></div><div><dt>Penalty rate</dt><dd>{quote.ratePercent}% of order value</dd></div><div><dt>Recorded payment applied</dt><dd>{money(quote.paidAmount)}</dd></div><div><dt>Cancellation penalty</dt><dd>{money(quote.penaltyAmount)}</dd></div><div><dt>Refund due</dt><dd>{money(quote.refundAmount)}</dd></div><div><dt>Additional amount due</dt><dd>{money(quote.amountDue)}</dd></div></dl>
      <label className="field">Reason <span className="optional">Optional</span><textarea maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></label></>}
    <p className="dialog-copy">Confirming releases the venue and services and withdraws execution briefs. A cancellation statement records the amounts above; any refund or payment is settled separately. This action cannot be undone.</p>
  </Modal>;
}
