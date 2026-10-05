import usePagination from '../usePagination';
import React, { useState } from 'react';
import { Plus, CalendarDays, Users, ArrowUpRight } from 'lucide-react';
import Modal from '../components/Modal';
import CancelBookingDialog from '../components/CancelBookingDialog';
import { PageHeading, EmptyState, Status, OrderDetails, Pagination } from '../components/UI';
import { money, period, cancellable, activeOrder, zone } from '../utils';
export default function MyEvents({ orders, onCancel, onNavigate }) {
  const [filter, setFilter] = useState('all'), [detailId, setDetailId] = useState(null), [cancelOrder, setCancelOrder] = useState(null);
  const filtered = orders.filter(order => filter === 'all' || (filter === 'active' ? activeOrder(order) : !activeOrder(order))).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const pagination = usePagination(filtered, filter, 12);
  const detail = orders.find(order => order.id === detailId);
  return <><PageHeading eyebrow="Your reservations" title="My bookings" description="See your rental periods, selected services, and order details." action={<button className="button primary" onClick={() => onNavigate('spaces')}><Plus size={17} />New booking</button>} />
    <div className="list-toolbar"><div className="segmented" role="group" aria-label="Filter bookings">{[['all', 'All bookings'], ['active', 'Active'], ['closed', 'Closed']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}<span>{orders.filter(order => value === 'all' || (value === 'active' ? activeOrder(order) : !activeOrder(order))).length}</span></button>)}</div><span className="small muted">{zone()}</span></div>
    <div className="booking-list">{pagination.items.map(order => <article className="booking-card" key={order.id}><div className="booking-card-main"><div className="booking-topline"><Status status={order.status} /><span className="short-reference" title={order.id}>{order.id.slice(0, 12)}…</span></div><h2>{order.venue}</h2><p className="muted">{order.address}</p><div className="meta"><span><CalendarDays size={16} />{period(order)}</span><span><Users size={16} />{order.guests} guests</span></div></div><div className="booking-card-actions"><strong>{money(order.totalAmount)}</strong><span className="small muted">Order value</span><button className="button secondary" onClick={() => setDetailId(order.id)}>View details<ArrowUpRight size={16} /></button>{cancellable(order) && <button className="text-button destructive" onClick={() => setCancelOrder(order)}>Cancel booking</button>}</div></article>)}</div>
    <Pagination pagination={pagination} />
    {!filtered.length && <EmptyState icon={CalendarDays} title={orders.length ? 'No bookings in this view' : 'Your plans start here'} description={orders.length ? 'Choose another filter to see your bookings.' : 'Find a venue and review your package before submitting an order.'} action={<button className="button secondary" onClick={() => orders.length ? setFilter('all') : onNavigate('spaces')}>{orders.length ? 'Show all bookings' : 'Find a venue'}</button>} />}
    <Modal isOpen={Boolean(detail)} onClose={() => setDetailId(null)} title="Booking details" wide footer={<button className="button secondary" onClick={() => setDetailId(null)}>Close details</button>}>{detail && <OrderDetails order={detail} />}</Modal>
    <CancelBookingDialog order={cancelOrder} onClose={() => setCancelOrder(null)} onCancel={onCancel} />
  </>;
}
