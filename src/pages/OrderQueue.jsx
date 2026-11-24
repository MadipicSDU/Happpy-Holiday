import OrderDialog from '../components/OrderDialog';
import usePagination from '../usePagination';
import React, { useState, useEffect } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import CancelBookingDialog from '../components/CancelBookingDialog';
import { PageHeading, EmptyState, Status, OrderDetails, CancellationDetails, Pagination } from '../components/UI';
import { money, period, cancellable, stageNames, orderStage, staffSummary, shortRef } from '../utils';
// Staff column: brief progress from the people assigned in the execution schedule.
function StaffCell({ order }) { const info = staffSummary(order); return <span className={`staff-cell tone-${info.tone}`}><strong>{info.label}</strong>{info.detail && <span className="cell-secondary">{info.detail}</span>}</span>; }
export default function OrderQueue({ orders, onCancel, isAdmin, token, onRefresh, onRefreshOrder, openOrderId }) {
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState(''), [sort, setSort] = useState('start');
  const [detailId, setDetailId] = useState(null), [cancelOrder, setCancelOrder] = useState(null), [startTab, setStartTab] = useState('details');
  // Opened from the manager dashboard: a pending change request opens straight on the Changes tab.
  // "id|tab" from the dashboard opens the order on the tab of its next step
  useEffect(() => { if (!openOrderId) return; const [id, tab] = openOrderId.split('|'); setStartTab(tab || (orders.find(order => order.id === id)?.pendingChangeId ? 'changes' : 'details')); setDetailId(id); }, [openOrderId]);
  const filtered = orders.filter(order => (filter === 'all' || orderStage(order) === filter) && `${order.client || ''} ${order.venue} ${order.id}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'value' ? b.totalAmount - a.totalAmount : new Date(a.startsAt) - new Date(b.startsAt));
  const pagination = usePagination(filtered, `${search}|${filter}|${sort}`);
  const detail = orders.find(order => order.id === detailId);
  return <><PageHeading eyebrow="Order management" title={isAdmin ? 'All orders' : 'Assigned orders'} description={isAdmin ? 'Review submitted orders across the workspace.' : 'Review the rental details and packages assigned to you.'} />
    <div className="catalogue-toolbar"><label className="search-group"><span className="search-label">Search orders</span><span className="search-field"><Search size={17} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client, venue, or reference" /></span></label><label className="search-group"><span className="search-label">Status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option>{Object.entries(stageNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="search-group"><span className="search-label">Sort by</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="start">Rental date: earliest first</option><option value="value">Order value: highest first</option></select></label></div>
    <div className="table-card"><table><caption className="sr-only">{isAdmin ? 'All orders' : 'Assigned orders'}</caption><thead><tr><th>Client & venue</th><th>Rental period</th><th>Status</th><th>Staff</th><th>Order value</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pagination.items.map(order => <tr key={order.id}><td><strong>{order.client || 'Client name unavailable'}</strong><span className="cell-secondary">{order.venue}</span><span className="short-reference">{shortRef(order.id)}</span></td><td className="period-cell">{period(order)}</td><td><Status order={order} /><CancellationDetails order={order} compact /></td><td><StaffCell order={order} /></td><td className="amount-cell">{money(order.totalAmount)}</td><td><button className="button small-button secondary" onClick={() => { setStartTab('details'); setDetailId(order.id); }}>Review<ArrowUpRight size={15} /></button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title={orders.length ? 'No matching orders' : 'No assigned orders yet'} description={orders.length ? 'Try a different search or status.' : 'Submitted bookings will appear here when they are assigned.'} />}</div>
    <Pagination pagination={pagination} />
    <p className="small muted table-footnote">{filtered.length} {filtered.length === 1 ? 'order' : 'orders'} · Times shown in your local timezone · Order value does not indicate payment.</p>
    <OrderDialog order={detail} initialTab={startTab} role={isAdmin ? 'admin' : 'manager'} token={token} onRefresh={onRefresh} onRefreshOrder={onRefreshOrder} onClose={() => setDetailId(null)} onCancelRequest={setCancelOrder} />
    <CancelBookingDialog order={cancelOrder} token={token} onClose={() => setCancelOrder(null)} onCancel={onCancel} onCancelled={() => setStartTab('settlement')} />
  </>;
}
