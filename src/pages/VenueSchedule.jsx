import usePagination from '../usePagination';
import React, { useState, useEffect } from 'react';
import { CalendarDays, ArrowRight, Check, Search } from 'lucide-react';
import { api } from '../services/api';
import { PageHeading, ErrorNotice, EmptyState, Loading, Status, Pagination, Req } from '../components/UI';
import { localInput, dateTime, zone } from '../utils';
export default function VenueSchedule({ token, refreshVersion, onOpenOrder }) {
  const [availability, setAvailability] = useState('all');
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
  const filtered = rows.filter(row => `${row.name} ${row.address}`.toLowerCase().includes(search.toLowerCase()) && (availability === 'all' || (availability === 'free' ? row.available : !row.available)))
    .sort((a, b) => Number(a.available) - Number(b.available));
  const pagination = usePagination(filtered, `${search}|${availability}|${range.from}|${range.to}`);
  const occupied = rows.filter(row => !row.available).length;
  return <><PageHeading eyebrow="Scheduling" title="Venue occupancy" description="Choose a period to see which venues are free and which are booked. Booked venues are listed first." />
    <form className="panel occupancy-controls" onSubmit={apply}><label className="field"><span className="field-label">Period starts<Req /></span><input type="datetime-local" required value={from} onInput={event => setFrom(event.target.value)} /></label><label className="field"><span className="field-label">Period ends<Req /></span><input type="datetime-local" required min={from} value={to} onInput={event => setTo(event.target.value)} /></label><button className="button primary" disabled={busy} type="submit">Check selected period<ArrowRight size={16} /></button><p className="small muted">Local time · {zone()}</p></form>
    <ErrorNotice message={error} onRetry={loaded ? undefined : () => setVersion(value => value + 1)} />
    {busy ? <Loading label="Checking venue occupancy…" /> : loaded && <><div className="occupancy-summary"><div><strong>{rows.length - occupied}</strong><span>Available for the full period</span></div><div><strong>{occupied}</strong><span>Occupied during this period</span></div><div><strong>{rows.length}</strong><span>Venues in the catalogue</span></div></div><div className="section-heading"><div><h2>Rental availability</h2><p className="small muted">{dateTime(range.from)} – {dateTime(range.to)}</p></div><label className="search-group"><span className="search-label">Search venues</span><span className="search-field compact-search"><Search size={16} aria-hidden="true" /><input placeholder="Name or address" value={search} onChange={event => setSearch(event.target.value)} /></span></label></div>
      <div className="run-filters occupancy-filter" role="group" aria-label="Show venues">{[['all', 'All venues', rows.length], ['free', 'Available', rows.length - occupied], ['busy', 'Occupied', occupied]].map(([key, label, count]) => <button key={key} type="button" aria-pressed={availability === key} className={`exec-chip ${availability === key ? 'selected' : ''}`} onClick={() => setAvailability(key)}>{label}<span>{count}</span></button>)}</div>
      <div className="occupancy-list">{pagination.items.map(row => <article className="panel occupancy-card" key={row.id}><div className="occupancy-venue"><div><h3>{row.name}</h3><p className="muted small">{row.address} · Up to {row.capacity} guests{!row.bookings.length && ' · No bookings in this period'}</p></div><span className={`availability ${row.available ? 'free' : 'occupied'}`}>{row.available ? <Check size={15} /> : <CalendarDays size={15} />}{row.available ? 'Available' : 'Occupied'}</span></div>
      {row.bookings.length > 0 && <div className="occupied-periods">{[...row.bookings].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).map(booking => <div key={booking.id}><div><strong>{dateTime(booking.startsAt)} – {dateTime(booking.endsAt)}</strong><span className="short-reference">{booking.id}</span></div><span className="occupied-actions"><Status status={booking.status} />{onOpenOrder && <button type="button" className="button secondary small-button" onClick={() => onOpenOrder(booking.id)}>Open order<ArrowRight size={14} aria-hidden="true" /></button>}</span></div>)}</div>}</article>)}</div>
    <Pagination pagination={pagination} />
      {!filtered.length && <EmptyState title="No venues to display" description={rows.length ? 'Try another venue name or address.' : 'Add venues to the catalogue to see their occupancy.'} />}
      <p className="table-footnote small muted">This is a snapshot of active bookings when checked. A venue marked occupied has at least one overlapping reservation.</p></>}
  </>;
}
