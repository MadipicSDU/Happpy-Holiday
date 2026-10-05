import usePagination from '../usePagination';
import React, { useState, useEffect } from 'react';
import { CalendarDays, ArrowRight, Check, RefreshCw, Search } from 'lucide-react';
import { api } from '../services/api';
import { PageHeading, ErrorNotice, EmptyState, Loading, Status, Pagination } from '../components/UI';
import { localInput, dateTime, zone } from '../utils';
export default function VenueSchedule({ token, refreshVersion }) {
  const [from, setFrom] = useState(() => { const date = new Date(); date.setHours(0, 0, 0, 0); return localInput(date); });
  const [to, setTo] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(0, 0, 0, 0); return localInput(date); });
  const [range, setRange] = useState(() => { const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1); return { from: start.toISOString(), to: end.toISOString() }; });
  const [rows, setRows] = useState([]), [busy, setBusy] = useState(true), [error, setError] = useState(''), [search, setSearch] = useState('');
  const [version, setVersion] = useState(0), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError('');
    api.premises.occupancy(token, range.from, range.to, abort.signal).then(data => { if (!abort.signal.aborted) { setRows(data); setLoaded(true); } })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoaded(false); } }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [token, range, version, refreshVersion]);
  const apply = event => {
    event.preventDefault(); const start = new Date(from), end = new Date(to);
    if (!from || !to || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end - start > 366 * 86400000) { setError('Choose a start and a later end, up to 366 days apart.'); return; }
    setLoaded(false); setRange({ from: start.toISOString(), to: end.toISOString() });
  };
  const filtered = rows.filter(row => `${row.name} ${row.address}`.toLowerCase().includes(search.toLowerCase()));
  const pagination = usePagination(filtered, `${search}|${range.from}|${range.to}`);
  const occupied = rows.filter(row => !row.available).length;
  return <><PageHeading eyebrow="Scheduling" title="Venue occupancy" description="Check which venues are occupied during a selected rental period." action={<button className="button secondary" onClick={() => setVersion(value => value + 1)} disabled={busy}><RefreshCw size={16} />Refresh occupancy</button>} />
    <form className="panel occupancy-controls" onSubmit={apply}><label className="field">Period starts<input type="datetime-local" required value={from} onInput={event => setFrom(event.target.value)} /></label><label className="field">Period ends<input type="datetime-local" required min={from} value={to} onInput={event => setTo(event.target.value)} /></label><button className="button primary" disabled={busy} type="submit">Check occupancy<ArrowRight size={16} /></button><p className="small muted">Local time · {zone()}</p></form>
    <ErrorNotice message={error} onRetry={loaded ? undefined : () => setVersion(value => value + 1)} />
    {busy ? <Loading label="Checking venue occupancy…" /> : loaded && <><div className="occupancy-summary"><div><strong>{rows.length - occupied}</strong><span>Available for the full period</span></div><div><strong>{occupied}</strong><span>Occupied during this period</span></div><div><strong>{rows.length}</strong><span>Venues in the catalogue</span></div></div><div className="section-heading"><div><h2>Rental availability</h2><p className="small muted">{dateTime(range.from)} – {dateTime(range.to)}</p></div><label className="search-field compact-search"><Search size={16} /><input aria-label="Search occupancy venues" placeholder="Search venues" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      <div className="occupancy-list">{pagination.items.map(row => <article className="panel occupancy-card" key={row.id}><div className="occupancy-venue"><div><h3>{row.name}</h3><p className="muted small">{row.address} · Up to {row.capacity} guests</p></div><span className={`availability ${row.available ? 'free' : 'occupied'}`}>{row.available ? <Check size={15} /> : <CalendarDays size={15} />}{row.available ? 'Available' : 'Occupied'}</span></div>
      {row.bookings.length ? <div className="occupied-periods">{[...row.bookings].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).map(booking => <div key={booking.id}><div><strong>{dateTime(booking.startsAt)} – {dateTime(booking.endsAt)}</strong><span className="short-reference">{booking.id}</span></div><Status status={booking.status} /></div>)}</div> : <p className="availability-note">No active bookings overlap the selected period.</p>}</article>)}</div>
    <Pagination pagination={pagination} />
      {!filtered.length && <EmptyState title="No venues to display" description={rows.length ? 'Try another venue name or address.' : 'Add venues to the catalogue to see their occupancy.'} />}
      <p className="table-footnote small muted">This is a snapshot of active bookings when checked. A venue marked occupied has at least one overlapping reservation.</p></>}
  </>;
}
