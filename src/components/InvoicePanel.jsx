import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { api } from '../services/api';
import { dateTime, money, period } from '../utils';
import { ErrorNotice, Pricing } from './UI';

// Loads the invoice for an order and exposes the actions each role can take on it.
export function useInvoice(order, token, onRefresh) {
  const [invoice, setInvoice] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const paymentKey = useRef({ invoiceId: null, key: null });
  useEffect(() => {
    if (!order) return undefined;
    const abort = new AbortController(); setLoading(true); setError('');
    api.invoices.get(token, order.id, abort.signal).then(data => { if (!abort.signal.aborted) setInvoice(data); })
      .catch(err => { if (err.name !== 'AbortError' && !abort.signal.aborted) { if (err.status === 404) setInvoice(null); else setError(err.message); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [token, order?.id, order?.status, order?.revision, version]);
  const perform = useCallback(async action => {
    if (busy) return; setBusy(true); setError('');
    try { const data = await action(); setInvoice(data); onRefresh?.(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }, [busy, onRefresh]);
  return {
    invoice, loading, busy, error, version,
    refresh: () => setVersion(value => value + 1),
    generate: () => perform(() => api.invoices.generate(token, order.id)),
    deliver: () => perform(() => api.invoices.deliver(token, order.id)),
    // throws on a declined card so the checkout form can show the message next to the fields
    pay: async outcome => {
      if (busy) return; setBusy(true); setError('');
      if (paymentKey.current.invoiceId !== invoice.id) paymentKey.current = { invoiceId: invoice.id, key: crypto.randomUUID() };
      try { const data = await api.invoices.pay(token, order.id, paymentKey.current.key, outcome, invoice.id); setInvoice(data); onRefresh?.(); }
      finally { setBusy(false); }
    },
  };
}

export const invoiceStatus = invoice => !invoice ? null
  : invoice.status === 'credited' ? { label: 'Demo credit issued', tone: 'confirmed' }
  : invoice.status === 'paid' ? { label: invoice.receipt?.isDemo ? 'Demo paid' : 'Paid', tone: 'confirmed' }
  : invoice.status === 'void' ? { label: 'Voided', tone: 'cancelled' }
  : invoice.status === 'issued' ? { label: 'Awaiting payment', tone: 'pending' }
  : { label: 'Draft', tone: 'pending' };

export function InvoiceDocument({ invoice }) {
  const status = invoiceStatus(invoice), credit = invoice.documentType === 'credit-note';
  return <div className="invoice-document"><div className="invoice-heading"><div><p className="eyebrow">Happy Holiday · {credit ? 'Credit note' : 'Invoice'}</p><h3>{invoice.number}</h3></div><span className={`status-badge status-${status.tone}`}>{status.label}</span></div>
    <dl className="details-grid"><div><dt>Client</dt><dd>{invoice.clientName}<br />{invoice.clientEmail}</dd></div><div><dt>Created</dt><dd>{dateTime(invoice.createdAt)}</dd></div><div><dt>Rental period</dt><dd>{period(invoice.pricing)}</dd></div><div><dt>Venue</dt><dd>{invoice.pricing.premiseName}<br />{invoice.pricing.address}</dd></div></dl>
    <Pricing quote={invoice.pricing} title="Booking items" />
    {(invoice.revision > 1 || invoice.previousPaidAmount > 0 || credit) && <div className="invoice-settlement"><span>Booking revision {invoice.revision || 1}</span><dl className="details-grid"><div><dt>Previously recorded payment</dt><dd>{money(invoice.previousPaidAmount)}</dd></div><div><dt>{credit ? 'Demo credit issued' : 'This invoice amount'}</dt><dd>{money(invoice.totalAmount)}</dd></div></dl>
      {credit && <p className="small muted">Demo credit settlement only. No money was moved.</p>}{invoice.status === 'paid' && !invoice.receipt && <p className="small muted">The revised booking is covered by previously recorded payments.</p>}</div>}
  </div>;
}

// Earlier invoices and credit notes for this booking; loaded only when opened.
export function InvoiceHistory({ order, token, version }) {
  const [open, setOpen] = useState(false), [history, setHistory] = useState([]), [error, setError] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    const abort = new AbortController(); setError('');
    api.invoices.history(token, order.id, abort.signal).then(setHistory).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [token, order.id, order.revision, order.status, open, version]);
  return <details className="workflow-details" onToggle={event => setOpen(event.currentTarget.open)}><summary>Invoice & payment history</summary><ErrorNotice message={error} />
    {history.map(document => <details className="workflow-details invoice-history-item" key={document.id}><summary>Revision {document.revision || 1} · {document.documentType === 'credit-note' ? 'Credit note' : 'Invoice'} · {money(document.totalAmount)} · {document.status}</summary><p className="small muted">{document.number}</p><Pricing quote={document.pricing} title="Saved booking snapshot" />{document.receipt && <p className="small">{document.receipt.reference} · {money(document.receipt.amount)}</p>}</details>)}</details>;
}

export function InvoiceEmpty({ staff, canGenerate, onRefresh }) {
  return <div className="tab-empty"><div className="empty-icon"><FileText size={24} /></div><h3>{staff ? 'No invoice yet' : 'Invoice not ready yet'}</h3>
    <p>{staff ? canGenerate ? 'Generate an invoice from the stored booking details. It stays a draft until you deliver it to the client portal.' : 'Invoices can only be created for pending or unpaid orders.' : 'Your manager will deliver an invoice after reviewing your booking. You will be able to pay it here.'}</p>{!staff && onRefresh && <button type="button" className="text-button" onClick={onRefresh}>Check again</button>}</div>;
}

export function PaymentReceipt({ invoice }) {
  const receipt = invoice.receipt;
  if (!receipt) return <div className="payment-success"><div className="payment-success-icon"><CheckCircle2 size={30} /></div><h3>Booking covered</h3><p className="muted">The revised booking is covered by previously recorded payments. No new payment was needed.</p></div>;
  return <div className="payment-success"><div className="payment-success-icon"><CheckCircle2 size={30} /></div><h3>{receipt.isDemo ? 'Demo payment successful' : 'Payment successful'}</h3><p className="muted">Your booking is confirmed. A receipt is stored with your invoice.</p>
    <dl className="receipt-lines"><div><dt>Amount paid</dt><dd>{money(receipt.amount)}</dd></div><div><dt>Paid on</dt><dd>{dateTime(receipt.paidAt)}</dd></div><div><dt>Invoice</dt><dd>{invoice.number}</dd></div><div><dt>Receipt reference</dt><dd className="reference">{receipt.reference}</dd></div></dl>
    {receipt.isDemo && <p className="small muted">Simulation only. No money was charged.</p>}</div>;
}
