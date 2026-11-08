import React, { useState } from 'react';
import { ClipboardList, Check, Play } from 'lucide-react';
import { api } from '../services/api';
import useLiveData from '../useLiveData';
import usePagination from '../usePagination';
import { briefNames, nextBriefStatus, canStartBrief } from '../execution';
import { dateTime } from '../utils';
import { PageHeading, Loading, ErrorNotice, EmptyState, Pagination } from '../components/UI';

export default function StaffWorkspace({ token, refreshVersion }) {
  const { data, error, busy, refresh } = useLiveData(signal => api.briefs.list(token, signal), [token, refreshVersion]);
  const [filter, setFilter] = useState('active'), [pending, setPending] = useState(null), [actionError, setActionError] = useState('');
  const rows = (data || []).filter(brief => filter === 'all' || (filter === 'active' ? !brief.supersededAt && brief.status !== 'completed' : filter === 'withdrawn' ? Boolean(brief.supersededAt) : !brief.supersededAt && brief.status === 'completed'))
    .sort((a, b) => new Date(a.details.taskStartsAt) - new Date(b.details.taskStartsAt));
  const pagination = usePagination(rows, filter, 12);
  const update = async brief => {
    if (pending) return; setPending(brief.id); setActionError('');
    try { await api.briefs.update(token, brief.id, nextBriefStatus(brief)); refresh(); }
    catch (error) { setActionError(error.message); refresh(); } finally { setPending(null); }
  };
  return <><PageHeading eyebrow="Execution workspace" title="Your event briefs" description="Review your assignments, acknowledge instructions, and update activity progress." />
    <ErrorNotice message={error || actionError} /><div className="list-toolbar"><label className="field">Show briefs<select value={filter} onChange={event => setFilter(event.target.value)}><option value="active">Active assignments</option><option value="completed">Completed</option><option value="withdrawn">Withdrawn</option><option value="all">All briefs</option></select></label><span className="small muted">Updates every 30 seconds while visible.</span></div>
    {!data && busy ? <Loading label="Loading execution briefs…" /> : <><div className="staff-brief-grid">{pagination.items.map(brief => { const detail = brief.details, next = nextBriefStatus(brief), future = next === 'in-progress' && !canStartBrief(brief); return <article className={`panel staff-brief ${brief.supersededAt ? 'is-withdrawn' : ''}`} key={brief.id}><div className="staff-brief-header"><ClipboardList size={21} /><span className="workflow-state">{brief.supersededAt ? 'Withdrawn' : briefNames[brief.status]}</span></div><h2>{detail.activity}</h2><p>{detail.venue}</p><p className="small muted">{detail.address}</p><dl className="details-grid"><div><dt>Activity time</dt><dd>{dateTime(detail.taskStartsAt)} – {dateTime(detail.taskEndsAt)}</dd></div><div><dt>Booked service</dt><dd>{detail.serviceName} · {detail.serviceQuantity} units</dd></div><div><dt>Guests</dt><dd>{detail.guests}</dd></div><div><dt>Manager</dt><dd>{detail.managerName}</dd></div></dl><div className="staff-instructions"><h3>Execution instructions</h3><p>{detail.instructions || 'No additional instructions.'}</p>{detail.planNotes && <p>{detail.planNotes}</p>}</div><p className="small muted">Booking {detail.orderId} · Revision {detail.orderRevision} · Sent {dateTime(brief.sentAt)}</p>{brief.supersededAt ? <p className="notice notice-warning">This brief was withdrawn. Follow the latest active assignment.</p> : next && <div className="workflow-actions"><button className="button primary" disabled={Boolean(pending) || future} onClick={() => update(brief)}>{next === 'in-progress' ? <Play size={16} /> : <Check size={16} />}{pending === brief.id ? 'Updating…' : next === 'acknowledged' ? 'Acknowledge brief' : next === 'in-progress' ? 'Start activity' : 'Complete activity'}</button>{future && <span className="small muted">Starting is available from {dateTime(detail.taskStartsAt)}.</span>}</div>}</article>; })}</div><Pagination pagination={pagination} />{!rows.length && <EmptyState icon={ClipboardList} title="No briefs in this view" description="Your manager's dispatched activities will appear here." />}</>}
  </>;
}
