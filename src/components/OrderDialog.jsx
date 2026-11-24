import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CreditCard, Loader2, Printer, RefreshCw, Send } from 'lucide-react';
import OrderPage from './OrderPage';
import DemoCheckout from './DemoCheckout';
import AlternativeVenues from './AlternativeVenues';
import OrderChanges from './OrderChanges';
import ExecutionPanel from './ExecutionPanel';
import { CancellationStatement, ClientSchedule, EventReview } from './LifecyclePanels';
import { ErrorNotice, Loading, Pricing, CancellationDetails } from './UI';
import OrderSummary from './OrderSummary';
import { useInvoice, invoiceStatus, InvoiceDocument, InvoiceEmpty, InvoiceHistory, PaymentReceipt } from './InvoicePanel';
import { activeOrder, money, cancellable, shortRef, dateTime } from '../utils';
import { canReview } from '../lifecycle';

// One order, split into short tabs (Details · Changes · Invoice · Payment · Execution · Alternatives) so nothing needs a long scroll.
// Footer rule used everywhere: all actions sit on the right, secondary first, the primary action last.
export default function OrderDialog({ order, role, token, onClose, onRefresh, onRefreshOrder, onCancelRequest, venues, services, initialTab = 'details' }) {
  const staff = role !== 'client', formId = useId();
  // Closing through history keeps the browser Back button and the on-page Close button in step.
  const closePage = () => { if (window.history.state?.hhOrderPage) window.history.back(); else onClose(); };
  const [tab, setTab] = useState(initialTab), [slot, setSlot] = useState(null);
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState('');
  const refreshRequest = useRef(null);
  useEffect(() => { setTab(initialTab); }, [order?.id, initialTab]);
  useEffect(() => {
    setRefreshing(false);
    setRefreshError('');
    return () => refreshRequest.current?.abort();
  }, [order?.id]);
  const inv = useInvoice(order, token, onRefresh);
  const { invoice } = inv;
  const loading = refreshing || inv.loading;
  const paid = ['paid', 'credited'].includes(invoice?.status);
  const payable = !staff && !loading && invoice?.status === 'issued' && order?.status === 'awaiting-payment';
  const refreshBooking = async () => {
    if (refreshRequest.current || !order || !onRefreshOrder) return;
    const request = new AbortController();
    refreshRequest.current = request;
    setRefreshing(true);
    setRefreshError('');
    try {
      await onRefreshOrder(order.id, request.signal);
      if (!request.signal.aborted) inv.refresh();
    } catch (error) {
      if (!request.signal.aborted) setRefreshError(error.message);
    } finally {
      if (refreshRequest.current === request) {
        refreshRequest.current = null;
        if (!request.signal.aborted) setRefreshing(false);
      }
    }
  };
  const canGenerate = order && ['pending', 'awaiting-payment'].includes(order.status);
  const showAlternatives = staff && order && activeOrder(order) && new Date(order.startsAt) > new Date();
  const showChanges = order && order.status !== 'cancelled';
  const showExecution = staff && order && order.status === 'confirmed';
  const tabs = [
    { id: 'details', label: 'Price & details' },
    showChanges && { id: 'changes', label: 'Changes', badge: order.pendingChangeId ? { label: staff ? 'To review' : 'Pending', tone: 'pending' } : null },
    { id: 'invoice', label: 'Invoice', badge: invoiceStatus(invoice) },
    !staff && { id: 'payment', label: paid ? 'Receipt' : 'Payment', disabled: !payable && !paid },
    showExecution && { id: 'execution', label: 'Execution' },
    showAlternatives && { id: 'alternatives', label: 'Alternatives' },
    !staff && ['confirmed', 'completed'].includes(order?.status) && { id: 'schedule', label: 'Event schedule' },
    order?.status === 'cancelled' && { id: 'settlement', label: 'Cancellation statement' },
    (canReview(order) || (staff && order?.status === 'completed')) && { id: 'review', label: 'Review' },
  ].filter(Boolean);
  useEffect(() => {
    if (order && !tabs.some(item => item.id === tab)) setTab('details');
  }, [tab, order?.status, order?.startsAt, order?.paymentConfirmedAt, order?.paidAmount, order?.totalAmount, role]);
  const print = <button type="button" className="button secondary" disabled={inv.busy || loading} onClick={() => window.print()}><Printer size={16} />Print / save PDF</button>;
  const close = <button type="button" className="button secondary" disabled={inv.busy} onClick={closePage}>Close</button>;
  const cancel = order && cancellable(order) && onCancelRequest && <button type="button" className="button danger-outline" onClick={() => onCancelRequest(order)}>Cancel booking</button>;
  let footer;
  if (tab === 'details') footer = <>{cancel}{close}<button type="button" className="button primary" onClick={() => setTab('invoice')}>View invoice<ArrowRight size={16} /></button></>;
  else if (tab === 'invoice') {
    if (loading) footer = close;
    else if (!invoice) footer = <>{close}{staff && canGenerate && <button type="button" className="button primary" disabled={inv.busy} onClick={inv.generate}>{inv.busy ? 'Generating…' : 'Generate invoice'}</button>}</>;
    else if (staff && invoice.status === 'draft') footer = <>{print}<button type="button" className="button primary" disabled={inv.busy} onClick={inv.deliver}><Send size={16} />{inv.busy ? 'Delivering…' : 'Deliver to client portal'}</button></>;
    else if (payable) footer = <>{print}<button type="button" className="button primary" onClick={() => setTab('payment')}><CreditCard size={16} />Pay {money(invoice.totalAmount)}</button></>;
    else footer = <>{print}{close}</>;
  } else if (tab === 'payment') {
    footer = loading || !invoice || (!paid && !payable) ? close : paid ? <>{print}<button type="button" className="button primary" onClick={closePage}>Done</button></>
      : <><button type="button" className="button secondary" disabled={inv.busy} onClick={() => setTab('invoice')}><ArrowLeft size={16} />Back to invoice</button>
        <button type="submit" form={formId} className="button primary demo-pay-button" disabled={inv.busy || !invoice?.demoPaymentsEnabled}>{inv.busy ? <><Loader2 className="spin" size={17} />Processing…</> : <><CreditCard size={17} />Pay {money(invoice?.totalAmount)} · Demo</>}</button></>;
  } else if (tab === 'changes' || tab === 'execution') footer = <>{close}<span className="footer-slot" ref={setSlot} /></>;
  else footer = close;

  return <OrderPage isOpen={Boolean(order)} onClose={onClose} busy={inv.busy} backLabel={staff ? 'Orders' : 'My bookings'} title={order?.venue || (staff ? 'Order details' : 'Booking details')} subtitle={order && (staff ? `Order ${shortRef(order.id)}${order.client ? ` · ${order.client}` : ''}` : `Your booking ${shortRef(order.id)}`)} summary={order && <OrderSummary order={order} staff={staff} />} tabs={tabs} activeTab={tab} onTabChange={setTab} footer={footer}>
    {onRefreshOrder && <div className="sprint-order-tools"><button type="button" className="text-button" disabled={inv.busy || loading} onClick={refreshBooking}><RefreshCw size={15} />{refreshing ? 'Refreshing…' : 'Refresh booking'}</button></div>}
    <ErrorNotice message={refreshError} />
    {order && tab === 'details' && <><CancellationDetails order={order} />{order.completedAt && <p className="small muted details-note">Completed {dateTime(order.completedAt)}{order.archivedAt && ' · Archived in booking history'}</p>}{order.status === 'expired' && <p className="notice notice-info">The rental period ended without payment. This booking is closed.</p>}{order.pricing && <Pricing quote={order.pricing} />}{staff && <p className="small muted details-note">Manager: {order.managerId ? 'assigned' : 'not yet assigned'} · Revision {order.revision || 1}</p>}{order.status === 'pending' && !staff && <p className="small muted details-note">Your order has been submitted for manager review. Submission does not confirm the booking.</p>}</>}
    {order && tab === 'changes' && <OrderChanges order={order} token={token} role={role} venues={venues} services={services} onRefresh={onRefresh} footerNode={slot} onOpenTab={setTab} refreshVersion={inv.version} />}
    {order && tab === 'invoice' && <section className="invoice-panel"><ErrorNotice message={inv.error} onRetry={inv.error ? inv.refresh : undefined} />
      {loading ? <Loading label="Loading invoice…" /> : invoice ? <InvoiceDocument invoice={invoice} /> : <InvoiceEmpty staff={staff} canGenerate={canGenerate} onRefresh={inv.refresh} />}
      {staff && invoice?.status === 'draft' && <p className="small muted">The client cannot see this invoice until you deliver it.</p>}
      {invoice && <InvoiceHistory order={order} token={token} version={inv.version} />}</section>}
    {order && tab === 'execution' && <ExecutionPanel order={order} token={token} onRefresh={onRefresh} footerNode={slot} refreshVersion={inv.version} />}
    {order && tab === 'schedule' && <ClientSchedule key={order.id} order={order} token={token} refreshVersion={inv.version} />}
    {order && tab === 'settlement' && <CancellationStatement key={order.id} order={order} token={token} staff={staff} refreshVersion={inv.version} />}
    {order && tab === 'review' && <EventReview key={order.id} order={order} token={token} staff={staff} refreshVersion={inv.version} />}
    {order && tab === 'payment' && <><ErrorNotice message={inv.error} onRetry={inv.refresh} />
      {loading ? <Loading label="Loading payment…" /> : paid ? <PaymentReceipt invoice={invoice} />
        : !payable ? <InvoiceEmpty staff={false} canGenerate={false} onRefresh={inv.refresh} />
        : invoice.demoPaymentsEnabled ? <DemoCheckout key={invoice.id} invoice={invoice} busy={inv.busy} onPay={inv.pay} formId={formId} />
        : <div className="notice notice-warning">Demo payments are disabled. A real payment provider is not configured.</div>}
    </>}
    {order && tab === 'alternatives' && <AlternativeVenues token={token} request={{ premiseId: order.premiseId, startsAt: order.startsAt, endsAt: order.endsAt, guests: order.guests, orderId: order.id }} />}
  </OrderPage>;
}
