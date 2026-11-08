import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Send, CalendarCheck2 } from 'lucide-react';
import { api } from '../services/api';
import { dateTime } from '../utils';
import { briefNames, executionNames, executionInput } from '../execution';
import { ErrorNotice, Loading } from './UI';

export default function ExecutionPanel({ order, token, onRefresh }) {
  const [plan, setPlan] = useState(null), [staff, setStaff] = useState([]), [tasks, setTasks] = useState([]), [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const ready = order.status === 'confirmed' && order.paymentConfirmedAt && order.paidAmount >= order.totalAmount;
  const newTask = service => ({ localId: crypto.randomUUID(), activity: service?.name || 'Venue preparation', serviceId: service?.id || '', staffId: '',
    startsAt: executionInput(order.startsAt), endsAt: executionInput(order.endsAt, 'end'), instructions: '' });
  const populate = data => {
    setTasks(data ? data.tasks.map(task => ({ ...task, localId: task.id, serviceId: task.serviceId || '', staffId: task.staffId || '', startsAt: executionInput(task.startsAt), endsAt: executionInput(task.endsAt, 'end') }))
      : order.pricing.services.length ? order.pricing.services.map(newTask) : [newTask()]);
    setNotes(data?.notes || '');
  };
  useEffect(() => {
    const abort = new AbortController(); setLoading(true);
    Promise.all([api.execution.get(token, order.id, abort.signal).catch(error => { if (error.status === 404) return null; throw error; }), api.management.operators(token, abort.signal)])
      .then(([data, operators]) => { if (!abort.signal.aborted) { setPlan(data); setStaff(operators); populate(data); setEditing(!data); setError(''); } })
      .catch(error => { if (!abort.signal.aborted) setError(error.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [token, order.id, order.revision, order.executionState, version]);
  useEffect(() => {
    const timer = setInterval(() => { if (!editing && !busy && !document.hidden) setVersion(value => value + 1); }, 30000);
    return () => clearInterval(timer);
  }, [editing, busy]);
  const act = async action => {
    if (busy) return; setBusy(true); setError('');
    try { const data = await action(); setPlan(data); populate(data); setEditing(false); onRefresh?.(); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  const save = event => {
    event.preventDefault();
    act(() => api.execution.save(token, order.id, { expectedVersion: plan?.version ?? null, notes,
      tasks: tasks.map(task => ({ activity: task.activity, serviceId: task.serviceId || null, staffId: task.staffId || null,
        startsAt: new Date(task.startsAt).toISOString(), endsAt: new Date(task.endsAt).toISOString(), instructions: task.instructions })) }));
  };
  const update = (id, key, value) => setTasks(previous => previous.map(task => task.localId === id ? { ...task, [key]: value } : task));
  return <section className="workflow-panel"><div className="section-heading"><div><h3>Execution schedule</h3><p className="small muted">Booking revision {order.revision} · {executionNames[plan?.state || order.executionState] || 'Not planned'}</p></div><button type="button" className="text-button" disabled={busy || editing} onClick={() => setVersion(value => value + 1)}>Refresh plan</button></div><ErrorNotice message={error} />
    {!ready ? <p className="small muted">Record payment covering the current booking before preparing its execution schedule. Historical confirmations without a payment receipt need a recorded payment.</p> : loading ? <Loading label="Loading execution schedule…" /> : <>
      {editing ? <form onSubmit={save} className="execution-editor"><p className="small muted">Add activities within the rental period and cover every booked service. Finalization checks staff availability.</p>{plan?.state === 'dispatched' && <p className="notice notice-warning">Saving a revised draft withdraws the earlier staff briefs. Finalize and dispatch the new plan when ready.</p>}
        <fieldset disabled={busy}><label className="field">Plan notes <span className="optional">Optional</span><textarea rows={2} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
          {tasks.map((task, index) => <article className="execution-task-editor" key={task.localId}><header><strong>Activity {index + 1}</strong><button type="button" className="icon-button destructive" aria-label={`Remove activity ${index + 1}`} onClick={() => setTasks(previous => previous.filter(item => item.localId !== task.localId))}><Trash2 size={16} /></button></header>
            <div className="form-row"><label className="field">Activity name<input required minLength={2} maxLength={200} value={task.activity} onChange={event => update(task.localId, 'activity', event.target.value)} /></label><label className="field">Booked service<select value={task.serviceId} onChange={event => update(task.localId, 'serviceId', event.target.value)}><option value="">Venue preparation / coordination</option>{order.pricing.services.map(service => <option key={service.id} value={service.id}>{service.name} · {service.quantity} units</option>)}</select></label></div>
            <div className="form-row"><label className="field">Activity start<input type="datetime-local" step="0.001" required min={executionInput(order.startsAt)} max={executionInput(order.endsAt, 'end')} value={task.startsAt} onChange={event => update(task.localId, 'startsAt', event.target.value)} /></label><label className="field">Activity end<input type="datetime-local" step="0.001" required min={task.startsAt} max={executionInput(order.endsAt, 'end')} value={task.endsAt} onChange={event => update(task.localId, 'endsAt', event.target.value)} /></label></div>
            <label className="field">Assigned staff / performer<select value={task.staffId} onChange={event => update(task.localId, 'staffId', event.target.value)}><option value="">Assign before finalizing</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label className="field">Execution instructions <span className="optional">Optional</span><textarea maxLength={2000} value={task.instructions} onChange={event => update(task.localId, 'instructions', event.target.value)} /></label>
          </article>)}
          <button type="button" className="button secondary small-button" disabled={tasks.length >= 100} onClick={() => setTasks(previous => [...previous, newTask()])}><Plus size={15} />Add activity ({tasks.length}/100)</button>
        </fieldset>
        {!staff.length && <p className="notice notice-warning">An administrator needs to create service staff / performer accounts before the schedule can be finalized.</p>}
        <div className="workflow-actions">{plan && <button type="button" className="button secondary" disabled={busy} onClick={() => { populate(plan); setEditing(false); setError(''); }}>Discard draft edits</button>}<button className="button primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save execution draft'}</button></div>
      </form> : plan && <><p className="small muted">{plan.notes || 'No additional plan notes.'}</p><ol className="execution-timeline">{plan.tasks.map(task => { const brief = plan.briefs.find(brief => brief.taskId === task.id); return <li key={task.id}><div><strong>{task.activity}</strong><p>{dateTime(task.startsAt)} – {dateTime(task.endsAt)}</p><p className="small muted">{task.serviceName} · {task.staffName || 'Unassigned'}</p>{task.instructions && <p className="small">{task.instructions}</p>}</div>{brief && <span className="workflow-state">{brief.supersededAt ? 'Withdrawn' : briefNames[brief.status]}</span>}</li>; })}</ol>
        <div className="workflow-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => { populate(plan); setEditing(true); setError(''); }}>{plan.state === 'dispatched' ? 'Revise execution plan' : 'Edit draft'}</button>{plan.state === 'draft' && <button className="button primary" disabled={busy} onClick={() => act(() => api.execution.finalize(token, order.id, plan.version))}><CalendarCheck2 size={16} />Finalize schedule</button>}{plan.state === 'finalized' && <button className="button primary" disabled={busy} onClick={() => act(() => api.execution.dispatch(token, order.id, plan.version))}><Send size={16} />Dispatch staff briefs</button>}</div>
        {plan.state === 'dispatched' && <p className="small muted">Briefs are in each assigned staff member's internal workspace. Progress refreshes every 30 seconds while this plan is open.</p>}
      </>}
    </>}
  </section>;
}
