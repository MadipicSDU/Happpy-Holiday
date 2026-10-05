import React from 'react';
import { PageHeading, EmptyState, Pagination } from '../components/UI';
import usePagination from '../usePagination';
import { money, activeOrder } from '../utils';
export default function Analytics({ orders, venues, isAdmin }) {
  const active = orders.filter(activeOrder), pending = orders.filter(order => order.status === 'pending');
  const clients = new Set(active.map(order => order.clientId)).size;
  const value = active.reduce((total, order) => total + Number(order.totalAmount), 0);
  const pagination = usePagination(venues);
  const byVenue = new Map();
  for (const order of orders) {
    const summary = byVenue.get(order.premiseId) || { total: 0, active: 0, value: 0 };
    summary.total++;
    if (activeOrder(order)) { summary.active++; summary.value += Number(order.totalAmount); }
    byVenue.set(order.premiseId, summary);
  }
  return <><PageHeading eyebrow="Workspace snapshot" title="Order overview" description={isAdmin ? 'A summary of loaded orders across the workspace.' : 'A summary of the orders currently assigned to you.'} />
    <div className="stat-grid">{[{ label: 'Active orders', value: active.length, note: 'Excludes completed and cancelled' }, { label: 'Pending review', value: pending.length, note: 'Submitted orders awaiting review' }, { label: 'Active clients', value: clients, note: 'Distinct clients with active orders' }, { label: 'Active order value', value: money(value), note: 'Quoted value, not collected revenue' }].map(stat => <section className="panel stat-card" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><p>{stat.note}</p></section>)}</div>
    <div className="section-heading"><h2>Orders by venue</h2><span className="small muted">{isAdmin ? 'All loaded orders' : 'Assigned orders only'}</span></div><div className="table-card"><table><caption className="sr-only">Booking counts and order value by venue</caption><thead><tr><th>Venue</th><th>Total orders</th><th>Active orders</th><th>Active order value</th></tr></thead><tbody>{pagination.items.map(venue => {
      const summary = byVenue.get(venue.id) || { total: 0, active: 0, value: 0 };
      return <tr key={venue.id}><td><strong>{venue.name}</strong><span className="cell-secondary">{venue.address}</span></td><td>{summary.total}</td><td>{summary.active}</td><td>{money(summary.value)}</td></tr>;
    })}</tbody></table>{!venues.length && <EmptyState title="No venues listed" description="Venue summaries will appear when the catalogue is available." />}</div>
    <Pagination pagination={pagination} />
    <p className="small muted table-footnote">Figures are calculated from the loaded order list. Occupancy is available in the Venue occupancy view.</p>
  </>;
}
