const moneyFormat = new Intl.NumberFormat('en-KZ', { style: 'currency', currency: 'KZT', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
export const money = value => moneyFormat.format(Number(value) || 0);
export const dateTime = value => value && Number.isFinite(new Date(value).getTime())
  ? dateTimeFormat.format(new Date(value)) : 'Date unavailable';
export const period = order => `${dateTime(order.startsAt)} – ${dateTime(order.endsAt)}`;
export const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const localInput = date => {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
export function bookingPayload(venue, startsAt, endsAt, guests, quantities) {
  const start = new Date(startsAt), end = new Date(endsAt);
  if (!startsAt || !endsAt || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error('Choose both a start and an end date and time.');
  if (start <= new Date()) throw new Error('Choose a start time in the future.');
  if (end <= start) throw new Error('The end time must be after the start time.');
  if (end - start > 365 * 86400000) throw new Error('A rental period cannot exceed 365 days.');
  if (!Number.isInteger(Number(guests)) || Number(guests) < 1 || Number(guests) > venue.capacity) throw new Error(`Enter between 1 and ${venue.capacity} guests.`);
  const selections = Object.entries(quantities);
  if (selections.length > 100) throw new Error('Choose no more than 100 services for one booking.');
  const services = selections.map(([serviceId, quantity]) => {
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 100000) throw new Error('Service quantities must be whole numbers between 1 and 100,000.');
    return { serviceId, quantity: Number(quantity) };
  });
  return { premiseId: venue.id, startsAt: start.toISOString(), endsAt: end.toISOString(), guests: Number(guests), services };
}
export const statusNames = { pending: 'Pending review', 'awaiting-payment': 'Awaiting payment', confirmed: 'Confirmed', 'change-requested': 'Change requested', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired' };
// One order lifecycle shown everywhere (manager list, order page, client portal):
// Pending review → Awaiting payment → Confirmed (paid) → Schedule draft → Schedule finalized → Staff notified → Completed.
// A change request waiting for the manager overrides the stage; an approved change with a price difference returns to
// "Awaiting extra payment" and, once paid, back to Confirmed with "Needs rescheduling" until the plan is sent again.
export const stageNames = {
  pending: 'Pending review', 'change-review': 'Change pending review', 'awaiting-payment': 'Awaiting payment', 'awaiting-difference': 'Awaiting extra payment',
  confirmed: 'Confirmed · paid', finalizing: 'Schedule draft', finalized: 'Schedule finalized', 'needs-rescheduling': 'Needs rescheduling',
  dispatched: 'Staff notified', 'in-execution': 'In execution', executed: 'Execution done', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired',
};
export function orderStage(order) {
  if (!order) return 'pending';
  if (!activeOrder(order)) return order.status;
  if (order.pendingChangeId) return 'change-review';
  if (order.status === 'awaiting-payment') return Number(order.paidAmount) > 0 ? 'awaiting-difference' : 'awaiting-payment';
  if (order.status !== 'confirmed') return order.status;
  const staff = order.staff;
  switch (order.executionState) {
    case 'draft': return 'finalizing';
    case 'finalized': return 'finalized';
    case 'needs-rescheduling': return 'needs-rescheduling';
    case 'dispatched': return staff?.total && staff.completed === staff.total ? 'executed' : staff?.inProgress || staff?.completed ? 'in-execution' : 'dispatched';
    default: return 'confirmed';
  }
}
// Staff column: what the people assigned to the event have done with their briefs.
export function staffSummary(order) {
  const staff = order.staff;
  if (order.status === 'cancelled') return { tone: 'muted', label: 'Withdrawn', detail: '' };
  if (order.status === 'expired') return { tone: 'muted', label: 'No staff assigned', detail: '' };
  if (!staff?.total) {
    if (order.status !== 'confirmed') return { tone: 'muted', label: 'Not needed yet', detail: 'Opens after payment' };
    return order.executionState === 'finalized' ? { tone: 'warn', label: 'Ready to send', detail: 'Schedule finalized' }
      : order.executionState === 'draft' ? { tone: 'warn', label: 'Not sent', detail: 'Schedule is a draft' }
      : order.executionState === 'needs-rescheduling' ? { tone: 'warn', label: 'Not sent', detail: 'Booking changed · plan again' }
      : { tone: 'warn', label: 'Not planned', detail: 'Create the schedule' };
  }
  const people = `${staff.total} ${staff.total === 1 ? 'brief' : 'briefs'}`;
  if (staff.completed === staff.total) return { tone: 'ok', label: 'All completed', detail: people };
  if (staff.inProgress) return { tone: 'info', label: `${staff.inProgress} in progress`, detail: `${staff.completed}/${staff.total} completed` };
  const confirmed = staff.acknowledged + staff.completed;
  if (staff.sent) return { tone: 'warn', label: `${confirmed}/${staff.total} acknowledged`, detail: `${staff.sent} waiting for staff` };
  return { tone: 'ok', label: 'All acknowledged', detail: people };
}
export const cancellable = order => ['pending', 'awaiting-payment', 'confirmed'].includes(order.status)
  && (!order.startsAt || new Date(order.startsAt) > new Date());
export const activeOrder = order => !['completed', 'cancelled', 'expired'].includes(order.status);
export { serviceCategoryName as categoryName } from './serviceCatalogue.js';
export function nextOrder(orders, now = new Date()) {
  return orders.filter(order => activeOrder(order) && new Date(order.endsAt) > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
}

// ── Review fixes: one date/time language across the app (#32), short references (#31) ──
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dayYearFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
export const day = value => (new Date(value).getFullYear() === new Date().getFullYear() ? dayFormat : dayYearFormat).format(new Date(value));
export const time = value => timeFormat.format(new Date(value));
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
// "Tue, 24 Nov · 18:00–22:00" or "Tue, 24 Nov 18:00 – Wed, 25 Nov 01:00"
export const when = item => sameDay(item.startsAt, item.endsAt) ? `${day(item.startsAt)} · ${time(item.startsAt)}–${time(item.endsAt)}` : `${day(item.startsAt)} ${time(item.startsAt)} – ${day(item.endsAt)} ${time(item.endsAt)}`;
export const hours = item => Math.round((new Date(item.endsAt) - new Date(item.startsAt)) / 360000) / 10;
export const shortRef = id => '#' + String(id || '').replace(/^ORD-/i, '').replace(/-/g, '').slice(0, 6).toUpperCase();
export function relative(value, now = new Date()) {
  const ms = new Date(value) - now, d = Math.round(ms / 86400000);
  if (Math.abs(ms) < 3600000) return ms >= 0 ? 'within the hour' : 'just now';
  if (Math.abs(ms) < 86400000) { const h = Math.round(Math.abs(ms) / 3600000); return ms > 0 ? `in ${h} h` : `${h} h ago`; }
  return d > 0 ? `in ${d} day${d === 1 ? '' : 's'}` : `${-d} day${d === -1 ? '' : 's'} ago`;
}
// change deadline as a countdown: tone drives colour (ok / soon / closed)
export function deadline(value, now = new Date()) {
  const ms = new Date(value) - now, days = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000);
  if (ms <= 0) return { tone: 'closed', label: 'Change window closed' };
  return { tone: days < 3 ? 'soon' : 'ok', label: days >= 1 ? `${days} day${days === 1 ? '' : 's'} left to change` : `${h} h left to change` };
}
