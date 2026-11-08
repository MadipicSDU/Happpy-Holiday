import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { dateTime, money, period } from '../utils';
import { ErrorNotice, Loading, Pricing } from './UI';
import DemoCheckout from './DemoCheckout';

export default function InvoicePanel({ order, token, role, onRefresh }) {
  const [invoice, setInvoice] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const paymentKey = useRef({ invoiceId: null, key: null });
  const [historyOpen, setHistoryOpen] = useState(false), [history, setHistory] = useState([]), [historyError, setHistoryError] = useState('');
  useEffect(() => {
    if (!historyOpen) return;
    const abort = new AbortController(); setHistoryError('');
    api.invoices.history(token, order.id, abort.signal).then(setHistory).catch(error => { if (!abort.signal.aborted) setHistoryError(error.message); });
    return () => abort.abort();
  }, [token, order.id, order.revision, order.status, historyOpen, version]);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    api.invoices.get(token, order.id, abort.signal).then(data => { if (!abort.signal.aborted) setInvoice(data); })
      .catch(err => { if (err.name !== 'AbortError' && !abort.signal.aborted) { if (err.status === 404) setInvoice(null); else setError(err.message); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [token, order.id, order.status, order.revision, version]);
  const perform = async action => {
    if (busy) return; setBusy(true); setError('');
    try { const data = await action(); setInvoice(data); onRefresh?.(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const staff = role !== 'client';
  const pay = async outcome => {
    if (busy) return; setBusy(true); setError('');
    if (paymentKey.current.invoiceId !== invoice.id) paymentKey.current = { invoiceId: invoice.id, key: crypto.randomUUID() };
    try { const data = await api.invoices.pay(token, order.id, paymentKey.current.key, outcome, invoice.id); setInvoice(data); onRefresh?.(); }
    finally { setBusy(false); }
  };
  return <section className="invoice-panel"><div className="section-heading"><h3>Invoice & payment</h3><button type="button" className="text-button" disabled={busy || loading} onClick={() => setVersion(value => value + 1)}>Refresh invoice</button></div><ErrorNotice message={error} />
    {loading ? <Loading label="Loading invoice…" /> : !invoice ? <><p className="muted small">{staff ? 'Generate an invoice from the stored booking details. It stays a draft until you deliver it to the client portal.' : 'Your manager has not delivered an invoice yet.'}</p>{staff && ['pending', 'awaiting-payment'].includes(order.status) && <button type="button" className="button primary" disabled={busy} onClick={() => perform(() => api.invoices.generate(token, order.id))}>{busy ? 'Generating…' : 'Generate invoice'}</button>}</> : <>
      <div className="invoice-document"><div className="invoice-heading"><div><p className="eyebrow">Happy Holiday · {invoice.documentType === 'credit-note' ? 'Credit note' : 'Invoice'}</p><h3>{invoice.number}</h3></div><span className={`status-badge status-${['paid', 'credited'].includes(invoice.status) ? 'confirmed' : invoice.status === 'void' ? 'cancelled' : 'pending'}`}>{invoice.status === 'credited' ? 'Demo credit issued' : invoice.status === 'paid' ? invoice.receipt?.isDemo ? 'Demo paid' : 'Paid' : invoice.status === 'void' ? 'Voided' : invoice.status === 'issued' ? 'Awaiting payment' : 'Draft'}</span></div><dl className="details-grid"><div><dt>Client</dt><dd>{invoice.clientName}<br />{invoice.clientEmail}</dd></div><div><dt>Created</dt><dd>{dateTime(invoice.createdAt)}</dd></div><div><dt>Rental period</dt><dd>{period(invoice.pricing)}</dd></div><div><dt>Venue</dt><dd>{invoice.pricing.premiseName}<br />{invoice.pricing.address}</dd></div></dl><Pricing quote={invoice.pricing} title="Booking items" /><div className="invoice-settlement"><span>Booking revision {invoice.revision || 1}</span><dl className="details-grid"><div><dt>Previously recorded payment</dt><dd>{money(invoice.previousPaidAmount)}</dd></div><div><dt>{invoice.documentType === 'credit-note' ? 'Demo credit issued' : 'This invoice amount'}</dt><dd>{money(invoice.totalAmount)}</dd></div></dl>{invoice.documentType === 'credit-note' && <p className="small muted">Demo credit settlement only. No money was moved.</p>}{invoice.status === 'paid' && !invoice.receipt && <p className="small muted">The revised booking is covered by previously recorded payments.</p>}</div>
      {invoice.receipt && <div className="payment-receipt"><h3>{invoice.receipt.isDemo ? 'Demo payment receipt' : 'Payment receipt'}</h3><p>{invoice.receipt.reference}</p><p>{money(invoice.receipt.amount)} · {dateTime(invoice.receipt.paidAt)}</p>{invoice.receipt.isDemo && <p className="small muted">Simulation only. No money was charged.</p>}</div>}</div>
      <div className="invoice-actions"><button type="button" className="button secondary" onClick={() => window.print()} disabled={busy}>Print / save PDF</button>{staff && invoice.status === 'draft' && <button type="button" className="button primary" disabled={busy} onClick={() => perform(() => api.invoices.deliver(token, order.id))}>{busy ? 'Delivering…' : 'Deliver to client portal'}</button>}</div>
      {!staff && invoice.status === 'issued' && (invoice.demoPaymentsEnabled ? <DemoCheckout key={invoice.id} invoice={invoice} busy={busy} onPay={pay} /> : <div className="demo-payment"><h3>Demo checkout</h3><p className="notice notice-warning">Demo payments are disabled. A real payment provider is not configured.</p></div>)}
      <details className="workflow-details" onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary>Invoice & payment history</summary><ErrorNotice message={historyError} />{history.map(document => <details className="workflow-details invoice-history-item" key={document.id}><summary>Revision {document.revision || 1} · {document.documentType === 'credit-note' ? 'Credit note' : 'Invoice'} · {money(document.totalAmount)} · {document.status}</summary><p className="small muted">{document.number}</p><Pricing quote={document.pricing} title="Saved booking snapshot" />{document.receipt && <p className="small">{document.receipt.reference} · {money(document.receipt.amount)}</p>}</details>)}</details>
    </>}
  </section>;
}
