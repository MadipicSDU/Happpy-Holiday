import OrderDialog from '../components/OrderDialog';
import usePagination from '../usePagination';
import React, { useState, useEffect } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import CancelBookingDialog from '../components/CancelBookingDialog';
import { PageHeading, EmptyState, Status, OrderDetails, CancellationDetails, Pagination } from '../components/UI';
import { money, period, cancellable, statusNames } from '../utils';
export default function OrderQueue({ orders, onCancel, isAdmin, token, onRefresh, openOrderId }) {
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState(''), [sort, setSort] = useState('start');
  const [detailId, setDetailId] = useState(null), [cancelOrder, setCancelOrder] = useState(null), [startTab, setStartTab] = useState('details');
  // Opened from the manager dashboard: a pending change request opens straight on the Changes tab.
  useEffect(() => { if (!openOrderId) return; setStartTab(orders.find(order => order.id === openOrderId)?.pendingChangeId ? 'changes' : 'details'); setDetailId(openOrderId); }, [openOrderId]);
  const filtered = orders.filter(order => (filter === 'all' || order.status === filter) && `${order.client || ''} ${order.venue} ${order.id}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'value' ? b.totalAmount - a.totalAmount : new Date(a.startsAt) - new Date(b.startsAt));
  const pagination = usePagination(filtered, `${search}|${filter}|${sort}`);
  const detail = orders.find(order => order.id === detailId);
  return <><PageHeading eyebrow="Order management" title={isAdmin ? 'All orders' : 'Assigned orders'} description={isAdmin ? 'Review submitted orders across the workspace.' : 'Review the rental details and packages assigned to you.'} />
    <div className="catalogue-toolbar"><label className="search-field"><Search size={17} /><input aria-label="Search orders" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client, venue, or reference" /></label><select aria-label="Filter order status" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Sort orders" value={sort} onChange={event => setSort(event.target.value)}><option value="start">Rental date: earliest first</option><option value="value">Order value: highest first</option></select></div>
    <div className="table-card"><table><caption className="sr-only">{isAdmin ? 'All orders' : 'Assigned orders'}</caption><thead><tr><th>Client & venue</th><th>Rental period</th><th>Status</th><th>Order value</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pagination.items.map(order => <tr key={order.id}><td><strong>{order.client || 'Client name unavailable'}</strong><span className="cell-secondary">{order.venue}</span><span className="short-reference">{order.id.slice(0, 12)}…</span></td><td className="period-cell">{period(order)}</td><td><Status status={order.status} /><CancellationDetails order={order} compact /></td><td className="amount-cell">{money(order.totalAmount)}</td><td><button className="button small-button secondary" onClick={() => { setStartTab('details'); setDetailId(order.id); }}>Review<ArrowUpRight size={15} /></button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title={orders.length ? 'No matching orders' : 'No assigned orders yet'} description={orders.length ? 'Try a different search or status.' : 'Submitted bookings will appear here when they are assigned.'} />}</div>
    <Pagination pagination={pagination} />
    <p className="small muted table-footnote">{filtered.length} {filtered.length === 1 ? 'order' : 'orders'} · Times shown in your local timezone · Order value does not indicate payment.</p>
    <OrderDialog order={detail} initialTab={startTab} role={isAdmin ? 'admin' : 'manager'} token={token} onRefresh={onRefresh} onClose={() => setDetailId(null)} onCancelRequest={order => { setCancelOrder(order); setDetailId(null); }} />
    <CancelBookingDialog order={cancelOrder} onClose={() => setCancelOrder(null)} onCancel={onCancel} onCancelled={order => setDetailId(order.id)} />
  </>;
}
