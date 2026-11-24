import OrderDialog from '../components/OrderDialog';
import usePagination from '../usePagination';
import React, { useState, useEffect } from 'react';
import { Plus, CalendarDays, Users, ArrowUpRight, CreditCard, GitPullRequestArrow } from 'lucide-react';
import CancelBookingDialog from '../components/CancelBookingDialog';
import { PageHeading, EmptyState, Status, OrderDetails, CancellationDetails, Pagination } from '../components/UI';
import { money, cancellable, activeOrder, when, relative, shortRef } from '../utils';
export default function MyEvents({ openOrderId, orders, onCancel, onNavigate, token, onRefresh, onRefreshOrder, venues, services }) {
  const [filter, setFilter] = useState('all'), [detailId, setDetailId] = useState(null), [cancelOrder, setCancelOrder] = useState(null), [startTab, setStartTab] = useState('details');
  const open = (order, tab = 'details') => { setStartTab(tab); setDetailId(order.id); };
  // opened from a notification: "id|tab"
  useEffect(() => { if (!openOrderId) return; const [id, tab] = openOrderId.split('|'); if (orders.some(order => order.id === id)) { setStartTab(tab || 'details'); setDetailId(id); } }, [openOrderId]);
  const filtered = orders.filter(order => filter === 'all' || (filter === 'active' ? activeOrder(order) : !activeOrder(order))).sort((a, b) => (activeOrder(b) - activeOrder(a)) || (activeOrder(a) ? new Date(a.startsAt) - new Date(b.startsAt) : new Date(b.startsAt) - new Date(a.startsAt)));
  const pagination = usePagination(filtered, filter, 8);
  const detail = orders.find(order => order.id === detailId);
  return <><PageHeading eyebrow="Your reservations" title="My bookings" description="See your rental periods, selected services, and order details." action={<button className="button primary" onClick={() => onNavigate('spaces')}><Plus size={17} />New booking</button>} />
    <div className="list-toolbar"><div className="segmented" role="group" aria-label="Filter bookings">{[['all', 'All bookings'], ['active', 'Active'], ['closed', 'Closed']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}<span>{orders.filter(order => value === 'all' || (value === 'active' ? activeOrder(order) : !activeOrder(order))).length}</span></button>)}</div><span className="small muted">Upcoming first</span></div>
    <div className="booking-list">{pagination.items.map(order => <article className="booking-card" key={order.id}><div className="booking-card-main"><div className="booking-topline"><Status order={order} />{order.pendingChangeId && <span className="flag-chip"><GitPullRequestArrow size={13} />Change request pending</span>}<span className="short-reference" title={order.id}>{shortRef(order.id)}</span></div><h2>{order.venue}</h2><p className="muted">{order.address}</p><div className="meta"><span><CalendarDays size={16} />{when(order)}{activeOrder(order) && new Date(order.startsAt) > new Date() && <em className="muted"> · {relative(order.startsAt)}</em>}</span><span><Users size={16} />{order.guests} guests</span></div><CancellationDetails order={order} compact /></div><div className="booking-card-actions"><strong>{money(order.totalAmount)}</strong><span className="small muted">Order value</span>{order.status === 'awaiting-payment' ? <button className="button primary" onClick={() => open(order, 'payment')}><CreditCard size={16} />Pay {money(order.totalAmount - (order.paidAmount || 0))}</button> : null}<button className="button secondary" onClick={() => open(order)}>View details<ArrowUpRight size={16} /></button>{cancellable(order) && <button className="text-button destructive" onClick={() => setCancelOrder(order)}>Cancel booking</button>}</div></article>)}</div>
    <Pagination pagination={pagination} />
    {!filtered.length && <EmptyState icon={CalendarDays} title={orders.length ? 'No bookings in this view' : 'Your plans start here'} description={orders.length ? 'Choose another filter to see your bookings.' : 'Find a venue and review your package before submitting an order.'} action={<button className="button secondary" onClick={() => orders.length ? setFilter('all') : onNavigate('spaces')}>{orders.length ? 'Show all bookings' : 'Find a venue'}</button>} />}
    <OrderDialog order={detail} initialTab={startTab} role="client" token={token} venues={venues} services={services} onRefresh={onRefresh} onRefreshOrder={onRefreshOrder} onClose={() => setDetailId(null)} onCancelRequest={setCancelOrder} />
    <CancelBookingDialog order={cancelOrder} token={token} onClose={() => setCancelOrder(null)} onCancel={onCancel} onCancelled={order => open(order, 'settlement')} />
  </>;
}
