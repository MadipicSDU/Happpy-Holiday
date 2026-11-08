export const executionNames = { 'not-planned': 'Not planned', 'needs-rescheduling': 'Needs rescheduling', draft: 'Draft', finalized: 'Finalized', dispatched: 'Briefs dispatched', superseded: 'Superseded', cancelled: 'Cancelled' };
export const briefNames = { sent: 'Awaiting acknowledgement', acknowledged: 'Acknowledged', 'in-progress': 'In progress', completed: 'Completed' };
export const nextBriefStatus = brief => brief.supersededAt ? null : ({ sent: 'acknowledged', acknowledged: 'in-progress', 'in-progress': 'completed' }[brief.status] || null);
export const canStartBrief = (brief, now = new Date()) => new Date(brief.details.taskStartsAt) <= now;

// Keep activity boundaries inside PostgreSQL's microsecond rental boundaries.
export function executionInput(value, boundary = 'start') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const fraction = typeof value === 'string' ? value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] || '' : '';
  if (boundary === 'start' && /[1-9]/.test(fraction.slice(3))) date.setTime(date.getTime() + 1);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
}
