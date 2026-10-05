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
export const statusNames = { pending: 'Pending review', 'awaiting-payment': 'Awaiting payment', confirmed: 'Confirmed', 'change-requested': 'Change requested', completed: 'Completed', cancelled: 'Cancelled' };
export const cancellable = order => ['pending', 'awaiting-payment'].includes(order.status);
export const activeOrder = order => !['completed', 'cancelled'].includes(order.status);
export const categoryName = value => ({ FoodPreparation: 'Food preparation', EquipmentRental: 'Equipment rental' }[value] || value);
export function nextOrder(orders, now = new Date()) {
  return orders.filter(order => activeOrder(order) && new Date(order.endsAt) > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
}
