import React, { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, CreditCard, Loader2, Printer, Send } from 'lucide-react';
import Modal from './Modal';
import DemoCheckout from './DemoCheckout';
import AlternativeVenues from './AlternativeVenues';
import OrderChanges from './OrderChanges';
import ExecutionPanel from './ExecutionPanel';
import { ErrorNotice, Loading, OrderDetails } from './UI';
import { useInvoice, invoiceStatus, InvoiceDocument, InvoiceEmpty, InvoiceHistory, PaymentReceipt } from './InvoicePanel';
import { money, cancellable } from '../utils';

// One order, split into short tabs (Details · Changes · Invoice · Payment · Execution · Alternatives) so nothing needs a long scroll.
// Footer rule used everywhere: all actions sit on the right, secondary first, the primary action last.
export default function OrderDialog({ order, role, token, onClose, onRefresh, onCancelRequest, venues, services, initialTab = 'details' }) {
  const staff = role !== 'client', formId = useId();
  const [tab, setTab] = useState(initialTab), [slot, setSlot] = useState(null);
  useEffect(() => { setTab(initialTab); }, [order?.id, initialTab]);
  const inv = useInvoice(order, token, onRefresh);
  const { invoice } = inv;
  const paid = ['paid', 'credited'].includes(invoice?.status), payable = !staff && invoice?.status === 'issued';
  const canGenerate = order && ['pending', 'awaiting-payment'].includes(order.status);
  const showAlternatives = staff && order && new Date(order.startsAt) > new Date() && !['cancelled', 'completed'].includes(order.status);
  const showChanges = order && order.status !== 'cancelled';
  const showExecution = staff && order && order.status === 'confirmed';
  const tabs = [
    { id: 'details', label: 'Details' },
    showChanges && { id: 'changes', label: 'Changes', badge: order.pendingChangeId ? { label: 'To review', tone: 'pending' } : null },
    { id: 'invoice', label: 'Invoice', badge: invoiceStatus(invoice) },
    !staff && { id: 'payment', label: paid ? 'Receipt' : 'Payment', disabled: !payable && !paid },
    showExecution && { id: 'execution', label: 'Execution' },
    showAlternatives && { id: 'alternatives', label: 'Alternatives' },
  ].filter(Boolean);
  const print = <button type="button" className="button secondary" disabled={inv.busy} onClick={() => window.print()}><Printer size={16} />Print / save PDF</button>;
  const close = <button type="button" className="button secondary" disabled={inv.busy} onClick={onClose}>Close</button>;
  const cancel = order && cancellable(order) && onCancelRequest && <button type="button" className="button danger-outline" onClick={() => onCancelRequest(order)}>{staff ? 'Cancel unpaid order' : 'Cancel booking'}</button>;
  let footer;
  if (tab === 'details') footer = <>{cancel}{close}<button type="button" className="button primary" onClick={() => setTab('invoice')}>View invoice<ArrowRight size={16} /></button></>;
  else if (tab === 'invoice') {
    if (inv.loading) footer = close;
    else if (!invoice) footer = <>{close}{staff && canGenerate && <button type="button" className="button primary" disabled={inv.busy} onClick={inv.generate}>{inv.busy ? 'Generating…' : 'Generate invoice'}</button>}</>;
    else if (staff && invoice.status === 'draft') footer = <>{print}<button type="button" className="button primary" disabled={inv.busy} onClick={inv.deliver}><Send size={16} />{inv.busy ? 'Delivering…' : 'Deliver to client portal'}</button></>;
    else if (payable) footer = <>{print}<button type="button" className="button primary" onClick={() => setTab('payment')}><CreditCard size={16} />Pay {money(invoice.totalAmount)}</button></>;
    else footer = <>{print}{close}</>;
  } else if (tab === 'payment') {
    footer = paid ? <>{print}<button type="button" className="button primary" onClick={onClose}>Done</button></>
      : <><button type="button" className="button secondary" disabled={inv.busy} onClick={() => setTab('invoice')}><ArrowLeft size={16} />Back to invoice</button>
        <button type="submit" form={formId} className="button primary demo-pay-button" disabled={inv.busy || !invoice?.demoPaymentsEnabled}>{inv.busy ? <><Loader2 className="spin" size={17} />Processing…</> : <><CreditCard size={17} />Pay {money(invoice?.totalAmount)} · Demo</>}</button></>;
  } else if (tab === 'changes' || tab === 'execution') footer = <>{close}<span className="footer-slot" ref={setSlot} /></>;
  else footer = close;

  return <Modal isOpen={Boolean(order)} onClose={onClose} busy={inv.busy} wide title={staff ? 'Order details' : 'Booking details'} tabs={tabs} activeTab={tab} onTabChange={setTab} footer={footer}>
    {order && tab === 'details' && <OrderDetails order={order} staff={staff} />}
    {order && tab === 'changes' && <OrderChanges order={order} token={token} role={role} venues={venues} services={services} onRefresh={onRefresh} footerNode={slot} />}
    {order && tab === 'invoice' && <section className="invoice-panel"><ErrorNotice message={inv.error} onRetry={inv.error ? inv.refresh : undefined} />
      {inv.loading ? <Loading label="Loading invoice…" /> : invoice ? <InvoiceDocument invoice={invoice} /> : <InvoiceEmpty staff={staff} canGenerate={canGenerate} onRefresh={inv.refresh} />}
      {staff && invoice?.status === 'draft' && <p className="small muted">The client cannot see this invoice until you deliver it.</p>}
      {invoice && <InvoiceHistory order={order} token={token} version={inv.version} />}</section>}
    {order && tab === 'execution' && <ExecutionPanel order={order} token={token} onRefresh={onRefresh} footerNode={slot} />}
    {order && tab === 'payment' && invoice && (paid ? <PaymentReceipt invoice={invoice} />
      : invoice.demoPaymentsEnabled ? <DemoCheckout key={invoice.id} invoice={invoice} busy={inv.busy} onPay={inv.pay} formId={formId} />
      : <div className="notice notice-warning">Demo payments are disabled. A real payment provider is not configured.</div>)}
    {order && tab === 'alternatives' && <AlternativeVenues token={token} request={{ premiseId: order.premiseId, startsAt: order.startsAt, endsAt: order.endsAt, guests: order.guests, orderId: order.id }} />}
  </Modal>;
}
