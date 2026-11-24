import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpRight, Search, Users, CalendarDays, ClipboardList, FileText, Hourglass, Send, GitPullRequestArrow, Building2, Package, User, Radio } from 'lucide-react';
import { api } from '../services/api';
import useLiveData from '../useLiveData';
import usePagination from '../usePagination';
import { localInput, money, categoryName, day, time, when, relative } from '../utils';
import { ServiceIcon } from '../components/ServicePicker';
import { PageHeading, ErrorNotice, Loading, EmptyState, Pagination, Status } from '../components/UI';

// What the manager should do next with an order, how urgent it is, and which dialog tab does it (#7).
export function nextStep(order) {
  if (order.pendingChangeId) return { rank: 1, label: 'Review change', tab: 'changes', icon: GitPullRequestArrow, tone: 'urgent', key: 'changes' };
  if (order.status === 'pending') return { rank: 2, label: 'Create invoice', tab: 'invoice', icon: FileText, tone: 'urgent', key: 'invoice' };
  if (order.status === 'confirmed' && order.paymentConfirmedAt && ['not-planned', 'draft', 'needs-rescheduling'].includes(order.executionState)) return { rank: 3, label: order.executionState === 'draft' ? 'Finalize schedule' : 'Plan schedule', tab: 'execution', icon: CalendarDays, tone: 'todo', key: 'schedule' };
  if (order.executionState === 'finalized') return { rank: 3, label: 'Send to staff', tab: 'execution', icon: Send, tone: 'todo', key: 'schedule' };
  if (order.status === 'awaiting-payment') return { rank: 5, label: 'Waiting for payment', tab: 'invoice', icon: Hourglass, tone: 'wait', key: 'payment' };
  if (order.status === 'change-requested') return { rank: 4, label: 'Call the client about changes', tab: 'details', icon: GitPullRequestArrow, tone: 'wait', key: 'other' };
  if (order.executionState === 'dispatched') return { rank: 6, label: 'Briefs sent', tab: 'execution', icon: Send, tone: 'done', key: 'done' };
  return { rank: 7, label: '', tab: 'details', icon: ArrowUpRight, tone: 'done', key: 'other' };
}
const WORK_STEPS = [['all', 'All orders', 'Everything active'], ['changes', 'Change requests', 'Decide'], ['invoice', 'Invoices to create', 'Create & send'], ['schedule', 'Schedules to plan', 'Plan & send'], ['payment', 'Waiting for payment', 'Client pays'], ['done', 'On track', 'Nothing to do']];
const stepKey = order => order.step.key === 'other' ? 'done' : order.step.key;
const FILTERS = [['all', 'All'], ['changes', 'Change requests'], ['invoice', 'Invoices to create'], ['schedule', 'Schedules to plan'], ['payment', 'Waiting for payment']];
const PRESETS = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next 7 days'], ['custom', 'Custom']];
const presetRange = key => { const start = new Date(); start.setHours(0, 0, 0, 0); if (key === 'tomorrow') start.setDate(start.getDate() + 1); const end = new Date(start); end.setDate(end.getDate() + (key === 'week' ? 7 : 1)); return { from: start.toISOString(), to: end.toISOString() }; };

// A horizontal track for the chosen period with labelled blocks (#11, #13).
function Track({ range, blocks }) {
  const start = new Date(range.from).getTime(), end = new Date(range.to).getTime(), span = end - start, multi = span > 36 * 3600000;
  const step = multi ? 86400000 : 3 * 3600000, ticks = []; for (let t = start; t <= end; t += step) ticks.push(t);
  const now = Date.now(), pos = value => Math.min(100, Math.max(0, (new Date(value).getTime() - start) / span * 100));
  return <div className="track"><div className="track-ticks">{ticks.map(t => <span key={t} style={{ left: `${(t - start) / span * 100}%` }}>{multi ? day(t).split(',')[0] + ' ' + new Date(t).getDate() : time(t)}</span>)}</div>
    <div className="track-bar">{ticks.map(t => <i key={t} style={{ left: `${(t - start) / span * 100}%` }} />)}{now > start && now < end && <b className="track-now" style={{ left: `${pos(now)}%` }} />}
      {blocks.map(block => <span key={block.id} className={`track-block tone-${block.tone || 'busy'}`} style={{ left: `${pos(block.startsAt)}%`, width: `${Math.max(pos(block.endsAt) - pos(block.startsAt), 1.5)}%` }} title={`${block.label} · ${when(block)}`}>{block.label}</span>)}</div></div>;
}

// Variant B: one shared time axis for all rows — a Gantt chart of venues or people (#1, #11, #13).
function Gantt({ range, rows, onOpen }) {
  const start = new Date(range.from).getTime(), end = new Date(range.to).getTime(), span = end - start, multi = span > 36 * 3600000;
  const step = multi ? 86400000 : 2 * 3600000, ticks = []; for (let t = start; t < end; t += step) ticks.push(t);
  const now = Date.now(), pos = value => Math.min(100, Math.max(0, (new Date(value).getTime() - start) / span * 100));
  return <div className="gantt">
    <div className="gantt-head"><span /><div className="gantt-axis">{ticks.map(t => <span key={t} style={{ left: `${(t - start) / span * 100}%` }}>{multi ? new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : time(t)}</span>)}</div><span /></div>
    {rows.map(row => <div className={`gantt-row is-${row.state}`} key={row.id}>
      <div className="gantt-name">{row.avatar && <span className="avatar-dot">{row.avatar}</span>}<span><strong>{row.name}</strong><small>{row.sub}</small></span></div>
      <div className="gantt-track">{ticks.map(t => <i key={t} style={{ left: `${(t - start) / span * 100}%` }} />)}{now > start && now < end && <b className="track-now" style={{ left: `${pos(now)}%` }} />}
        {row.blocks.map(block => <button type="button" key={block.id} className={`gantt-bar tone-${block.tone || 'busy'}`} style={{ left: `${pos(block.startsAt)}%`, width: `${Math.max(pos(block.endsAt) - pos(block.startsAt), 1.2)}%` }} title={`${block.label} · ${when(block)}`} onClick={() => block.orderId && onOpen(block.orderId)}>{block.label}</button>)}</div>
      <span className={`state-pill is-${row.state}`}>{row.stateLabel}</span>
    </div>)}
  </div>;
}

export default function ManagerDashboard({ token, refreshVersion, onOpenOrder, isAdmin }) {
  const [preset, setPreset] = useState('today'), [range, setRange] = useState(() => presetRange('today')), [offset, setOffset] = useState(0), [span, setSpan] = useState('day'), [clientFilter, setClientFilter] = useState('');
  const shift = (nextOffset, nextSpan = span) => { const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + nextOffset); const end = new Date(start); end.setDate(end.getDate() + (nextSpan === 'week' ? 7 : 1)); setOffset(nextOffset); setSpan(nextSpan); setRange({ from: start.toISOString(), to: end.toISOString() }); };
  const [from, setFrom] = useState(() => localInput(new Date(presetRange('today').from))), [to, setTo] = useState(() => localInput(new Date(presetRange('today').to)));
  const [tab, setTab] = useState('worklist'), [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [group, setGroup] = useState('order'), [sort, setSort] = useState('urgent');
  const [venueFilter, setVenueFilter] = useState('all'), [venueSort, setVenueSort] = useState('busy'), [serviceFilter, setServiceFilter] = useState('all'), [staffFilter, setStaffFilter] = useState('all'), [rangeError, setRangeError] = useState('');
  const { data, error, busy } = useLiveData(signal => api.management.dashboard(token, range.from, range.to, signal), [token, refreshVersion, range.from, range.to]);
  const choosePreset = key => { setPreset(key); if (key !== 'custom') { setRangeError(''); setRange(presetRange(key)); } };
  const apply = event => {
    event.preventDefault(); const start = new Date(from), end = new Date(to);
    if (!from || !to || end <= start || end - start > 31 * 86400000) { setRangeError('Choose a start and a later end, up to 31 days apart.'); return; }
    setRangeError(''); setRange({ from: start.toISOString(), to: end.toISOString() });
  };
  const q = search.toLowerCase(), matches = text => text.toLowerCase().includes(q);
  const orderById = useMemo(() => new Map((data?.worklist || []).map(order => [order.id, order])), [data]);
  const now = Date.now();

  // worklist: most urgent first by default; ties by event date (#1, #7)
  const work = (data?.worklist || []).map(order => ({ ...order, step: nextStep(order) }))
    .filter(order => matches(`${order.client} ${order.venue}`) && (!clientFilter || order.client === clientFilter))
    .sort((a, b) => sort === 'value' ? b.totalAmount - a.totalAmount : sort === 'date' ? new Date(a.startsAt) - new Date(b.startsAt) : a.step.rank - b.step.rank || new Date(a.startsAt) - new Date(b.startsAt));
  const groups = group === 'client' ? [...work.reduce((map, order) => map.set(order.client, [...(map.get(order.client) || []), order]), new Map())] : [[null, work]];

  // venues: busy / booked later / free, filter + sort (#1, #11)
  const venues = (data?.occupancy || []).map(venue => { const live = venue.bookings.find(b => new Date(b.startsAt) <= now && new Date(b.endsAt) > now); const next = venue.bookings.filter(b => new Date(b.endsAt) > now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
    return { ...venue, live, next, state: live ? 'now' : venue.bookings.length ? 'booked' : 'free' }; });
  const venueCounts = { all: venues.length, now: venues.filter(v => v.state === 'now').length, booked: venues.filter(v => v.state !== 'free').length, free: venues.filter(v => v.state === 'free').length };
  const venueRows = venues.filter(v => matches(`${v.name} ${v.address}`) && (venueFilter === 'all' || (venueFilter === 'booked' ? v.state !== 'free' : v.state === venueFilter)))
    .sort((a, b) => venueSort === 'name' ? a.name.localeCompare(b.name) : venueSort === 'next' ? (a.next ? new Date(a.next.startsAt) : Infinity) - (b.next ? new Date(b.next.startsAt) : Infinity) : ({ now: 0, booked: 1, free: 2 }[a.state] - { now: 0, booked: 1, free: 2 }[b.state]) || b.bookings.length - a.bookings.length || a.name.localeCompare(b.name));
  // services: how full each one is at peak (#12)
  const services = (data?.services || []).map(s => ({ ...s, load: s.concurrentCapacity ? s.reservedUnits / s.concurrentCapacity : null, state: s.concurrentCapacity == null ? 'unlimited' : s.availableUnits === 0 ? 'full' : s.reservedUnits / s.concurrentCapacity >= .7 ? 'almost' : 'free' }));
  const serviceRows = services.filter(s => matches(`${s.name} ${categoryName(s.category)}`) && (serviceFilter === 'all' || s.state === serviceFilter)).sort((a, b) => (b.load ?? -1) - (a.load ?? -1) || b.reservedUnits - a.reservedUnits || a.name.localeCompare(b.name));
  const staffRows = (data?.staff || []).filter(p => matches(p.name) && (staffFilter === 'all' || (staffFilter === 'free' ? p.available : !p.available))).sort((a, b) => a.available - b.available || a.name.localeCompare(b.name));
  const workRows = filter === 'all' ? work : work.filter(order => stepKey(order) === filter);
  const rows = tab === 'worklist' ? workRows : tab === 'venues' ? venueRows : tab === 'services' ? serviceRows : staffRows;
  const pagination = usePagination(rows, `${tab}|${search}|${filter}|${group}|${sort}|${venueFilter}|${venueSort}|${serviceFilter}|${staffFilter}|${range.from}|${range.to}`, 10);

  const tiles = data && [
    ['changes', 'Change requests', (data.worklist || []).filter(o => nextStep(o).key === 'changes').length, GitPullRequestArrow, () => { setTab('worklist'); setFilter('changes'); }],
    ['invoice', 'Invoices to create', (data.worklist || []).filter(o => nextStep(o).key === 'invoice').length, FileText, () => { setTab('worklist'); setFilter('invoice'); }],
    ['schedule', 'Schedules to plan', (data.worklist || []).filter(o => nextStep(o).key === 'schedule').length, CalendarDays, () => { setTab('worklist'); setFilter('schedule'); }],
    ['payment', 'Waiting for payment', (data.worklist || []).filter(o => nextStep(o).key === 'payment').length, Hourglass, () => { setTab('worklist'); setFilter('payment'); }],
    ['all', 'Active orders', data.counts.activeOrders, ClipboardList, () => { setTab('worklist'); setFilter('all'); setGroup('order'); }],
    ['clients', 'Assigned clients', data.counts.assignedClients, Users, () => { setTab('worklist'); setFilter('all'); setGroup('client'); }],
  ];
  const activeTile = tab !== 'worklist' ? null : group === 'client' ? 'clients' : filter;
  const periodLabel = preset === 'custom' ? `${day(range.from)} – ${day(range.to)}` : PRESETS.find(([key]) => key === preset)[1];

  return <><PageHeading eyebrow="Operations" title={isAdmin ? 'Operations dashboard' : 'Your manager dashboard'} description="What needs you now, and how venues, services and staff are loaded." action={data && <span className="live-pill"><Radio size={14} />{busy ? 'Updating…' : `Live · updated ${time(data.checkedAt)}`}</span>} />
    <ErrorNotice message={rangeError || error} />
    {!data ? busy ? <Loading label="Loading live operations…" /> : <EmptyState title="Operations are unavailable" description="Try refreshing the dashboard." /> : <>

      <div className="dash-tabs" role="tablist" aria-label="Operations view">{[['worklist', 'Worklist', ClipboardList, work.length], ['venues', 'Venues', Building2, `${venueCounts.booked}/${venueCounts.all} booked`], ['services', 'Services', Package, `${services.filter(s => s.state === 'full').length} full`], ['staff', 'Staff', User, `${(data.staff || []).filter(p => !p.available).length} assigned`]].map(([key, label, Icon, note]) => <button key={key} role="tab" aria-selected={tab === key} className={`dash-tab ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setSearch(''); }}><Icon size={16} />{label}<span>{note}</span></button>)}</div>

      {tab !== 'worklist' && <div className="day-nav"><button type="button" className="icon-button" aria-label="Previous" onClick={() => shift(offset - (span === 'week' ? 7 : 1))}><ChevronLeft size={18} /></button><strong>{offset === 0 && span === 'day' ? 'Today' : offset === 1 && span === 'day' ? 'Tomorrow' : span === 'week' ? `${day(range.from)} – ${day(new Date(new Date(range.to) - 1))}` : day(range.from)}</strong><button type="button" className="icon-button" aria-label="Next" onClick={() => shift(offset + (span === 'week' ? 7 : 1))}><ChevronRight size={18} /></button>{offset !== 0 && <button type="button" className="text-button" onClick={() => shift(0)}>Back to today</button>}<div className="segmented small">{[['day', 'Day'], ['week', 'Week']].map(([key, label]) => <button type="button" key={key} aria-pressed={span === key} className={span === key ? 'selected' : ''} onClick={() => shift(offset, key)}>{label}</button>)}</div></div>}

      <div className="dash-toolbar"><label className="search-group"><span className="search-label">{tab === 'worklist' ? 'Search orders' : `Search ${tab}`}</span><span className="search-field"><Search size={16} aria-hidden="true" /><input placeholder={tab === 'worklist' ? 'Search client or venue' : `Search ${tab}`} value={search} onChange={event => setSearch(event.target.value)} /></span></label>
        {tab === 'worklist' && <div className="toolbar-end"><select aria-label="Client" value={clientFilter} onChange={event => setClientFilter(event.target.value)}><option value="">All assigned clients ({new Set((data.worklist || []).map(o => o.client)).size})</option>{[...new Set((data.worklist || []).map(o => o.client))].sort().map(name => <option key={name} value={name}>{name} · {(data.worklist || []).filter(o => o.client === name).length} orders</option>)}</select>
          <select aria-label="Sort cards" value={sort} onChange={event => setSort(event.target.value)}><option value="urgent">Soonest event first</option><option value="value">Order value</option></select></div>}
        {tab === 'venues' && <><div className="chip-row">{[['all', 'All'], ['now', 'Busy now'], ['booked', 'Booked'], ['free', 'Free']].map(([key, label]) => <button type="button" key={key} className={`chip ${venueFilter === key ? 'selected' : ''}`} aria-pressed={venueFilter === key} onClick={() => setVenueFilter(key)}>{label}<span>{venueCounts[key]}</span></button>)}</div>
          <select aria-label="Sort venues" value={venueSort} onChange={event => setVenueSort(event.target.value)}><option value="busy">Booked first</option><option value="next">Next booking soonest</option><option value="name">Name A–Z</option></select></>}
        {tab === 'services' && <div className="chip-row">{[['all', 'All'], ['full', 'Fully booked'], ['almost', 'Almost full'], ['free', 'Has room'], ['unlimited', 'No limit set']].map(([key, label]) => <button type="button" key={key} className={`chip ${serviceFilter === key ? 'selected' : ''}`} aria-pressed={serviceFilter === key} onClick={() => setServiceFilter(key)}>{label}<span>{key === 'all' ? services.length : services.filter(s => s.state === key).length}</span></button>)}</div>}
        {tab === 'staff' && <div className="chip-row">{[['all', 'All'], ['assigned', 'Assigned'], ['free', 'Free']].map(([key, label]) => <button type="button" key={key} className={`chip ${staffFilter === key ? 'selected' : ''}`} aria-pressed={staffFilter === key} onClick={() => setStaffFilter(key)}>{label}<span>{(data.staff || []).filter(p => key === 'all' || (key === 'free' ? p.available : !p.available)).length}</span></button>)}</div>}
      </div>

      {/* Worklist: one queue, most urgent first. Step tabs show every count (zeros included) without empty columns. */}
      {tab === 'worklist' && <>
        <div className="work-steps" role="group" aria-label="Show orders that need">{WORK_STEPS.map(([key, label, hint]) => { const count = key === 'all' ? work.length : work.filter(order => stepKey(order) === key).length;
          return <button key={key} type="button" aria-pressed={filter === key} className={`work-step is-${key} ${filter === key ? 'selected' : ''} ${count ? '' : 'is-zero'}`} onClick={() => setFilter(key)}><strong>{count}</strong><span>{label}</span><small>{hint}</small></button>; })}</div>
        <div className="table-card work-table"><table><caption className="sr-only">Orders and their next step</caption>
          <thead><tr><th>Event date</th><th>Client & venue</th><th>Details</th><th>Next step</th></tr></thead>
          <tbody>{pagination.items.map(order => { const Icon = order.step.icon, act = order.step.tone === 'urgent' || order.step.tone === 'todo';
            return <tr key={order.id} className={`tone-${order.step.tone}`}>
              <td className="work-date"><strong>{day(order.startsAt)}</strong><span className="cell-secondary">{relative(order.startsAt)}</span></td>
              <td><strong>{order.client}</strong><span className="cell-secondary">{order.venue}</span></td>
              <td className="work-details">{time(order.startsAt)}–{time(order.endsAt)} · {order.guests} guests<span className="cell-secondary">{money(order.totalAmount)}</span></td>
              <td className="work-action">{act ? <button className="button primary small-button" onClick={() => onOpenOrder(order.id, order.step.tab)}><Icon size={14} aria-hidden="true" />{order.step.label}</button>
                : <button className="button secondary small-button" onClick={() => onOpenOrder(order.id, order.step.tab)}>{order.step.label ? <><Icon size={14} aria-hidden="true" />{order.step.label}</> : 'Open order'}</button>}</td>
            </tr>; })}</tbody></table></div>
      </>}

      {tab === 'venues' && <Gantt range={range} onOpen={id => onOpenOrder(id)} rows={pagination.items.map(venue => ({ id: venue.id, name: venue.name, sub: venue.address, state: venue.state, stateLabel: venue.state === 'now' ? 'Busy now' : venue.state === 'booked' ? `Booked ${venue.next ? time(venue.next.startsAt) : ''}` : 'Free',
        blocks: venue.bookings.map(b => { const o = orderById.get(b.id); return { ...b, orderId: o?.id, label: o ? `${o.client} · ${time(b.startsAt)}–${time(b.endsAt)}` : `${time(b.startsAt)}–${time(b.endsAt)}`, tone: venue.live?.id === b.id ? 'now' : 'busy' }; }) }))} />}

      {tab === 'services' && <div className="capacity-list">{pagination.items.map(service => <article className="cap-row" key={service.id}>
        <div className="cap-name"><ServiceIcon category={service.category} /><span><strong>{service.name}</strong><small>{categoryName(service.category)}</small></span></div>
        {service.concurrentCapacity == null ? <div className="cap-meter is-unlimited"><span>{service.reservedUnits} booked · no limit set</span></div>
          : <div className={`cap-meter is-${service.state}`}><div className="cap-bar"><i style={{ width: `${Math.min(100, service.load * 100)}%` }} /></div><span>{service.reservedUnits} of {service.concurrentCapacity} booked at peak</span></div>}
        <span className={`state-pill is-${service.state}`}>{{ full: 'Fully booked', almost: 'Almost full', free: `${service.availableUnits} free`, unlimited: 'No limit' }[service.state]}</span>
      </article>)}</div>}

      {tab === 'staff' && <Gantt range={range} onOpen={id => onOpenOrder(id, 'execution')} rows={pagination.items.map(person => ({ id: person.id, name: person.name, avatar: person.name.split(' ').map(part => part[0]).join('').slice(0, 2), sub: person.assignments.length ? `${person.assignments.length} ${person.assignments.length === 1 ? 'activity' : 'activities'}` : 'No activities', state: person.available ? 'free' : 'booked', stateLabel: person.available ? 'Free' : 'Assigned',
        blocks: person.assignments.map(task => ({ ...task, orderId: task.orderId, label: `${task.activity}${orderById.get(task.orderId) ? ` · ${orderById.get(task.orderId).venue}` : ''}` })) }))} />}

      {tab !== 'worklist' && <Pagination pagination={pagination} />}
      {!rows.length && <EmptyState title="Nothing here" description={tab === 'worklist' ? 'No orders match this filter — nice.' : 'Try another filter or period.'} />}
    </>}
  </>;
}
