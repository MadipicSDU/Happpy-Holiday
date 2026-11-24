// In-memory mock of the Happy Holiday .NET API (same routes, shapes and seed data).
// Used only to run the frontend without .NET/PostgreSQL. Sprint 4: booking changes, execution plans, staff briefs, dashboard.
const http = require('node:http');
const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 5294);
const uuid = () => crypto.randomUUID();
const now = () => new Date();
const H = 3600e3;

// ── Seed ──────────────────────────────────────────────
const users = [];
const mkUser = (displayName, email, password, role, extra = {}) => {
  const u = { id: uuid(), displayName, email, password, role, phone: null, clientLimit: 10, createdAt: new Date(Date.now() - 30 * 864e5).toISOString(), ...extra };
  users.push(u); return u;
};
const manager = mkUser('Development Manager', 'manager@happyholiday.local', 'Manager123!', 'manager', { clientLimit: 12 });
mkUser('Default Admin', 'admin@happyholiday.local', 'Admin123!', 'admin');
const staffUsers = [['Aruzhan Bekova', 'staff@happyholiday.local'], ['Timur Sadykov', 'timur.staff@happyholiday.local'], ['Dana Omarova', 'dana.staff@happyholiday.local']]
  .map(([n, e]) => mkUser(n, e, 'Staff123!', 'staff'));
const clients = [
  ['Sarah Jenkins', 'sarah.j@outlook.com'], ['Michael Chang', 'm.chang@corporatecorp.com'], ['Emily Rose', 'emily.rose@agency.co'],
  ['David Miller', 'david@millerholding.com'], ['Sophia Loren', 'sophia@classiccinema.it'], ['James Thompson', 'j.thompson@builders.io'],
].map(([n, e], i) => mkUser(n, e, 'Password1!', 'client', { phone: `+7 701 555 0${10 + i}` }));

const premises = require('./venues-v3.json').map(v => Object.assign({ id: uuid(), promotionPercent: 0, createdAt: now().toISOString() }, v));
const __oldPremises = [
  ['Grand Ballroom Atrium', '123 Main St', 'Opulent chandelier hall with double-height ceiling and bespoke banquet tables.', 250, 2400],
  ['The Crystal Greenhouse', '456 Garden Blvd', 'Lush enclosed garden under vintage iron glass arches with warm string lighting.', 160, 1800],
  ['The Warehouse Atrium', '789 Industry Way', 'Polished concrete floors, exposed brick accents and flexible modular stage architecture.', 220, 1500],
  ['Whispering Pines Lodge', '101 Mountain Rd', 'Warm timber interiors with grand stone fireplace and panoramic mountain views.', 120, 1950],
  ['Horizon Skyline Terrace', '202 Rooftop Ave', 'High-altitude open sky lounge with illuminated city skyline backdrop and modern cocktail bar.', 150, 2200],
  ['Metropolitan Symphony Hall', '303 Arts St', 'Historic auditorium crafted with pristine acoustics and concert-grade AV system.', 350, 3200],
].map(([name, address, description, capacity, pricePerHour]) => ({ id: uuid(), name, address, description, capacity, pricePerHour, imageUrl: null, createdAt: now().toISOString() }));

const services = [
  ['Premium Catering Package', 'FoodPreparation', '3-course meal with champagne reception', 150],
  ['Standard Buffet', 'FoodPreparation', 'Buffet-style catering for up to 200 guests', 80],
  ['Standard A/V Equipment', 'EquipmentRental', 'Projector, screen, and 2 wireless mics', 300],
  ['Stage & Lighting Rig', 'EquipmentRental', 'One stage lighting package per event.', 550],
  ['Floral Table Centrepiece', 'Decoration', 'One floral arrangement for one table.', 120],
  ['DJ Performance', 'Entertainment', 'One hour of DJ performance. Enter the number of hours required.', 400],
  ['Event Photography', 'Photography', 'One hour of photography coverage and edited digital images.', 350],
  ['Event Coordinator', 'EventPlanning', 'One coordinator for one hour of on-site event support.', 200],
  ['Guest Welcome Host', 'Staffing', 'One host for one hour of guest check-in and welcome support.', 100],
  ['Guest Shuttle Transfer', 'Transport', 'One shuttle trip for up to 12 guests. Coordinate route and timing with your manager.', 300],
  ['Event Security Officer', 'Security', 'One security officer for one hour of event coverage.', 150],
  ['Post-event Cleanup', 'Cleaning', 'One standard venue cleanup package per event.', 250],
].map(([name, category, description, price], i) => ({ id: uuid(), name, category, description, price, concurrentCapacity: [null, null, 6, 2, 40, 3, 4, 5, 8, 4, 10, 3][i], createdAt: now().toISOString() }));

const orders = [];
const statuses = ['awaiting-payment', 'confirmed', 'change-requested', 'completed'];
const seedDays = [14, 23, 31, 45, 58, 72], seedHours = [4, 6, 3, 5, 7, 4];
clients.forEach((c, i) => {
  const p = premises[i % premises.length];
  const start = new Date(Date.now() + seedDays[i] * 864e5); start.setUTCHours(13, 0, 0, 0);
  const hours = seedHours[i];
  orders.push({ id: `ORD-${crypto.randomBytes(16).toString('hex')}`, clientId: c.id, managerId: manager.id, premiseId: p.id,
    start, end: new Date(start.getTime() + hours * H), premiseName: p.name, premiseAddress: p.address, rentalRate: p.pricePerHour,
    rentalAmount: p.pricePerHour * hours, guests: 50 + ((i * 37) % (p.capacity - 50)), status: statuses[i % 4], total: p.pricePerHour * hours, lines: [] });
});
// Extra history for Sarah so the client workspace has variety
{
  const c = clients[0], p = premises[1], s = services[0], s2 = services[2];
  const start = new Date(Date.now() + 40 * 864e5); start.setUTCHours(17, 0, 0, 0);
  const lines = [{ id: s.id, name: s.name, category: s.category, unitPrice: s.price, quantity: 120, amount: s.price * 120 },
    { id: s2.id, name: s2.name, category: s2.category, unitPrice: s2.price, quantity: 1, amount: s2.price }];
  orders.push({ id: `ORD-${crypto.randomBytes(16).toString('hex')}`, clientId: c.id, managerId: manager.id, premiseId: p.id, start, end: new Date(start.getTime() + 5 * H),
    premiseName: p.name, premiseAddress: p.address, rentalRate: p.pricePerHour, rentalAmount: p.pricePerHour * 5, guests: 120, status: 'pending', lines,
    total: p.pricePerHour * 5 + lines.reduce((a, l) => a + l.amount, 0) });
  // one booking in every remaining status so all badge variants appear in the client workspace
  [['confirmed', premises[4], 60, 6, 90], ['change-requested', premises[5], 75, 4, 140], ['completed', premises[2], -45, 5, 110]].forEach(([status, pr, days, hrs, guests]) => {
    const st = new Date(Date.now() + days * 864e5); st.setUTCHours(14, 0, 0, 0);
    orders.push({ id: `ORD-${crypto.randomBytes(16).toString('hex')}`, clientId: c.id, managerId: manager.id, premiseId: pr.id, start: st, end: new Date(st.getTime() + hrs * H),
      premiseName: pr.name, premiseAddress: pr.address, rentalRate: pr.pricePerHour, rentalAmount: pr.pricePerHour * hrs, guests, status, lines: [], total: pr.pricePerHour * hrs });
  });
  const past = new Date(Date.now() - 20 * 864e5); past.setUTCHours(12, 0, 0, 0);
  orders.push({ id: `ORD-${crypto.randomBytes(16).toString('hex')}`, clientId: c.id, managerId: manager.id, premiseId: premises[3].id, start: past, end: new Date(past.getTime() + 3 * H),
    premiseName: premises[3].name, premiseAddress: premises[3].address, rentalRate: premises[3].pricePerHour, rentalAmount: premises[3].pricePerHour * 3, guests: 60, status: 'cancelled', lines: [], total: premises[3].pricePerHour * 3, cancellation: { userId: c.id, name: c.displayName, role: 'client', at: new Date(Date.now() - 25 * 864e5).toISOString() } });
}

const CUTOFF = 168;
orders.forEach(o => Object.assign(o, { revision: 1, changeCutoffHours: CUTOFF, pendingChangeId: null, executionState: 'not-planned',
  paidAmount: ['confirmed', 'completed'].includes(o.status) ? o.total : 0, paymentConfirmedAt: ['confirmed', 'completed'].includes(o.status) ? new Date(Date.now() - 3 * 864e5).toISOString() : null }));

// ── Helpers ───────────────────────────────────────────
const userResponse = u => ({ id: u.id, displayName: u.displayName, email: u.email, role: u.role, createdAt: u.createdAt, phone: u.phone, clientLimit: u.clientLimit });
const label = s => ({ pending: 'Pending', 'awaiting-payment': 'Awaiting Payment', confirmed: 'Confirmed', 'change-requested': 'Change Requested', completed: 'Completed', cancelled: 'Cancelled' })[s] || s;
const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
const money = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₸';
const hoursOf = (a, b) => (b - a) / H;
const quoteOf = o => ({ premiseId: o.premiseId, premiseName: o.premiseName, address: o.premiseAddress, startsAt: o.start.toISOString(), endsAt: o.end.toISOString(),
  durationHours: hoursOf(o.start, o.end), rental: { id: o.premiseId, name: o.premiseName, category: 'PremiseRental', unitPrice: o.rentalRate, quantity: hoursOf(o.start, o.end), amount: o.rentalAmount },
  services: o.lines, totalAmount: o.total, currency: 'KZT', legacyEstimate: false, rentalDiscount: 0, promotionPercent: 0 });
const orderResponse = o => ({ id: o.id, clientId: o.clientId, client: users.find(u => u.id === o.clientId)?.displayName ?? null, managerId: o.managerId, premiseId: o.premiseId,
  venue: o.premiseName, address: o.premiseAddress, eventDate: fmtDate(o.start), startsAt: o.start.toISOString(), endsAt: o.end.toISOString(), status: o.status, statusLabel: label(o.status),
  amount: money(o.total), totalAmount: o.total, guests: o.guests, pricing: quoteOf(o), cancellation: o.cancellation || null,
  revision: o.revision, changeDeadline: new Date(o.start.getTime() - o.changeCutoffHours * H).toISOString(), pendingChangeId: o.pendingChangeId,
  paidAmount: o.paidAmount, paymentConfirmedAt: o.paymentConfirmedAt, executionState: o.executionState,
  latestChange: latestChange(o.id) });
const active = o => !['cancelled', 'completed'].includes(o.status);
const overlaps = (a, b, c, d) => a < d && c < b;
class E extends Error { constructor(status, detail, code) { super(detail); this.status = status; this.code = code; } }

function quote(user, dto, excludeId = null) {
  let start, end;
  if (dto.startsAt && dto.endsAt && !dto.eventDate) { start = new Date(dto.startsAt); end = new Date(dto.endsAt); }
  else if (dto.eventDate && !dto.startsAt && !dto.endsAt) { start = new Date(dto.eventDate); end = new Date(start.getTime() + (dto.durationHours || 4) * H); }
  else throw new E(400, 'Supply startsAt and endsAt, or eventDate and durationHours.');
  if (isNaN(start) || isNaN(end) || start <= now() || end <= start || end - start > 365 * 864e5) throw new E(400, 'Choose a future start and a later end, at most 365 days apart.');
  const p = premises.find(x => x.id === dto.premiseId); if (!p) throw new E(404, 'Premise not found.');
  if (!(dto.guests >= 1 && dto.guests <= p.capacity)) throw new E(400, 'Guest count must be positive and within the premise capacity.');
  const act = orders.filter(o => o.id !== excludeId && active(o) && overlaps(start, end, o.start, o.end));
  if (act.some(o => o.premiseId === p.id)) throw new E(409, 'This venue is occupied during the requested period.', 'venue-occupied');
  if (act.filter(o => o.clientId === user.id).length >= 3) throw new E(409, 'You can reserve at most three venues at the same time. Try a different period or manage an existing booking.', 'premise-limit');
  const sel = dto.services?.length ? dto.services : (dto.serviceIds || []).map(id => ({ serviceId: id, quantity: 1 }));
  if (sel.length > 100 || sel.some(s => !(Number.isInteger(s.quantity) && s.quantity >= 1 && s.quantity <= 100000)) || new Set(sel.map(s => s.serviceId)).size !== sel.length)
    throw new E(400, 'Services must be unique, with quantities from 1 to 100000.');
  const lines = sel.map(s => { const sv = services.find(x => x.id === s.serviceId); if (!sv) throw new E(400, 'One or more selected services do not exist.');
    return { id: sv.id, name: sv.name, category: sv.category, unitPrice: sv.price, quantity: s.quantity, amount: sv.price * s.quantity }; });
  const hours = hoursOf(start, end), rentalAmount = Math.round(p.pricePerHour * hours * 100) / 100;
  return { p, start, end, lines, rentalAmount, total: rentalAmount + lines.reduce((a, l) => a + l.amount, 0) };
}

// ── Router ────────────────────────────────────────────
const routes = [];
const on = (method, pattern, roles, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), roles, fn });
const tokenFor = u => Buffer.from(JSON.stringify({ sub: u.id, n: uuid() })).toString('base64url');

on('POST', '/api/auth/login', null, ({ body }) => {
  const u = users.find(x => x.email.toLowerCase() === String(body?.email || '').trim().toLowerCase());
  if (!u || u.password !== body.password) throw new E(401, 'Invalid email or password.');
  return [200, { accessToken: tokenFor(u), tokenType: 'Bearer', expiresAt: new Date(Date.now() + H).toISOString(), user: userResponse(u) }];
});
on('POST', '/api/auth/register', null, ({ body }) => {
  if (!body?.displayName || body.displayName.trim().length < 2) throw new E(400, 'Display name must contain at least two characters.');
  if (users.some(x => x.email.toLowerCase() === String(body.email).toLowerCase())) throw new E(409, 'Email already registered.');
  if (!body.password || body.password.length < 8) throw new E(400, 'Password must be at least 8 characters.');
  const u = mkUser(body.displayName.trim(), body.email.trim(), body.password, 'client', { createdAt: now().toISOString(), phone: body.phone || null });
  return [201, { accessToken: tokenFor(u), tokenType: 'Bearer', expiresAt: new Date(Date.now() + H).toISOString(), user: userResponse(u) }];
});
on('POST', '/api/auth/staff', ['admin'], ({ body }) => {
  if (!['manager', 'admin', 'staff'].includes(body?.role)) throw new E(400, 'Staff role must be manager, admin or staff.');
  if (users.some(x => x.email.toLowerCase() === String(body.email).toLowerCase())) throw new E(409, 'Email already registered.');
  const u = mkUser(body.displayName, body.email, body.password, body.role, { createdAt: now().toISOString(), clientLimit: body.clientLimit || 10, phone: body.phone || null });
  return [201, userResponse(u)];
});
on('GET', '/api/users/me', ['client', 'manager', 'admin', 'staff'], ({ user }) => [200, userResponse(user)]);
on('PUT', '/api/users/me', ['client'], ({ user, body }) => {
  if (!body?.displayName || body.displayName.trim().length < 2) throw new E(400, 'Display name must contain at least two characters.');
  if (users.some(x => x.id !== user.id && x.email.toLowerCase() === String(body.email).toLowerCase())) throw new E(409, 'Email already registered.');
  Object.assign(user, { displayName: body.displayName.trim(), email: body.email.trim(), phone: body.phone?.trim() || null });
  return [200, userResponse(user)];
});
on('GET', '/api/users/clients', ['manager', 'admin'], ({ user }) => {
  const mine = o => user.role === 'admin' || o.managerId === user.id;
  const list = users.filter(u => u.role === 'client' && (user.role === 'admin' || orders.some(o => o.clientId === u.id && mine(o)))).sort((a, b) => a.displayName.localeCompare(b.displayName));
  return [200, list.map(u => { const os = orders.filter(o => o.clientId === u.id && mine(o)); const last = os.length ? new Date(Math.max(...os.map(o => o.start))) : null;
    return { id: u.id, name: u.displayName, email: u.email, phone: u.phone ?? '—', totalBookings: os.length, lastBooking: last ? fmtDate(last) : 'No bookings', company: '', notes: '' }; })];
});
on('GET', '/api/users/staff', ['admin'], () => [200, users.filter(u => u.role !== 'client').map(u => ({ id: u.id, name: u.displayName, email: u.email, role: u.role, clientLimit: u.clientLimit, createdAt: u.createdAt }))]);
on('PUT', '/api/users/:id', ['admin'], ({ params, body }) => {
  const u = users.find(x => x.id === params.id); if (!u) throw new E(404, 'Not found.');
  const count = new Set(orders.filter(o => o.managerId === u.id && active(o)).map(o => o.clientId)).size;
  if (body.clientLimit != null && body.clientLimit < count) throw new E(409, 'Client limit cannot be lower than the current active client count.');
  Object.assign(u, { displayName: body.name.trim(), email: body.email.trim(), role: body.role }); if (body.clientLimit != null) u.clientLimit = body.clientLimit;
  return [200, userResponse(u)];
});
on('DELETE', '/api/users/:id', ['admin'], ({ params }) => { const i = users.findIndex(x => x.id === params.id); if (i < 0) throw new E(404, 'Not found.');
  if (orders.some(o => o.clientId === params.id || o.managerId === params.id)) throw new E(409, 'Users with booking history cannot be deleted.'); users.splice(i, 1); return [204]; });

on('GET', '/api/premises', null, () => [200, [...premises].sort((a, b) => a.name.localeCompare(b.name))]);
on('GET', '/api/premises/occupancy', ['manager', 'admin'], ({ query }) => {
  const from = new Date(query.get('from')), to = new Date(query.get('to'));
  if (isNaN(from) || isNaN(to) || to <= from || to - from > 366 * 864e5) throw new E(400, 'Supply from and to for a period of at most 366 days.');
  const b = orders.filter(o => active(o) && overlaps(o.start, o.end, from, to));
  return [200, [...premises].sort((a, c) => a.name.localeCompare(c.name)).map(p => ({ id: p.id, name: p.name, address: p.address, capacity: p.capacity,
    available: !b.some(o => o.premiseId === p.id), bookings: b.filter(o => o.premiseId === p.id).map(o => ({ id: o.id, premiseId: o.premiseId, startsAt: o.start.toISOString(), endsAt: o.end.toISOString(), status: o.status })) }))];
});
on('POST', '/api/premises', ['admin'], ({ body }) => { const p = { ...body, id: uuid(), createdAt: now().toISOString() }; premises.push(p); return [201, p]; });
on('PUT', '/api/premises/:id', ['admin'], ({ params, body }) => { const p = premises.find(x => x.id === params.id); if (!p) throw new E(404, 'Not found.');
  for (const k of ['name', 'description', 'address', 'capacity', 'pricePerHour', 'imageUrl']) p[k] = body[k]; return [204]; });
on('DELETE', '/api/premises/:id', ['admin'], ({ params }) => { if (orders.some(o => o.premiseId === params.id)) throw new E(409, 'Premises with booking history cannot be deleted.');
  premises.splice(premises.findIndex(x => x.id === params.id), 1); return [204]; });

on('GET', '/api/services', null, ({ query }) => {
  let list = [...services];
  const cat = query.get('category'), q = (query.get('search') || '').toLowerCase(), sort = query.get('sort') || 'name';
  if (cat) list = list.filter(s => s.category === cat);
  if (q) list = list.filter(s => (s.name + s.category + (s.description || '')).toLowerCase().includes(q));
  const by = { name: (a, b) => a.name.localeCompare(b.name), 'price-asc': (a, b) => a.price - b.price || a.name.localeCompare(b.name), 'price-desc': (a, b) => b.price - a.price || a.name.localeCompare(b.name), category: (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) }[sort];
  return [200, list.sort(by)];
});
on('POST', '/api/services', ['admin'], ({ body }) => { const s = { ...body, id: uuid(), createdAt: now().toISOString() }; services.push(s); return [201, s]; });
on('PUT', '/api/services/:id', ['admin'], ({ params, body }) => { const s = services.find(x => x.id === params.id); if (!s) throw new E(404, 'Not found.');
  for (const k of ['name', 'description', 'category', 'price', 'concurrentCapacity']) s[k] = body[k]; return [204]; });
on('DELETE', '/api/services/:id', ['admin'], ({ params }) => { services.splice(services.findIndex(x => x.id === params.id), 1); return [204]; });

const visible = user => orders.filter(o => user.role === 'admin' || (user.role === 'client' ? o.clientId === user.id : o.managerId === user.id)).sort((a, b) => b.start - a.start);
on('GET', '/api/orders', ['client', 'manager', 'admin'], ({ user }) => [200, visible(user).map(orderResponse)]);
const quoteVersion = (q, guests) => crypto.createHash('sha256').update(JSON.stringify({
  venue: q.p.id, address: q.p.address, name: q.p.name, start: q.start, end: q.end, guests, rate: q.p.pricePerHour,
  lines: [...q.lines].sort((left, right) => left.id.localeCompare(right.id)),
})).digest('hex').toUpperCase();
on('POST', '/api/orders/quote', ['client'], ({ user, body }) => { const q = quote(user, body);
  return [200, { ...quoteOf({ premiseId: q.p.id, premiseName: q.p.name, premiseAddress: q.p.address, start: q.start, end: q.end, rentalRate: q.p.pricePerHour, rentalAmount: q.rentalAmount, lines: q.lines, total: q.total }),
    quoteVersion: quoteVersion(q, body.guests) }]; });
on('POST', '/api/orders', ['client'], ({ user, body }) => { const q = quote(user, body);
  if (body.expectedQuoteVersion != null && body.expectedQuoteVersion !== quoteVersion(q, body.guests))
    throw new E(409, 'The quote changed. Review the updated price before submitting.', 'quote-changed');
  const o = { id: `ORD-${crypto.randomBytes(16).toString('hex')}`, clientId: user.id, managerId: manager.id, premiseId: q.p.id, start: q.start, end: q.end, premiseName: q.p.name,
    premiseAddress: q.p.address, rentalRate: q.p.pricePerHour, rentalAmount: q.rentalAmount, guests: body.guests, status: 'pending', total: q.total, lines: q.lines,
    revision: 1, changeCutoffHours: CUTOFF, pendingChangeId: null, paidAmount: 0, paymentConfirmedAt: null, executionState: 'not-planned' };
  orders.push(o); return [201, orderResponse(o)]; });
on('GET', '/api/orders/:id', ['client', 'manager', 'admin'], ({ user, params }) => { const o = visible(user).find(x => x.id === params.id); if (!o) throw new E(404, 'Not found.'); return [200, orderResponse(o)]; });
on('PATCH', '/api/orders/:id/status', ['client', 'manager', 'admin'], ({ user, params, body }) => {
  const o = visible(user).find(x => x.id === params.id); if (!o) throw new E(404, 'Not found.');
  const next = body?.status; const ok = () => [200, orderResponse(o)];
  if (o.status === next) return ok();
  if (!active(o)) throw new E(409, 'Terminal orders cannot change status.');
  if (user.role === 'client') { if (next !== 'cancelled' || !['pending', 'awaiting-payment'].includes(o.status)) throw new E(400, 'Clients may cancel pending or unpaid orders.'); }
  else { const allowed = (o.status === 'confirmed' && next === 'completed' && o.end <= now()) || (next === 'cancelled' && ['pending', 'awaiting-payment'].includes(o.status));
    if (!allowed) throw new E(400, 'Invalid order status transition.'); }
  o.status = next;
  if (next === 'cancelled') { o.cancellation = { userId: user.id, name: user.displayName, role: user.role, at: now().toISOString() }; invoices.filter(i => i.orderId === o.id && !i.settledAt && !payments.some(p => p.invoiceId === i.id)).forEach(i => { i.voidedAt = now().toISOString(); }); }
  return [200, orderResponse(o)];
});

// ── Invoices & payments (demo) ──
const invoices = [], payments = [];
const invoiceView = inv => { const rc = payments.find(p => p.invoiceId === inv.id);
  const status = inv.voidedAt ? 'void' : inv.documentType === 'credit-note' ? 'credited' : rc || inv.settledAt ? 'paid' : inv.deliveredAt ? 'issued' : 'draft';
  return Object.assign({}, inv, { currency: 'KZT', status, demoPaymentsEnabled: true,
    receipt: rc ? { id: rc.id, reference: rc.reference, amount: rc.amount, paidAt: rc.paidAt, isDemo: true, currency: 'KZT' } : null }); };
const makeInvoice = (o, delivered, at = new Date(Date.now() - 2 * 864e5)) => { const c = users.find(u => u.id === o.clientId);
  const balance = o.total - o.paidAmount;
  const inv = { id: uuid(), number: 'INV-' + crypto.randomBytes(16).toString('hex').toUpperCase(), orderId: o.id, revision: o.revision, clientName: c.displayName, clientEmail: c.email,
    createdAt: at.toISOString(), deliveredAt: delivered ? at.toISOString() : null, voidedAt: null, totalAmount: Math.abs(balance), pricing: quoteOf(o),
    documentType: balance < 0 ? 'credit-note' : 'invoice', isDemo: balance < 0, previousPaidAmount: o.paidAmount,
    settledAt: balance <= 0 && o.paymentConfirmedAt ? at.toISOString() : null };
  if (balance < 0) o.paidAmount = o.total;
  invoices.push(inv); return inv; };
orders.filter(o => o.status === 'awaiting-payment').forEach(o => makeInvoice(o, true));
orders.filter(o => ['confirmed', 'completed'].includes(o.status)).forEach(o => { const paid = o.paidAmount; o.paidAmount = 0;
  const inv = makeInvoice(o, true, new Date(Date.now() - 5 * 864e5)); o.paidAmount = paid;
  payments.push({ id: uuid(), invoiceId: inv.id, amount: inv.totalAmount, paidAt: o.paymentConfirmedAt, reference: 'DEMO-' + crypto.randomBytes(16).toString('hex').toUpperCase() }); });
const visibleOrder = (user, id) => visible(user).find(o => o.id === id);
const currentInvoice = o => invoices.find(i => i.orderId === o.id && i.revision === o.revision);
on('GET', '/api/orders/:id/invoice', ['client', 'manager', 'admin'], ({ user, params }) => {
  const o = visibleOrder(user, params.id); if (!o) throw new E(404, 'Not found.'); const inv = currentInvoice(o);
  if (!inv || (user.role === 'client' && !inv.deliveredAt)) throw new E(404, 'Not found.'); return [200, invoiceView(inv)]; });
on('GET', '/api/orders/:id/invoice/history', ['client', 'manager', 'admin'], ({ user, params }) => {
  if (!visibleOrder(user, params.id)) throw new E(404, 'Not found.');
  return [200, invoices.filter(i => i.orderId === params.id && (user.role !== 'client' || i.deliveredAt)).sort((a, b) => b.revision - a.revision || b.createdAt.localeCompare(a.createdAt)).map(invoiceView)]; });
on('POST', '/api/orders/:id/invoice', ['manager', 'admin'], ({ user, params }) => {
  const o = visibleOrder(user, params.id); if (!o) throw new E(404, 'Not found.'); const ex = currentInvoice(o); if (ex) return [200, invoiceView(ex)];
  if (!['pending', 'awaiting-payment'].includes(o.status)) throw new E(409, 'Only pending or unpaid orders can be invoiced.');
  const inv = makeInvoice(o, false, now()); return [200, invoiceView(inv)]; });
on('POST', '/api/orders/:id/invoice/deliver', ['manager', 'admin'], ({ user, params }) => {
  const o = visibleOrder(user, params.id); const inv = o && currentInvoice(o); if (!inv) throw new E(404, 'Not found.');
  if (!inv.deliveredAt) { inv.deliveredAt = now().toISOString(); if (o.status === 'pending') o.status = 'awaiting-payment'; } return [200, invoiceView(inv)]; });
on('POST', '/api/orders/:id/invoice/pay', ['client'], ({ user, params, body }) => {
  const o = visibleOrder(user, params.id); const inv = o && currentInvoice(o); if (!inv || !inv.deliveredAt) throw new E(404, 'Not found.');
  if (payments.find(p => p.invoiceId === inv.id)) return [200, invoiceView(inv)];
  if (body.invoiceId && body.invoiceId !== inv.id) throw new E(409, 'The invoice changed. Refresh and review the current amount before paying.');
  if (body.outcome === 'declined') throw new E(402, 'Demo payment declined. Nothing was paid; you can try again.');
  const at = now().toISOString();
  payments.push({ id: uuid(), invoiceId: inv.id, amount: inv.totalAmount, paidAt: at, reference: 'DEMO-' + crypto.randomBytes(16).toString('hex').toUpperCase() });
  inv.settledAt = at; o.paidAmount += inv.totalAmount; o.paymentConfirmedAt = at; o.status = 'confirmed'; return [200, invoiceView(inv)]; });

// ── Booking changes (Sprint 4) ──
const changes = [];
function latestChange(orderId) {
  const outcome = changes.filter(change => change.orderId === orderId && change.reviewedAt)
    .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt))[0];
  return outcome && { id: outcome.id, status: outcome.status };
}
const changeView = c => ({ id: c.id, orderId: c.orderId, originalRevision: c.originalRevision, status: c.status, reason: c.reason, guests: c.guests, priceDelta: c.priceDelta,
  requestedAt: c.requestedAt, reviewedAt: c.reviewedAt || null, reviewedByName: c.reviewedByName || null, reviewNote: c.reviewNote || null, pricing: c.pricing, previousPricing: c.previousPricing });
const checkDeadline = (o, proposedStart) => {
  if (!['pending', 'awaiting-payment', 'confirmed'].includes(o.status)) throw new E(409, 'This booking cannot be changed in its current state.');
  const start = proposedStart && proposedStart < o.start ? proposedStart : o.start;
  if (now() >= new Date(start.getTime() - o.changeCutoffHours * H)) throw new E(409, 'The change deadline has passed for the current or proposed rental period.'); };
const quoteFor = (o, booking) => { const client = users.find(u => u.id === o.clientId); const q = quote(client, booking, o.id);
  return { q, pricing: quoteOf({ premiseId: q.p.id, premiseName: q.p.name, premiseAddress: q.p.address, start: q.start, end: q.end, rentalRate: q.p.pricePerHour, rentalAmount: q.rentalAmount, lines: q.lines, total: q.total }) }; };
on('GET', '/api/orders/:id/changes', ['client', 'manager', 'admin'], ({ user, params }) => {
  if (!visibleOrder(user, params.id)) throw new E(404, 'Not found.');
  return [200, changes.filter(c => c.orderId === params.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(changeView)]; });
on('POST', '/api/orders/:id/changes/quote', ['client'], ({ user, params, body }) => {
  const o = visibleOrder(user, params.id); if (!o) throw new E(404, 'Not found.');
  if (body.expectedRevision !== o.revision) throw new E(409, 'This booking changed. Refresh before requesting another quote.');
  checkDeadline(o); const { q, pricing } = quoteFor(o, body.booking); checkDeadline(o, q.start);
  return [200, { pricing, currentAmount: o.total, priceDelta: q.total - o.total, amountDue: Math.max(0, q.total - o.paidAmount), demoCredit: Math.max(0, o.paidAmount - q.total),
    changeDeadline: new Date(o.start.getTime() - o.changeCutoffHours * H).toISOString(), revision: o.revision }]; });
on('POST', '/api/orders/:id/changes', ['client'], ({ user, params, body }) => {
  const o = visibleOrder(user, params.id); if (!o) throw new E(404, 'Not found.'); checkDeadline(o);
  if (o.revision !== body.expectedRevision || o.pendingChangeId) throw new E(409, 'Refresh the booking or withdraw its pending change request first.');
  const { q, pricing } = quoteFor(o, body.booking); checkDeadline(o, q.start);
  if (body.expectedTotal !== q.total) throw new E(409, 'The price changed. Review a fresh quote before sending the change request.');
  const c = { id: uuid(), orderId: o.id, originalRevision: o.revision, status: 'pending', reason: (body.reason || '').trim(), guests: body.booking.guests, priceDelta: q.total - o.total,
    requestedAt: now().toISOString(), pricing, previousPricing: quoteOf(o), booking: body.booking };
  changes.push(c); o.pendingChangeId = c.id; return [200, changeView(c)]; });
on('POST', '/api/orders/:id/changes/:changeId/withdraw', ['client'], ({ user, params }) => {
  const o = visibleOrder(user, params.id); const c = o && changes.find(x => x.id === params.changeId && x.orderId === o.id); if (!c) throw new E(404, 'Not found.');
  if (c.status === 'withdrawn') return [200, changeView(c)]; if (c.status !== 'pending') throw new E(409, 'This request has already been reviewed.');
  c.status = 'withdrawn'; c.reviewedAt = now().toISOString(); o.pendingChangeId = null; return [200, changeView(c)]; });
on('POST', '/api/orders/:id/changes/:changeId/review', ['manager', 'admin'], ({ user, params, body }) => {
  const o = visibleOrder(user, params.id); const c = o && changes.find(x => x.id === params.changeId && x.orderId === o.id); if (!c) throw new E(404, 'Not found.');
  if (c.status !== 'pending') { if (c.status === (body.approve ? 'approved' : 'rejected')) return [200, changeView(c)]; throw new E(409, 'This request has already been resolved.'); }
  if (body.approve) {
    const start = new Date(c.pricing.startsAt); checkDeadline(o, start);
    if (c.originalRevision !== o.revision) throw new E(409, 'The original booking revision changed. Request a new quote.');
    const { q } = quoteFor(o, c.booking); const at = now();
    invoices.filter(i => i.orderId === o.id && !i.voidedAt && !i.settledAt && !payments.some(p => p.invoiceId === i.id)).forEach(i => { i.voidedAt = at.toISOString(); });
    invalidatePlan(o, at, 'needs-rescheduling');
    Object.assign(o, { premiseId: q.p.id, premiseName: q.p.name, premiseAddress: q.p.address, start: q.start, end: q.end, guests: c.guests, rentalRate: q.p.pricePerHour,
      rentalAmount: q.rentalAmount, lines: q.lines, total: q.total, revision: o.revision + 1 });
    makeInvoice(o, true, at);
    o.status = o.paymentConfirmedAt && o.paidAmount >= o.total ? 'confirmed' : 'awaiting-payment';
  }
  Object.assign(c, { status: body.approve ? 'approved' : 'rejected', reviewedAt: now().toISOString(), reviewedByName: user.displayName, reviewNote: (body.note || '').trim() || null });
  o.pendingChangeId = null; return [200, changeView(c)]; });

// ── Execution plans & staff briefs (Sprint 4) ──
const plans = [], briefs = [];
const planFor = o => plans.find(p => p.orderId === o.id && p.orderRevision === o.revision);
const planView = p => ({ id: p.id, orderId: p.orderId, orderRevision: p.orderRevision, version: p.version, state: p.state, notes: p.notes, updatedAt: p.updatedAt,
  finalizedAt: p.finalizedAt || null, dispatchedAt: p.dispatchedAt || null, tasks: [...p.tasks].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  briefs: briefs.filter(b => b.planId === p.id && b.planVersion === p.version).map(b => ({ id: b.id, taskId: b.taskId, staffId: b.staffId, status: b.status, sentAt: b.sentAt, updatedAt: b.updatedAt, supersededAt: b.supersededAt || null })) });
function invalidatePlan(o, at, state) {
  plans.filter(p => p.orderId === o.id).forEach(p => briefs.filter(b => b.planId === p.id && !b.supersededAt).forEach(b => { b.supersededAt = at.toISOString(); }));
  if (o.executionState !== 'not-planned') o.executionState = state; }
const requirePaid = o => { if (!(o.status === 'confirmed' && o.paymentConfirmedAt && o.paidAmount >= o.total)) throw new E(409, 'Record payment covering the current booking before planning its execution.'); };
const validatePlan = (o, tasks, planId, finalize) => {
  requirePaid(o);
  if (o.end <= now()) throw new E(409, 'The rental has ended; its execution plan cannot be changed.');
  if (tasks.length > 100 || (finalize && !tasks.length)) throw new E(400, 'Add between one and 100 execution activities before finalizing.');
  for (const t of tasks) {
    const st = new Date(t.startsAt), en = new Date(t.endsAt);
    if (!t.activity || t.activity.trim().length < 2 || st < o.start || en > o.end || en <= st) throw new E(400, 'Each activity needs a name and a valid period inside the venue rental.');
    if (t.serviceId && !o.lines.some(l => l.id === t.serviceId)) throw new E(400, 'Execution activities can reference only services in this booking.');
    if (t.staffId && !users.some(u => u.id === t.staffId && u.role === 'staff')) throw new E(400, 'Assign activities to an existing service staff / performer account.');
    if (finalize && !t.staffId) throw new E(400, 'Assign a staff member to every activity before finalizing.');
  }
  if (!finalize) return;
  if (o.lines.some(l => !tasks.some(t => t.serviceId === l.id))) throw new E(400, 'Include every booked service in the execution schedule.');
  const reserved = plans.filter(p => p.id !== planId && ['finalized', 'dispatched'].includes(p.state)).flatMap(p => { const po = orders.find(x => x.id === p.orderId);
    return po && po.status === 'confirmed' && p.orderRevision === po.revision ? p.tasks : []; });
  for (const t of tasks) { const st = new Date(t.startsAt), en = new Date(t.endsAt);
    if (reserved.some(r => r.staffId === t.staffId && overlaps(st, en, new Date(r.startsAt), new Date(r.endsAt))) || tasks.some(x => x !== t && x.staffId === t.staffId && overlaps(st, en, new Date(x.startsAt), new Date(x.endsAt))))
      throw new E(409, 'A staff member has overlapping execution activities. Choose another person or time.'); } };
on('GET', '/api/orders/:id/execution', ['manager', 'admin'], ({ user, params }) => {
  const o = visibleOrder(user, params.id); if (!o) throw new E(404, 'Not found.'); const p = planFor(o); if (!p) throw new E(404, 'Not found.'); return [200, planView(p)]; });
on('PUT', '/api/orders/:id/execution', ['manager', 'admin'], ({ user, params, body }) => {
  const o = visibleOrder(user, params.id); if (!o) throw new E(404, 'Not found.'); let p = planFor(o);
  if ((p && body.expectedVersion !== p.version) || (!p && body.expectedVersion != null)) throw new E(409, 'This plan changed. Refresh before saving another draft.');
  if (p && briefs.some(b => b.planId === p.id && !b.supersededAt && ['in-progress', 'completed'].includes(b.status))) throw new E(409, 'Execution has started. Its published plan cannot be rewritten.');
  validatePlan(o, body.tasks || [], p?.id, false);
  const at = now().toISOString();
  if (!p) { p = { id: uuid(), orderId: o.id, orderRevision: o.revision, version: 1, tasks: [] }; plans.push(p); }
  else { briefs.filter(b => b.planId === p.id && !b.supersededAt).forEach(b => { b.supersededAt = at; }); p.version++; }
  Object.assign(p, { state: 'draft', notes: (body.notes || '').trim(), updatedAt: at, finalizedAt: null, dispatchedAt: null,
    tasks: body.tasks.map(t => ({ id: uuid(), serviceId: t.serviceId || null, serviceName: o.lines.find(l => l.id === t.serviceId)?.name || 'Venue preparation', activity: t.activity.trim(),
      staffId: t.staffId || null, staffName: users.find(u => u.id === t.staffId)?.displayName || null, startsAt: new Date(t.startsAt).toISOString(), endsAt: new Date(t.endsAt).toISOString(), instructions: (t.instructions || '').trim() })) });
  o.executionState = 'draft'; return [200, planView(p)]; });
const asDto = p => p.tasks.map(t => ({ ...t }));
on('POST', '/api/orders/:id/execution/finalize', ['manager', 'admin'], ({ user, params, body }) => {
  const o = visibleOrder(user, params.id); const p = o && planFor(o); if (!p) throw new E(404, 'Not found.');
  if (['finalized', 'dispatched'].includes(p.state)) return [200, planView(p)];
  if (p.version !== body.expectedVersion || p.state !== 'draft') throw new E(409, 'Refresh the current draft before finalizing.');
  validatePlan(o, asDto(p), p.id, true);
  Object.assign(p, { state: 'finalized', version: p.version + 1, finalizedAt: now().toISOString(), updatedAt: now().toISOString() }); o.executionState = 'finalized'; return [200, planView(p)]; });
on('POST', '/api/orders/:id/execution/dispatch', ['manager', 'admin'], ({ user, params, body }) => {
  const o = visibleOrder(user, params.id); const p = o && planFor(o); if (!p) throw new E(404, 'Not found.');
  if (p.state === 'dispatched') return [200, planView(p)];
  if (p.version !== body.expectedVersion || p.state !== 'finalized') throw new E(409, 'Finalize the latest plan before dispatching briefs.');
  validatePlan(o, asDto(p), p.id, true);
  const at = now().toISOString(); Object.assign(p, { version: p.version + 1, state: 'dispatched', dispatchedAt: at, updatedAt: at }); o.executionState = 'dispatched';
  p.tasks.forEach(t => briefs.push({ id: uuid(), planId: p.id, planVersion: p.version, taskId: t.id, staffId: t.staffId, status: 'sent', sentAt: at, updatedAt: at, supersededAt: null,
    details: { orderId: o.id, orderRevision: o.revision, venue: o.premiseName, address: o.premiseAddress, guests: o.guests, startsAt: o.start.toISOString(), endsAt: o.end.toISOString(),
      activity: t.activity, serviceName: t.serviceName, serviceQuantity: o.lines.find(l => l.id === t.serviceId)?.quantity ?? 1, staffName: t.staffName, managerName: user.displayName,
      taskStartsAt: t.startsAt, taskEndsAt: t.endsAt, instructions: t.instructions, planNotes: p.notes } }));
  return [200, planView(p)]; });
on('GET', '/api/staff/briefs', ['staff'], ({ user }) => [200, briefs.filter(b => b.staffId === user.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  .map(b => ({ id: b.id, status: b.status, sentAt: b.sentAt, updatedAt: b.updatedAt, supersededAt: b.supersededAt, details: b.details }))]);
on('PATCH', '/api/staff/briefs/:id', ['staff'], ({ user, params, body }) => {
  const b = briefs.find(x => x.id === params.id && x.staffId === user.id); if (!b) throw new E(404, 'Not found.');
  const p = plans.find(x => x.id === b.planId), o = orders.find(x => x.id === p.orderId);
  if (b.supersededAt || p.state !== 'dispatched' || p.orderRevision !== o.revision || o.status !== 'confirmed') throw new E(409, 'This brief has been withdrawn or the booking is no longer ready for execution.');
  if (b.status === body.status) return [200, { id: b.id, status: b.status }];
  const ok = { sent: 'acknowledged', acknowledged: 'in-progress', 'in-progress': 'completed' }[b.status] === body.status;
  if (!ok) throw new E(400, 'Acknowledge, start, and complete the brief in that order.');
  if (body.status === 'in-progress' && now() < new Date(b.details.taskStartsAt)) throw new E(409, 'This activity has not started yet. You can acknowledge the brief now.');
  b.status = body.status; b.updatedAt = now().toISOString(); return [200, { id: b.id, status: b.status, updatedAt: b.updatedAt }]; });

// ── Manager monitoring (Sprint 4) ──
on('GET', '/api/management/operators', ['manager', 'admin'], () => [200, users.filter(u => u.role === 'staff').sort((a, b) => a.displayName.localeCompare(b.displayName)).map(u => ({ id: u.id, name: u.displayName }))]);
on('GET', '/api/management/dashboard', ['manager', 'admin'], ({ user, query }) => {
  const t0 = now(); const start = query.get('from') ? new Date(query.get('from')) : new Date(t0.toISOString().slice(0, 10)); const end = query.get('to') ? new Date(query.get('to')) : new Date(start.getTime() + 24 * H);
  if (!(end > start) || end - start > 31 * 24 * H) throw new E(400, 'Choose a monitoring period of up to 31 days.');
  const mine = visible(user).filter(active).sort((a, b) => a.start - b.start);
  const inRange = orders.filter(o => active(o) && o.start < end && o.end > start);
  const peak = sv => { const rs = inRange.flatMap(o => o.lines.filter(l => l.id === sv.id).map(l => ({ s: o.start, e: o.end, q: l.quantity })));
    return rs.reduce((m, r) => Math.max(m, rs.filter(x => x.s < r.e && x.e > r.s).reduce((a, x) => a + x.q, 0)), 0); };
  const liveTasks = plans.filter(p => ['finalized', 'dispatched'].includes(p.state)).flatMap(p => { const o = orders.find(x => x.id === p.orderId);
    return o && o.status === 'confirmed' && p.orderRevision === o.revision ? p.tasks.filter(t => new Date(t.startsAt) < end && new Date(t.endsAt) > start).map(t => ({ ...t, orderId: o.id })) : []; });
  const liveBriefs = briefs.filter(b => !b.supersededAt).map(b => { const p = plans.find(x => x.id === b.planId); return { id: b.id, status: b.status, updatedAt: b.updatedAt, orderId: p.orderId }; }).filter(b => mine.some(o => o.id === b.orderId));
  return [200, { checkedAt: t0.toISOString(), startsAt: start.toISOString(), endsAt: end.toISOString(),
    counts: { activeOrders: mine.length, assignedClients: new Set(mine.map(o => o.clientId)).size, pendingChanges: mine.filter(o => o.pendingChangeId).length,
      awaitingPayment: mine.filter(o => o.status === 'awaiting-payment').length,
      needsExecution: mine.filter(o => o.status === 'confirmed' && o.paymentConfirmedAt && o.end > t0 && !['finalized', 'dispatched'].includes(o.executionState)).length,
      activeServices: liveBriefs.filter(b => b.status === 'in-progress').length },
    worklist: mine.map(orderResponse),
    occupancy: premises.map(p => ({ id: p.id, name: p.name, address: p.address, occupied: inRange.some(o => o.premiseId === p.id),
      bookings: inRange.filter(o => o.premiseId === p.id).map(o => ({ id: o.id, startsAt: o.start.toISOString(), endsAt: o.end.toISOString() })) })).sort((a, b) => b.occupied - a.occupied || a.name.localeCompare(b.name)),
    services: services.map(sv => { const r = peak(sv); return { id: sv.id, name: sv.name, category: sv.category, concurrentCapacity: sv.concurrentCapacity ?? null, reservedUnits: r,
      availableUnits: sv.concurrentCapacity != null ? Math.max(0, sv.concurrentCapacity - r) : null }; }),
    staff: users.filter(u => u.role === 'staff').sort((a, b) => a.displayName.localeCompare(b.displayName)).map(u => ({ id: u.id, name: u.displayName,
      available: !liveTasks.some(t => t.staffId === u.id), assignments: liveTasks.filter(t => t.staffId === u.id).map(t => ({ id: t.id, staffId: t.staffId, activity: t.activity, startsAt: t.startsAt, endsAt: t.endsAt, orderId: t.orderId })) })),
    briefs: liveBriefs }]; });

// Seed: one pending change request so the manager worklist and the "Changes" tab have something to review.
{ const o = orders.find(x => x.status === 'confirmed' && x.start - now() > 10 * 864e5); if (o) {
  const booking = { premiseId: o.premiseId, startsAt: o.start.toISOString(), endsAt: new Date(o.end.getTime() + H).toISOString(), guests: o.guests, services: [{ serviceId: services[6].id, quantity: 2 }] };
  const { q, pricing } = quoteFor(o, booking);
  const c = { id: uuid(), orderId: o.id, originalRevision: o.revision, status: 'pending', reason: 'We would like one more hour and a photographer.', guests: o.guests, priceDelta: q.total - o.total,
    requestedAt: new Date(Date.now() - 864e5).toISOString(), pricing, previousPricing: quoteOf(o), booking };
  changes.push(c); o.pendingChangeId = c.id; } }

on('POST', '/api/premises/alternatives', ['client', 'manager', 'admin'], ({ body }) => {
  const start = new Date(body.startsAt), end = new Date(body.endsAt);
  const occupied = new Set(orders.filter(o => o.id !== body.orderId && active(o) && overlaps(start, end, o.start, o.end)).map(o => o.premiseId));
  const requested = premises.find(p => p.id === body.premiseId); if (!requested) throw new E(404, 'Not found.');
  const hours = hoursOf(start, end);
  const alternatives = premises.filter(p => p.id !== body.premiseId && p.capacity >= body.guests && !occupied.has(p.id))
    .map(p => ({ id: p.id, name: p.name, address: p.address, capacity: p.capacity, pricePerHour: p.pricePerHour, imageUrl: p.imageUrl, promotionPercent: 0, rentalDiscount: 0, rentalAmount: p.pricePerHour * hours }))
    .sort((a, b) => a.rentalAmount - b.rentalAmount || a.name.localeCompare(b.name));
  return [200, { requestedAvailable: !occupied.has(body.premiseId) && requested.capacity >= body.guests, checkedAt: now().toISOString(), startsAt: start.toISOString(), endsAt: end.toISOString(), guests: body.guests, alternatives,
    note: 'Availability is a snapshot; service costs are excluded. Booking validates conflicts and the three-venue policy again.' }];
});

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const url = new URL(req.url, 'http://x');
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(data === undefined ? '' : JSON.stringify(data)); };
  try {
    const route = routes.map(r => ({ r, m: r.method === req.method && url.pathname.match(r.re) })).find(x => x.m);
    if (!route) return send(404, { title: 'Not Found' });
    let user = null;
    const auth = req.headers.authorization?.replace(/^Bearer /, '');
    if (auth) { try { user = users.find(u => u.id === JSON.parse(Buffer.from(auth, 'base64url')).sub) || null; } catch {} }
    if (route.r.roles) { if (!user) return send(401); if (!route.r.roles.includes(user.role)) return send(403); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
    const [status, data] = route.r.fn({ user, body, params: route.m.groups || {}, query: url.searchParams });
    send(status, data);
  } catch (e) { send(e.status || 500, { detail: e.message, code: e.code }); }
}).listen(PORT, '127.0.0.1', () => console.log(`Mock Happy Holiday API on http://127.0.0.1:${PORT}/api`));
