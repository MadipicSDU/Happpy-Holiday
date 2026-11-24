import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeading, EmptyState, Pagination } from '../components/UI';
import usePagination from '../usePagination';
import { money, activeOrder } from '../utils';
import PeriodReports from './PeriodReports';
export default function Analytics({ orders, venues, services, isAdmin, token, refreshVersion }) {
  const [periodReportsOpen, setPeriodReportsOpen] = useState(false);
  const active = orders.filter(activeOrder), pending = orders.filter(order => order.status === 'pending');
  const clients = new Set(active.map(order => order.clientId)).size;
  const value = active.reduce((total, order) => total + Number(order.totalAmount), 0);
  const [search, setSearch] = useState(''), [show, setShow] = useState('orders'), [sort, setSort] = useState('value');
  const byVenue = new Map();
  for (const order of orders) {
    const summary = byVenue.get(order.premiseId) || { total: 0, active: 0, value: 0 };
    summary.total++;
    if (activeOrder(order)) { summary.active++; summary.value += Number(order.totalAmount); }
    byVenue.set(order.premiseId, summary);
  }
  // Busiest venues first; venues without any orders are hidden until asked for (less scrolling through empty rows).
  const empty = { total: 0, active: 0, value: 0 };
  const stat = venue => byVenue.get(venue.id) || empty;
  const SHOW = [['orders', 'With orders', venue => stat(venue).total > 0], ['active', 'With active orders', venue => stat(venue).active > 0], ['none', 'No orders yet', venue => stat(venue).total === 0], ['all', 'All venues', () => true]];
  const query = search.trim().toLowerCase();
  const shown = venues.filter(SHOW.find(([key]) => key === show)[2]).filter(venue => !query || `${venue.name} ${venue.address}`.toLowerCase().includes(query))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'total' ? stat(b).total - stat(a).total || a.name.localeCompare(b.name) : stat(b).value - stat(a).value || stat(b).total - stat(a).total || a.name.localeCompare(b.name));
  const pagination = usePagination(shown, `${show}|${query}|${sort}`);
  return <><PageHeading eyebrow="Workspace snapshot" title="Reports" description={isAdmin ? 'A summary of loaded orders across the workspace.' : 'A summary of the orders currently assigned to you.'} />
    <div className="stat-grid">{[{ label: 'Active orders', value: active.length, note: 'Excludes completed and cancelled' }, { label: 'Pending review', value: pending.length, note: 'Submitted orders awaiting review' }, { label: 'Active clients', value: clients, note: 'Distinct clients with active orders' }, { label: 'Active order value', value: money(value), note: 'Quoted value, not collected revenue' }].map(stat => <section className="panel stat-card" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><p>{stat.note}</p></section>)}</div>
    <div className="section-heading"><div><h2>Orders by venue</h2><p className="small muted">{isAdmin ? 'All loaded orders' : 'Assigned orders only'}</p></div></div>
    <div className="report-toolbar">
      <label className="search-group"><span className="search-label">Search venues</span><span className="search-field"><Search size={16} aria-hidden="true" /><input type="search" value={search} placeholder="Name or address" onChange={event => setSearch(event.target.value)} /></span></label>
      <div className="report-show"><span className="search-label" id="report-show">Show</span><div className="run-filters" role="group" aria-labelledby="report-show">{SHOW.map(([key, label, test]) => <button key={key} type="button" aria-pressed={show === key} className={`exec-chip ${show === key ? 'selected' : ''}`} onClick={() => setShow(key)}>{label}<span>{venues.filter(test).length}</span></button>)}</div></div>
      <label className="search-group report-sort"><span className="search-label">Sort by</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="value">Active order value</option><option value="total">Number of orders</option><option value="name">Venue name A–Z</option></select></label>
    </div>
    <p className="small muted report-count" role="status">{shown.length} {shown.length === 1 ? 'venue' : 'venues'}{query ? ` matching “${search.trim()}”` : ''}{(query || show !== 'orders') && <> · <button type="button" className="text-button" onClick={() => { setSearch(''); setShow('orders'); }}>Reset</button></>}</p>
    <div className="table-card"><table><caption className="sr-only">Booking counts and order value by venue</caption><thead><tr><th>Venue</th><th>Total orders</th><th>Active orders</th><th>Active order value</th></tr></thead><tbody>{pagination.items.map(venue => {
      const summary = byVenue.get(venue.id) || { total: 0, active: 0, value: 0 };
      return <tr key={venue.id}><td><strong>{venue.name}</strong><span className="cell-secondary">{venue.address}</span></td><td>{summary.total}</td><td>{summary.active}</td><td>{money(summary.value)}</td></tr>;
    })}</tbody></table>{!shown.length && <EmptyState title={venues.length ? 'No venues match' : 'No venues listed'} description={venues.length ? 'Try another search or choose “All venues”.' : 'Venue summaries will appear when the catalogue is available.'} />}</div>
    <Pagination pagination={pagination} />
    <p className="small muted table-footnote">Figures are calculated from the loaded order list. Occupancy is available in the Venue occupancy view.</p>
    <details className="workflow-details sprint-addition" onToggle={event => setPeriodReportsOpen(event.currentTarget.open)}>
      <summary>Period reports, ratings and feedback</summary>
      {periodReportsOpen && <PeriodReports token={token} venues={venues} services={services} isAdmin={isAdmin} refreshVersion={refreshVersion} />}
    </details>
  </>;
}
