import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Send, Pencil, Check, AlertTriangle, Lock, MessageSquare, Search } from 'lucide-react';
import { api } from '../services/api';
import { day, time, hours } from '../utils';
import { briefNames, executionInput } from '../execution';
import { ErrorNotice, Loading, Pagination } from './UI';
import usePagination from '../usePagination';

const overlaps = (a, b) => new Date(a.startsAt) < new Date(b.endsAt) && new Date(b.startsAt) < new Date(a.endsAt);

// One lane per person, bars for each activity across the rental period (#15): overlaps and gaps are visible at a glance.
export function ExecTimeline({ order, tasks, staff }) {
  const start = new Date(order.startsAt).getTime(), end = new Date(order.endsAt).getTime(), span = Math.max(end - start, 1);
  const step = span <= 6 * 3600000 ? 3600000 : span <= 14 * 3600000 ? 2 * 3600000 : 4 * 3600000;
  const ticks = []; for (let t = Math.ceil(start / step) * step; t <= end; t += step) ticks.push(t);
  // one row per person; overlapping activities of the same person (or unassigned ones) get extra rows so no bar hides another
  const people = [...new Set(tasks.map(task => task.staffId || ''))].sort((a, b) => (a === '') - (b === ''));
  const lanes = people.flatMap(person => { const rows = []; tasks.filter(task => (task.staffId || '') === person).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .forEach(task => { const row = rows.find(list => !list.some(other => overlaps(task, other))); row ? row.push(task) : rows.push([task]); });
    return rows.map((list, index) => ({ person, list, first: index === 0 })); });
  const name = id => id ? staff.find(person => person.id === id)?.name || 'Staff member' : 'Unassigned';
  const pos = value => Math.min(100, Math.max(0, (new Date(value).getTime() - start) / span * 100));
  return <div className="exec-timeline" aria-label="Day timeline">
    <div className="exec-timeline-axis"><span />{<div>{ticks.map(t => <span key={t} style={{ left: `${(t - start) / span * 100}%` }}>{time(t)}</span>)}</div>}</div>
    {lanes.map((lane, index) => <div className={`exec-lane ${lane.person ? '' : 'is-unassigned'}`} key={index}><span className="exec-lane-name">{lane.first ? name(lane.person) : ''}</span><div className="exec-lane-track">{ticks.map(t => <i key={t} style={{ left: `${(t - start) / span * 100}%` }} />)}
      {lane.list.map(task => { const clash = lane.person && tasks.some(other => other !== task && other.staffId === lane.person && overlaps(task, other));
        return <span key={task.localId || task.id} className={`exec-bar ${clash ? 'is-clash' : ''}`} style={{ left: `${pos(task.startsAt)}%`, width: `${Math.max(pos(task.endsAt) - pos(task.startsAt), 2)}%` }} title={`${task.activity} · ${time(task.startsAt)}–${time(task.endsAt)}`}>{task.activity}</span>; })}</div></div>)}
  </div>;
}

const PAGE = 20;
const pad = value => String(value).padStart(2, '0');
const localIso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00.000`;
const hhmm = value => (value || '').slice(11, 16);
const sameTasks = (a, b) => JSON.stringify(a.map(({ activity, staffId, startsAt, endsAt, instructions, serviceId }) => [activity, staffId, startsAt, endsAt, instructions, serviceId])) === JSON.stringify(b.map(({ activity, staffId, startsAt, endsAt, instructions, serviceId }) => [activity, staffId, startsAt, endsAt, instructions, serviceId]));

// Simple run of show: one editable row per activity (time · what · who). Booked services are pre-filled,
// times are entered as clock times only, and a single "Send to staff" button saves, locks and sends the plan.
// footerNode (optional): a DOM node in the page footer; when given, the plan actions render there instead of inline.
export default function ExecutionPanel({ order, token, onRefresh, footerNode = null, refreshVersion }) {
  const [plan, setPlan] = useState(null), [staff, setStaff] = useState([]), [busyStaff, setBusyStaff] = useState([]);
  const [tasks, setTasks] = useState([]), [baseline, setBaseline] = useState({ tasks: [], notes: '' }), [notes, setNotes] = useState('');
  const [revising, setRevising] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const [noteOpen, setNoteOpen] = useState(null), [confirmSend, setConfirmSend] = useState(false), [filter, setFilter] = useState('all');
  const [search, setSearch] = useState(''), [confirmDelete, setConfirmDelete] = useState(null);
  const listRef = useRef(null);
  const ready = order.status === 'confirmed' && order.paymentConfirmedAt && order.paidAmount >= order.totalAmount;
  const orderStart = new Date(order.startsAt), orderEnd = new Date(order.endsAt);
  const longEvent = orderEnd - orderStart > 24 * 3600000;
  const days = []; for (let d = new Date(orderStart.getFullYear(), orderStart.getMonth(), orderStart.getDate()); d < orderEnd; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(d);

  // clock time → full date inside the rental: before the start time means "after midnight" (next day)
  const atTime = (value, dayIndex, notBefore) => {
    const [h, m] = value.split(':').map(Number), base = days[Math.max(0, dayIndex)] || days[0];
    let date = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
    if (!longEvent && date < orderStart) date = new Date(date.getTime() + 86400000);
    if (notBefore && date <= notBefore) date = new Date(date.getTime() + 86400000);
    return date;
  };
  const dayIndexOf = value => Math.max(0, days.findIndex(d => new Date(value).toDateString() === d.toDateString()));
  const blank = (start, extra = {}) => { const s = start >= orderEnd ? orderStart : start, e = new Date(Math.min(s.getTime() + 3600000, orderEnd.getTime()));
    return { localId: crypto.randomUUID(), activity: '', serviceId: '', staffId: '', startsAt: localIso(s), endsAt: localIso(e), instructions: '', ...extra }; };
  const fromService = service => blank(orderStart, { activity: service.name, serviceId: service.id, endsAt: localIso(orderEnd) });
  const populate = data => {
    const next = data ? data.tasks.map(task => ({ ...task, localId: task.id, serviceId: task.serviceId || '', staffId: task.staffId || '', instructions: task.instructions || '', startsAt: executionInput(task.startsAt), endsAt: executionInput(task.endsAt, 'end') }))
      : order.pricing.services.length ? order.pricing.services.map(fromService) : [blank(orderStart, { activity: 'Venue preparation', endsAt: localIso(orderEnd) })];
    next.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    setTasks(next); setNotes(data?.notes || ''); setBaseline({ tasks: next, notes: data?.notes || '' }); setNoteOpen(null);
  };
  useEffect(() => {
    const abort = new AbortController(); setLoading(true);
    Promise.all([api.execution.get(token, order.id, abort.signal).catch(error => { if (error.status === 404) return null; throw error; }), api.management.operators(token, abort.signal),
      api.management.dashboard(token, order.startsAt, order.endsAt, abort.signal).catch(() => null)])
      .then(([data, operators, board]) => { if (!abort.signal.aborted) { setPlan(data); setStaff(operators); setBusyStaff((board?.staff || []).flatMap(person => person.assignments.filter(task => task.orderId !== order.id))); populate(data); setRevising(false); setError(''); } })
      .catch(error => { if (!abort.signal.aborted) setError(error.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [token, order.id, order.revision, order.executionState, version, refreshVersion]);

  const sent = plan?.state === 'dispatched' && !revising, finalized = plan?.state === 'finalized' && !revising, editable = !sent && !finalized;
  const stageIndex = sent ? 2 : finalized ? 1 : 0;
  const dirty = !sameTasks(tasks, baseline.tasks) || notes !== baseline.notes;
  // brief progress refreshes quietly once the plan has been sent
  useEffect(() => { if (!sent) return undefined; const timer = setInterval(() => { if (!busy && !document.hidden) setVersion(value => value + 1); }, 30000); return () => clearInterval(timer); }, [sent, busy]);

  const update = (id, patch) => setTasks(previous => previous.map(task => task.localId === id ? { ...task, ...patch } : task));
  const setStart = (task, value, dayIndex = dayIndexOf(task.startsAt)) => { if (!value) return; const start = atTime(value, dayIndex), length = new Date(task.endsAt) - new Date(task.startsAt);
    update(task.localId, { startsAt: localIso(start), endsAt: localIso(new Date(Math.min(start.getTime() + Math.max(length, 900000), orderEnd.getTime()))) }); };
  const setEnd = (task, value) => { if (!value) return; update(task.localId, { endsAt: localIso(atTime(value, dayIndexOf(task.startsAt), new Date(task.startsAt))) }); };
  const remove = task => { setTasks(previous => previous.filter(item => item !== task)); setConfirmDelete(null); };
  // the trash button first asks; focus lands on the safe choice (Keep)
  const askDelete = task => { setConfirmDelete(task.localId); setNoteOpen(null); requestAnimationFrame(() => document.getElementById(`run-keep-${task.localId}`)?.focus()); };
  const add = (extra = {}) => {
    if (tasks.length >= 100) return;
    const lastEnd = tasks.reduce((latest, task) => { const end = new Date(task.endsAt); return end > latest && end < orderEnd ? end : latest; }, orderStart);
    const task = blank(lastEnd, extra); setTasks(previous => [...previous, task]); setFilter('all');
    requestAnimationFrame(() => { pagination.setPage(Math.ceil((tasks.length + 1) / PAGE)); requestAnimationFrame(() => document.getElementById(`run-name-${task.localId}`)?.focus()); });
  };

  // Problems are shown on the rows themselves; this summary only explains why "Send" is not available yet.
  const clashWith = task => task.staffId ? tasks.find(other => other !== task && other.staffId === task.staffId && overlaps(task, other)) || busyStaff.find(other => other.staffId === task.staffId && overlaps(task, other)) : null;
  const unnamed = tasks.filter(task => task.activity.trim().length < 2), unassigned = tasks.filter(task => !task.staffId), clashes = tasks.filter(clashWith);
  const badTime = tasks.filter(task => new Date(task.endsAt) <= new Date(task.startsAt) || new Date(task.startsAt) < orderStart || new Date(task.endsAt) > orderEnd);
  const missing = order.pricing.services.filter(service => !tasks.some(task => task.serviceId === service.id));
  const problems = [
    !tasks.length && 'Add at least one activity.',
    unnamed.length && `Name ${unnamed.length === 1 ? '1 activity' : `${unnamed.length} activities`}.`,
    badTime.length && `Fix the time of ${badTime.length === 1 ? '1 activity' : `${badTime.length} activities`} (must be within ${time(order.startsAt)}–${time(order.endsAt)}).`,
    unassigned.length && `Pick a person for ${unassigned.length === 1 ? '1 activity' : `${unassigned.length} activities`}.`,
    clashes.length && `${clashes.length === 1 ? '1 activity overlaps' : `${clashes.length} activities overlap`} for the same person.`,
    missing.length && `Booked service missing: ${missing.map(service => service.name).join(', ')}.`,
  ].filter(Boolean);
  const recipients = [...new Set(tasks.map(task => task.staffId).filter(Boolean))];
  const personName = id => staff.find(person => person.id === id)?.name || tasks.find(task => task.staffId === id)?.staffName || 'Staff member';
  const briefs = plan?.briefs?.filter(brief => !brief.supersededAt) || [];

  const payload = () => ({ expectedVersion: plan?.version ?? null, notes, tasks: tasks.map(task => ({ activity: task.activity.trim(), serviceId: task.serviceId || null, staffId: task.staffId || null,
    startsAt: new Date(task.startsAt).toISOString(), endsAt: new Date(task.endsAt).toISOString(), instructions: task.instructions })) });
  const run = async (label, steps) => {
    if (busy) return; setBusy(label); setError('');
    try { let data = plan; for (const step of steps) data = await step(data); setPlan(data); populate(data); setRevising(false); setConfirmSend(false); onRefresh?.(); }
    catch (error) { setError(error.message); setConfirmSend(false); } finally { setBusy(''); }
  };
  const saveStep = () => api.execution.save(token, order.id, payload());
  const save = () => run('save', [saveStep]);
  // Story 11.1: the manager finalizes the schedule (locks it) as its own step; dispatching briefs is story 11.2.
  const finalize = () => run('finalize', [...(dirty || !plan || revising ? [saveStep] : []), data => data.state === 'draft' ? api.execution.finalize(token, order.id, data.version) : data]);
  const send = () => run('send', [data => api.execution.dispatch(token, order.id, data.version)]);
  const actions = content => footerNode ? createPortal(content, footerNode) : <div className="workflow-actions">{content}</div>;

  const query = search.trim().toLowerCase();
  const shown = tasks.filter(task => filter === 'all' || (filter === 'none' ? !task.staffId : filter === 'clash' ? clashWith(task) : task.staffId === filter))
    .filter(task => !query || `${task.activity} ${task.instructions || ''} ${task.staffId ? personName(task.staffId) : ''}`.toLowerCase().includes(query));
  const pagination = usePagination(shown, `${filter}|${query}`, PAGE);
  const chips = [{ id: 'all', label: 'All', count: tasks.length }, { id: 'none', label: 'Need a person', count: unassigned.length, tone: 'warn' }, ...(clashes.length ? [{ id: 'clash', label: 'Overlaps', count: clashes.length, tone: 'danger' }] : []),
    ...staff.map(person => ({ id: person.id, label: person.name.split(' ')[0], title: person.name, count: tasks.filter(task => task.staffId === person.id).length }))];

  return <section className="workflow-panel run-panel">
    <header className="run-head"><div><h3>Event-day plan</h3><p className="small muted">{day(order.startsAt)} · {time(order.startsAt)}–{time(order.endsAt)} · {hours(order)} h</p></div>
      <span className={`run-state ${sent ? 'is-sent' : plan ? 'is-saved' : ''}`}>{sent ? <><Send size={14} aria-hidden="true" />Sent to staff</> : finalized ? <><Lock size={14} aria-hidden="true" />Finalized · not sent yet</> : dirty ? 'Unsaved changes' : plan ? <><Check size={14} aria-hidden="true" />Draft saved</> : 'Not started'}</span></header>
    {ready && <ol className="run-stage" aria-label="Schedule status">{['Draft', 'Finalized', 'Sent to staff'].map((label, index) => <li key={label} className={index < stageIndex ? 'done' : index === stageIndex ? 'current' : ''} aria-current={index === stageIndex ? 'step' : undefined}>{index < stageIndex ? '✓ ' : ''}{label}</li>)}</ol>}
    <ErrorNotice message={error} />
    {!ready ? <div className="empty-line"><Lock size={16} />The plan opens once the client's payment covers this booking.</div> : loading ? <Loading label="Loading plan…" /> : <>

      {editable && <ol className="run-guide" aria-label="How to plan the event day"><li><span>1</span>Check the time of each activity</li><li><span>2</span>Pick who does it</li><li><span>3</span>Press <strong>Finalize schedule</strong>, then <strong>Send to staff</strong></li></ol>}
      {sent && <div className="run-sent"><div className="brief-progress">{['sent', 'acknowledged', 'in-progress', 'completed'].map(status => <span key={status} className={`brief-count is-${status}`}><strong>{briefs.filter(brief => brief.status === status).length}</strong>{briefNames[status]}</span>)}</div>
        <p className="small muted">Staff see these activities in their workspace. To change something, press <strong>Change plan</strong> — the sent briefs are withdrawn and you send the new plan again.</p></div>}
      {confirmSend && <div className="exec-confirm" role="alertdialog" aria-label="Send the plan"><Send size={22} aria-hidden="true" /><div><strong>Send the plan to {recipients.length} {recipients.length === 1 ? 'person' : 'people'}?</strong>
        <ul>{recipients.map(id => <li key={id}>{personName(id)} · {tasks.filter(task => task.staffId === id).length} {tasks.filter(task => task.staffId === id).length === 1 ? 'activity' : 'activities'}</li>)}</ul><p className="small muted">They will see it in their workspace and confirm each activity.</p></div></div>}

      {tasks.length > 0 && <div className="run-toolbar">
        <label className="search-group"><span className="search-label">Search</span><span className="search-field"><Search size={16} aria-hidden="true" /><input type="search" value={search} placeholder="Activity, note or person" onChange={event => setSearch(event.target.value)} /></span></label>
        <div className="run-filter-group"><span className="search-label" id="run-filter-label">Show</span><div className="run-filters" role="group" aria-labelledby="run-filter-label">{chips.filter(chip => chip.count > 0 || chip.id === 'all' || chip.id === filter).map(chip => <button key={chip.id} type="button" title={chip.title} aria-pressed={filter === chip.id} className={`exec-chip ${filter === chip.id ? 'selected' : ''} ${chip.tone ? `tone-${chip.tone}` : ''}`} onClick={() => setFilter(chip.id)}>{chip.label}<span>{chip.count}</span></button>)}</div></div>
        {(query || filter !== 'all') && <p className="run-result small muted" role="status">Showing {shown.length} of {tasks.length} · <button type="button" className="text-button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear</button></p>}
      </div>}

      <div className="run-list-head" aria-hidden="true"><span>Time</span><span>Activity</span><span>Who</span></div>
      <ul className="run-list" ref={listRef}>{pagination.items.map(task => {
        const clash = clashWith(task), service = order.pricing.services.find(item => item.id === task.serviceId), brief = plan?.briefs?.find(item => item.taskId === task.id && !item.supersededAt);
        const wrongTime = badTime.includes(task), noteShown = noteOpen === task.localId;
        return <li key={task.localId} className={`run-row ${confirmDelete === task.localId ? 'is-deleting' : ''} ${clash ? 'is-clash' : !task.staffId ? 'is-warn' : ''}`}>
          <div className="run-time">{editable ? <>
            {longEvent && <select aria-label={`Day of ${task.activity || 'activity'}`} value={dayIndexOf(task.startsAt)} onChange={event => setStart(task, hhmm(task.startsAt), Number(event.target.value))}>{days.map((d, index) => <option key={index} value={index}>{day(d)}</option>)}</select>}
            <input type="time" step={900} aria-label={`Starts — ${task.activity || 'activity'}`} aria-invalid={wrongTime || undefined} value={hhmm(task.startsAt)} onChange={event => setStart(task, event.target.value)} />
            <span aria-hidden="true">–</span>
            <input type="time" step={900} aria-label={`Ends — ${task.activity || 'activity'}`} aria-invalid={wrongTime || undefined} value={hhmm(task.endsAt)} onChange={event => setEnd(task, event.target.value)} /></>
            : <strong>{longEvent ? `${day(task.startsAt)} · ` : ''}{time(task.startsAt)}–{time(task.endsAt)}</strong>}</div>
          <div className="run-what">{editable ? <input id={`run-name-${task.localId}`} aria-label="Activity name" placeholder="What happens? e.g. Welcome drinks" maxLength={200} value={task.activity} aria-invalid={task.activity.trim().length < 2 || undefined} onChange={event => update(task.localId, { activity: event.target.value })} />
            : <strong>{task.activity}</strong>}
            <span className="run-sub">{service ? `Booked service · ${service.quantity} ${Number(service.quantity) === 1 ? 'unit' : 'units'}` : 'Extra activity'}{task.instructions && !noteShown ? ` · Note: ${task.instructions}` : ''}</span></div>
          <div className="run-who">{editable ? <select aria-label={`Who does ${task.activity || 'this activity'}`} className={task.staffId ? '' : 'is-empty'} value={task.staffId} onChange={event => update(task.localId, { staffId: event.target.value })}><option value="">Choose a person…</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}{busyStaff.some(other => other.staffId === person.id && overlaps(task, other)) ? ' (busy elsewhere)' : ''}</option>)}</select>
            : <strong>{task.staffName || personName(task.staffId)}</strong>}
            {clash ? <span className="run-flag is-clash"><AlertTriangle size={13} aria-hidden="true" />Overlaps with “{clash.activity || clash.orderVenue || 'another event'}”</span>
              : !task.staffId ? <span className="run-flag is-warn"><AlertTriangle size={13} aria-hidden="true" />Needs a person</span>
              : brief ? <span className={`brief-pill is-${brief.status}`}>{briefNames[brief.status]}</span> : null}</div>
          {editable && <div className="run-tools"><button type="button" className={`icon-button ${task.instructions ? 'has-note' : ''}`} aria-expanded={noteShown} aria-label={`${task.instructions ? 'Edit' : 'Add'} a note for ${task.activity || 'this activity'}`} title="Note for the person" onClick={() => setNoteOpen(noteShown ? null : task.localId)}><MessageSquare size={16} /></button>
            <button type="button" className="icon-button destructive" aria-label={`Delete ${task.activity || 'activity'}`} title="Delete" onClick={() => askDelete(task)}><Trash2 size={16} /></button></div>}
          {editable && confirmDelete === task.localId && <div className="run-confirm" role="alertdialog" aria-labelledby={`run-del-${task.localId}`} onKeyDown={event => { if (event.key === 'Escape') setConfirmDelete(null); }}>
            <AlertTriangle size={18} aria-hidden="true" /><div><strong id={`run-del-${task.localId}`}>Delete “{task.activity || 'this activity'}”?</strong><span>Its time, person and note will be removed from the plan.</span></div>
            <button type="button" id={`run-keep-${task.localId}`} className="button secondary small-button" onClick={() => setConfirmDelete(null)}>Keep</button>
            <button type="button" className="button danger small-button" onClick={() => remove(task)}><Trash2 size={15} aria-hidden="true" />Delete</button></div>}
          {editable && noteShown && <label className="run-note"><span>Note for the person <span className="optional">Optional</span></span><textarea rows={2} maxLength={2000} autoFocus value={task.instructions} placeholder="e.g. Use the side entrance, bring 2 extension cables" onChange={event => update(task.localId, { instructions: event.target.value })} /></label>}
        </li>; })}</ul>
      {!shown.length && <p className="exec-empty">{tasks.length ? <>No activities match. <button type="button" className="text-button" onClick={() => { setFilter('all'); setSearch(''); }}>Show all</button></> : 'No activities yet.'}</p>}
      <Pagination pagination={pagination} />
      {editable && <div className="run-add"><button type="button" className="button secondary" disabled={tasks.length >= 100 || Boolean(busy)} onClick={() => add()}><Plus size={16} aria-hidden="true" />Add activity</button>
        {missing.map(service => <button key={service.id} type="button" className="text-button" onClick={() => setTasks(previous => [...previous, fromService(service)])}><Plus size={14} aria-hidden="true" />Add back “{service.name}”</button>)}
        <span className="small muted">{tasks.length}/100</span></div>}

      {editable && <details className="exec-notes" open={Boolean(notes)}><summary>Note for everyone{notes ? ' · added' : ' (optional)'}</summary><label className="field"><span className="sr-only">Note for everyone</span><textarea rows={2} maxLength={4000} value={notes} placeholder="Shared with every person, e.g. dress code or parking" onChange={event => setNotes(event.target.value)} /></label></details>}
      {!editable && plan?.notes && <p className="small muted">Note for everyone: {plan.notes}</p>}
      {tasks.length > 0 && <details className="exec-notes"><summary>See the day as a timeline</summary><ExecTimeline order={order} tasks={tasks} staff={staff} /></details>}
      {!staff.length && <p className="notice notice-warning">An administrator needs to create staff accounts before people can be assigned.</p>}

      {finalized && !confirmSend && <p className="notice notice-info small">The schedule is finalized and locked. Check it once more, then press <strong>Send to staff</strong> — or <strong>Edit schedule</strong> to reopen it as a draft.</p>}
      {sent ? actions(<><button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => { setRevising(true); setConfirmSend(false); }}><Pencil size={15} aria-hidden="true" />Change plan</button></>)
        : finalized && !confirmSend ? actions(<><button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => { setRevising(true); setConfirmSend(false); }}><Pencil size={15} aria-hidden="true" />Edit schedule</button>
          <button type="button" className="button primary" disabled={Boolean(busy) || problems.length > 0} title={problems[0]} onClick={() => setConfirmSend(true)}><Send size={16} aria-hidden="true" />Send to staff</button></>)
        : confirmSend ? actions(<><button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => setConfirmSend(false)}>Back</button><button type="button" className="button primary" disabled={Boolean(busy)} onClick={send}><Send size={16} aria-hidden="true" />{busy === 'send' ? 'Sending…' : 'Yes, send'}</button></>)
        : actions(<>{problems.length > 0 && <span className="run-blocker" role="status"><AlertTriangle size={14} aria-hidden="true" />{problems[0]}{problems.length > 1 ? ` (+${problems.length - 1} more)` : ''}</span>}
          {revising && <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => { populate(plan); setRevising(false); }}>Cancel changes</button>}
          {!revising && dirty && plan && <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => populate(plan)}>Discard</button>}
          <button type="button" className="button secondary" disabled={Boolean(busy) || (!dirty && Boolean(plan)) || !tasks.length || unnamed.length > 0} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="button primary" disabled={Boolean(busy) || problems.length > 0} title={problems[0]} onClick={finalize}><Lock size={16} aria-hidden="true" />{busy === 'finalize' ? 'Finalizing…' : 'Finalize schedule'}</button></>)}
    </>}
  </section>;
}
