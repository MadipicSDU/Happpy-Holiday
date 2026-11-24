import React, { useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { EmptyState, ErrorNotice, Loading } from '../components/UI';
import useLiveData from '../useLiveData';
import { api } from '../services/api';
import { money, dateTime } from '../utils';
import { halfYearPeriod } from '../lifecycle';

const number = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const percent = value => `${number(Number(value) * 100)}%`;

function Maintenance({ token, year, half, onChanged }) {
  const live = useLiveData(signal => api.reports.audit(token, year, half, signal), [token, year, half]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const run = async action => {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const result = await api.reports[action](token);
      setMessage(action === 'complete' ? `${result.completed} paid bookings completed. ${result.expired ?? 0} unpaid bookings expired.` : `${result.archived} closed bookings archived. ${result.expiredChanges} stale change requests expired.`);
      live.refresh(); onChanged();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <section className="panel policy-panel"><h2>Biannual audit and maintenance</h2><ErrorNotice message={live.error || error} onRetry={live.refresh} />
    {live.busy && !live.data ? <Loading label="Loading database audit…" /> : live.data && <><dl className="details-grid">
      <div><dt>Orders starting in this half-year</dt><dd>{live.data.ordersInPeriod}</dd></div><div><dt>Invalid rental periods</dt><dd>{live.data.invalidPeriods}</dd></div>
      <div><dt>Paid bookings ready to complete</dt><dd>{live.data.paidOrdersReadyToComplete}</dd></div><div><dt>Closed bookings to archive</dt><dd>{live.data.terminalOrdersToArchive}</dd></div>
      <div><dt>Unpaid bookings ready to expire</dt><dd>{live.data.endedUnpaidOrders ?? 0}</dd></div><div><dt>Archived unpaid bookings</dt><dd>{live.data.expiredUnpaidOrders}</dd></div>
      <div><dt>Ended bookings with a payment on record</dt><dd>{live.data.endedPartiallyPaidOrders ?? 0}</dd></div><div><dt>Historical confirmations without receipts</dt><dd>{live.data.legacyConfirmedWithoutReceipt}</dd></div>
      <div><dt>Pending refunds</dt><dd>{money(live.data.pendingRefunds)}</dd></div><div><dt>Outstanding penalties</dt><dd>{money(live.data.outstandingPenalties)}</dd></div></dl>
      <p className="small muted">{live.data.note}</p><p className="small muted">Paid bookings complete and unpaid bookings expire after the rental ends. Bookings with a payment on record and a balance due are flagged for review.</p>
      <div className="row-actions"><button className="button secondary" disabled={busy} onClick={() => run('complete')}>Process ended bookings</button><button className="button secondary" disabled={busy} onClick={() => run('archive')}>Archive closed history</button></div>
      {message && <p role="status">{message}</p>}{live.data.recentRuns.length > 0 && <details><summary>Recent maintenance runs</summary>{live.data.recentRuns.map((run, i) => <p className="small" key={i}>{dateTime(run.at)} · {run.details}</p>)}</details>}
    </>}
  </section>;
}

export default function PeriodReports({ token, refreshVersion, venues, services, isAdmin }) {
  const now = new Date(), [year, setYear] = useState(now.getUTCFullYear()), [half, setHalf] = useState(now.getUTCMonth() < 6 ? 1 : 2);
  const [page, setPage] = useState(1), [downloading, setDownloading] = useState(false), [error, setError] = useState('');
  const range = halfYearPeriod(year, half);
  const live = useLiveData(signal => api.reports.analytics(token, range.from, range.to, signal), [token, year, half, refreshVersion]);
  const ratings = useLiveData(signal => api.reviews.summary(token, signal), [token, refreshVersion]);
  const feedback = useLiveData(signal => api.reviews.feedback(token, page, signal), [token, page, refreshVersion]);
  const report = live.data;
  const download = async () => {
    if (downloading) return; setDownloading(true); setError('');
    try {
      const blob = await api.reports.export(token, year, half);
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `happy-holiday-${year}-H${half}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message); } finally { setDownloading(false); }
  };
  return <section className="reports-view" aria-label="Period reports">
    <div className="report-controls"><label className="field">Year<select value={year} onChange={event => setYear(Number(event.target.value))}>{Array.from({ length: 101 }, (_, i) => 2000 + i).map(value => <option key={value}>{value}</option>)}</select></label><label className="field">Reporting period<select value={half} onChange={event => setHalf(Number(event.target.value))}><option value={1}>January – June</option><option value={2}>July – December</option></select></label>
      <button className="button secondary" onClick={live.refresh} disabled={live.busy}><RefreshCw size={16} />Refresh report</button><button className="button secondary" onClick={() => window.print()} disabled={!report || live.busy}><Printer size={16} />Print / save PDF</button>
      {isAdmin && <button className="button secondary" onClick={download} disabled={downloading}><Download size={16} />{downloading ? 'Exporting…' : 'Export half-year CSV'}</button>}</div>
    <ErrorNotice message={live.error || error} onRetry={live.refresh} />
    <p className="small muted report-scroll-hint">Swipe tables sideways to see all columns.</p>
    {live.busy && !report ? <Loading label="Calculating report…" /> : report && <><p className="small muted">{report.scope} · Report months use UTC · Snapshot {dateTime(report.checkedAt)}{live.busy ? ' · Refreshing…' : ''}</p>
      <div className="stat-grid">{[
        ['Bookings', report.totals.bookings, `${report.totals.cancelled} cancelled`],
        ['Reserved venue hours', number(report.totals.occupiedHours), `${percent(report.totals.availableHours ? report.totals.occupiedHours / report.totals.availableHours : 0)} of listed venue hours`],
        ['Net recorded payments', money(report.totals.netRecorded), 'Includes demo settlements; no bank reconciliation'],
        ['Refunds still pending', money(report.totals.pendingRefunds), `${money(report.totals.outstandingPenalties)} in outstanding penalties`],
      ].map(([label, value, note]) => <section className="panel stat-card" key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></section>)}</div>
      <section><div className="section-heading"><h2>Venue demand and downtime</h2></div><div className="table-card"><table><caption className="sr-only">Reserved and paid venue hours in this period</caption><thead><tr><th>Venue</th><th>Bookings</th><th>Reserved hours</th><th>Paid hours</th><th>Idle hours</th><th>Utilization</th><th>Order value</th></tr></thead><tbody>{report.venues.map(venue => <tr key={venue.id}><td><strong>{venue.name}</strong><span className="cell-secondary">{venue.address}</span></td><td>{venue.bookings}</td><td>{number(venue.occupiedHours)}</td><td>{number(venue.paidHours)}</td><td>{number(venue.availableHours - venue.occupiedHours)}</td><td>{percent(venue.utilization)}<meter className="report-meter" min={0} max={1} value={venue.utilization} aria-label={`${venue.name} utilization`} /></td><td>{money(venue.orderValue)}</td></tr>)}</tbody></table>{!report.venues.length && <EmptyState title="No venues listed" description="Add venues in Administration." />}</div></section>
      <section><div className="section-heading"><h2>Monthly demand and settlements</h2></div><div className="table-card"><table><caption className="sr-only">Monthly booking demand and recorded financial movements</caption><thead><tr><th>Month (UTC)</th><th>Bookings</th><th>Reserved hours</th><th>Payments</th><th>Change credits</th><th>Cancellation refunds</th><th>Penalty collections</th><th>Net recorded</th></tr></thead><tbody>{report.months.map(month => <tr key={month.month}><td>{month.month}</td><td>{month.bookings}</td><td>{number(month.occupiedHours)}</td><td>{money(month.grossPayments)}</td><td>{money(month.credits)}</td><td>{money(month.refunds)}</td><td>{money(month.penaltyCollections)}</td><td>{money(month.netRecorded)}</td></tr>)}</tbody></table></div></section>
      <section><div className="section-heading"><h2>Demand by location</h2></div><div className="table-card"><table><caption className="sr-only">Location demand by registered address</caption><thead><tr><th>Address</th><th>Venues</th><th>Bookings</th><th>Reserved hours</th><th>Utilization</th></tr></thead><tbody>{report.locations.map(location => <tr key={location.address}><td>{location.address}</td><td>{location.venues}</td><td>{location.bookings}</td><td>{number(location.occupiedHours)}</td><td>{percent(location.utilization)}</td></tr>)}</tbody></table></div></section>
      <section><div className="section-heading"><h2>Service demand</h2></div><div className="table-card"><table><caption className="sr-only">Services booked for events starting in the selected period</caption><thead><tr><th>Service</th><th>Bookings</th><th>Units</th><th>Order value</th></tr></thead><tbody>{report.services.map(service => <tr key={service.serviceId + service.name}><td>{service.name}</td><td>{service.bookings}</td><td>{service.units}</td><td>{money(service.orderValue)}</td></tr>)}</tbody></table>{!report.services.length && <EmptyState title="No service demand in this period" description="Choose another half-year to view booked services." />}</div></section>
      <p className="small muted table-footnote">{report.definitions}</p>
    </>}
    <section><div className="section-heading"><h2>Venue and service ratings</h2></div><ErrorNotice message={ratings.error} onRetry={ratings.refresh} />{ratings.busy && !ratings.data ? <Loading label="Loading ratings…" /> : ratings.data && <div className="table-card"><table><caption className="sr-only">Anonymous catalogue rating aggregates</caption><thead><tr><th>Venue / service</th><th>Type</th><th>Reviews</th><th>Average rating</th></tr></thead><tbody>{[...ratings.data.venues.map(item => ({ ...item, id: item.premiseId, type: 'Venue', name: venues.find(v => v.id === item.premiseId)?.name || 'Historical venue' })), ...ratings.data.services.map(item => ({ ...item, id: item.serviceId, type: 'Service', name: services.find(s => s.id === item.serviceId)?.name || 'Historical service' }))].map(item => <tr key={item.type + item.id}><td>{item.name}</td><td>{item.type}</td><td>{item.count}</td><td>{number(item.average)} / 5</td></tr>)}</tbody></table>{!ratings.data.venues.length && !ratings.data.services.length && <EmptyState title="No reviews yet" description="Completed-event reviews will appear here." />}</div>}</section>
    <section><div className="section-heading"><h2>Client feedback</h2><span className="small muted">{isAdmin ? 'All reviewed bookings' : 'Assigned bookings only'}</span></div><ErrorNotice message={feedback.error} onRetry={feedback.refresh} />{feedback.data && <><div className="feedback-list">{feedback.data.items.map(review => <article className="panel" key={review.id}><strong>Venue rating {review.rating} / 5</strong><p>{review.comment || 'No written comment.'}</p><p className="small muted">{review.orderId} · {dateTime(review.submittedAt)}</p>{review.services.map(s => <p className="small" key={s.serviceId}>{s.serviceName}: {s.rating} / 5</p>)}</article>)}</div><nav className="pagination" aria-label="Feedback pages"><span>{feedback.data.total} reviews</span><div><button className="button secondary small-button" disabled={page <= 1 || feedback.busy} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button className="button secondary small-button" disabled={page * 30 >= feedback.data.total || feedback.busy} onClick={() => setPage(value => value + 1)}>Next</button></div></nav></>}</section>
    {isAdmin && <Maintenance token={token} year={year} half={half} onChanged={live.refresh} />}
  </section>;
}
