import React, { useState } from 'react';
import { ClipboardList, Check, Play, MapPin, Users, User, Radio, Flag } from 'lucide-react';
import { api } from '../services/api';
import useLiveData from '../useLiveData';
import { nextBriefStatus, canStartBrief } from '../execution';
import { day, time, relative, shortRef } from '../utils';
import { PageHeading, Loading, ErrorNotice, EmptyState } from '../components/UI';

const STEPS = [['sent', 'Received'], ['acknowledged', 'Confirmed'], ['in-progress', 'In progress'], ['completed', 'Done']];
const ACTION = { acknowledged: ['Confirm I will do it', Check], 'in-progress': ['Start activity', Play], completed: ['Mark as done', Flag] };

function BriefCard({ brief, pending, onAdvance, featured }) {
  const d = brief.details, next = nextBriefStatus(brief), future = next === 'in-progress' && !canStartBrief(brief), index = STEPS.findIndex(([key]) => key === brief.status);
  const [label, Icon] = ACTION[next] || [];
  return <article className={`brief-card ${featured ? 'is-featured' : ''} ${brief.supersededAt ? 'is-withdrawn' : ''}`}>
    <div className="brief-time"><strong>{time(d.taskStartsAt)}</strong><span>{time(d.taskEndsAt)}</span></div>
    <div className="brief-body">
      {featured && <p className="eyebrow">Next up · {relative(d.taskStartsAt)}</p>}
      <h3>{d.activity}</h3>
      <p className="brief-meta"><span><MapPin size={14} />{d.venue}, {d.address}</span><span><Users size={14} />{d.guests} guests</span><span><User size={14} />Manager: {d.managerName}</span></p>
      <div className="brief-instructions"><strong>What to do</strong><p>{d.instructions || 'No extra instructions — follow the booked service.'}</p>{d.planNotes && <p className="small muted">Event note: {d.planNotes}</p>}<p className="small muted">{d.serviceName} · {d.serviceQuantity} {Number(d.serviceQuantity) === 1 ? 'unit' : 'units'} · Order {shortRef(d.orderId)}</p></div>
      {brief.supersededAt ? <p className="notice notice-warning">This brief was withdrawn because the plan changed. Follow your newest brief.</p>
        : <div className="brief-foot"><ol className="brief-steps">{STEPS.map(([key, stepLabel], i) => <li key={key} className={i < index || brief.status === 'completed' ? 'done' : i === index ? 'current' : ''}><span>{i < index || brief.status === 'completed' ? <Check size={11} /> : i + 1}</span>{stepLabel}</li>)}</ol>
          {next && <div className="brief-action">{future && <span className="small muted">You can start from {time(d.taskStartsAt)} on {day(d.taskStartsAt)}</span>}<button className="button primary" disabled={Boolean(pending) || future} onClick={() => onAdvance(brief)}><Icon size={16} />{pending === brief.id ? 'Saving…' : label}</button></div>}</div>}
    </div>
  </article>;
}

export default function StaffWorkspace({ token, refreshVersion }) {
  const { data, error, busy, refresh } = useLiveData(signal => api.briefs.list(token, signal), [token, refreshVersion]);
  const [filter, setFilter] = useState('active'), [pending, setPending] = useState(null), [actionError, setActionError] = useState('');
  const all = data || [];
  const test = { active: brief => !brief.supersededAt && brief.status !== 'completed', completed: brief => !brief.supersededAt && brief.status === 'completed', withdrawn: brief => Boolean(brief.supersededAt), all: () => true };
  const rows = all.filter(test[filter]).sort((a, b) => new Date(a.details.taskStartsAt) - new Date(b.details.taskStartsAt));
  const featured = filter === 'active' ? rows[0] : null;
  const days = [...rows.filter(brief => brief !== featured).reduce((map, brief) => map.set(day(brief.details.taskStartsAt), [...(map.get(day(brief.details.taskStartsAt)) || []), brief]), new Map())];
  const today = day(new Date()), tomorrow = day(new Date(Date.now() + 86400000));
  const advance = async brief => {
    if (pending) return; setPending(brief.id); setActionError('');
    try { await api.briefs.update(token, brief.id, nextBriefStatus(brief)); refresh(); }
    catch (error) { setActionError(error.message); refresh(); } finally { setPending(null); }
  };
  return <><PageHeading eyebrow="Your work" title="My event briefs" description="What you are asked to do, where and when. Confirm each brief, start it on the day, and mark it done." action={data && <span className="live-pill"><Radio size={14} />{busy ? 'Updating…' : 'Live'}</span>} />
    <ErrorNotice message={error || actionError} />
    <div className="chip-row staff-filter">{[['active', 'To do'], ['completed', 'Done'], ['withdrawn', 'Withdrawn'], ['all', 'All']].map(([key, label]) => <button type="button" key={key} className={`chip ${filter === key ? 'selected' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{all.filter(test[key]).length}</span></button>)}</div>
    {!data && busy ? <Loading label="Loading your briefs…" /> : <>
      {featured && <BriefCard brief={featured} pending={pending} onAdvance={advance} featured />}
      {days.map(([label, list]) => <section className="brief-day" key={label}><h2>{label === today ? 'Today' : label === tomorrow ? 'Tomorrow' : label}</h2>{list.map(brief => <BriefCard key={brief.id} brief={brief} pending={pending} onAdvance={advance} />)}</section>)}
      {!rows.length && <EmptyState icon={ClipboardList} title={filter === 'active' ? 'Nothing to do yet' : 'Nothing here'} description={filter === 'active' ? 'When a manager sends you a brief, it appears here. You confirm it, start it on the event day and mark it done — your manager sees each step.' : 'Briefs you finish or that are withdrawn appear here.'} />}
    </>}
  </>;
}
