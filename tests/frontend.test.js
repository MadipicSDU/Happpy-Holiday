import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingPayload, nextOrder, cancellable, activeOrder } from '../src/utils.js';
import { request, ApiError, api } from '../src/services/api.js';
import { pageWindow } from '../src/usePagination.js';
import { filterServices, serviceCategoryName } from '../src/serviceCatalogue.js';
import { bookingEstimate } from '../src/bookingEstimate.js';
import { demoCardExample, formatDemoCardNumber, formatDemoExpiry, validateDemoPayment } from '../src/demoPayment.js';
import { nextBriefStatus, canStartBrief, executionInput } from '../src/execution.js';

const venue = { id: 'venue-one', capacity: 100 };
const year = new Date().getFullYear() + 1;
const start = `${year}-01-03T22:30`;
const end = `${year}-01-04T01:00`;

test('booking preserves fractional overnight periods and explicit service quantities', () => {
  const body = bookingPayload(venue, start, end, '80', { catering: '80', equipment: '2' });
  assert.equal((new Date(body.endsAt) - new Date(body.startsAt)) / 3600000, 2.5);
  assert.ok(body.startsAt.endsWith('Z'));
  assert.deepEqual(body.services, [{ serviceId: 'catering', quantity: 80 }, { serviceId: 'equipment', quantity: 2 }]);
  assert.equal(body.guests, 80);
});

test('invalid dates, capacity, and service quantities cannot reach the quote API', () => {
  assert.throws(() => bookingPayload(venue, '', end, 80, {}), /Choose both/);
  assert.throws(() => bookingPayload(venue, start, start, 80, {}), /end time/);
  assert.throws(() => bookingPayload(venue, '2020-01-01T10:00', '2020-01-01T12:00', 80, {}), /future/);
  assert.throws(() => bookingPayload(venue, start, end, 101, {}), /between 1 and 100/);
  assert.throws(() => bookingPayload(venue, start, end, 0, {}), /between 1 and 100/);
  assert.throws(() => bookingPayload(venue, start, end, 80, { catering: 0 }), /whole numbers/);
  assert.throws(() => bookingPayload(venue, start, end, 80, { catering: 1.5 }), /whole numbers/);
});

test('optional services remain optional', () => {
  assert.deepEqual(bookingPayload(venue, start, end, 50, {}).services, []);
});

test('live receipt rounds fractional rental and promotion in cents and includes service quantities', () => {
  const receiptVenue = { ...venue, name: 'Test venue', pricePerHour: 100.01, promotionPercent: 10 };
  const services = [{ id: 'catering', name: 'Catering', price: 10.25, category: 'FoodPreparation' }];
  const quantities = { catering: '3' };
  const receipt = bookingEstimate({ venue: receiptVenue, services, startsAt: `${year}-01-03T23:00`, endsAt: `${year}-01-04T00:30`, guests: 80, quantities });
  assert.equal(receipt.issue, '');
  assert.equal(receipt.pricing.durationHours, 1.5);
  assert.equal(receipt.pricing.rental.amount, 150.02);
  assert.equal(receipt.pricing.rentalDiscount, 15);
  assert.equal(receipt.pricing.services[0].amount, 30.75);
  assert.equal(receipt.pricing.totalAmount, 165.77);
  assert.deepEqual(quantities, { catering: '3' });
  const oneMinute = bookingEstimate({ venue: receiptVenue, services: [], startsAt: `${year}-01-03T23:00`, endsAt: `${year}-01-03T23:01`, guests: 1, quantities: {} });
  assert.equal(oneMinute.pricing.rental.amount, 1.67);
  assert.equal(oneMinute.pricing.rentalDiscount, 0.17);
  assert.equal(oneMinute.pricing.totalAmount, 1.5);
});

test('live receipt withholds a total for incomplete dates, invalid quantities, capacity, or removed services', () => {
  const input = { venue: { ...venue, pricePerHour: 125.5 }, services: [{ id: 'music', price: 10 }], startsAt: start, endsAt: end, guests: 50, quantities: {} };
  for (const changes of [{ startsAt: '' }, { endsAt: start }, { guests: 101 }, { quantities: { music: '' } }, { quantities: { music: 100001 } }, { quantities: { removed: 1 } }]) {
    const receipt = bookingEstimate({ ...input, ...changes });
    assert.ok(receipt.issue);
    assert.equal(receipt.pricing.totalAmount, null);
  }
  const empty = bookingEstimate({ ...input, startsAt: '', endsAt: '' });
  assert.equal(empty.pricing.rental.amount, null);
  assert.deepEqual(empty.pricing.services, []);
  const maximum = bookingEstimate({ ...input, quantities: { music: 100000 } });
  assert.equal(maximum.pricing.totalAmount, 1000313.75);
});

test('next reservation is chronological and excludes cancelled, completed, and ended orders', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  const orders = [
    { id: 'later', status: 'confirmed', startsAt: '2026-12-01T10:00:00Z', endsAt: '2026-12-01T12:00:00Z' },
    { id: 'cancelled', status: 'cancelled', startsAt: '2026-10-12T10:00:00Z', endsAt: '2026-10-12T12:00:00Z' },
    { id: 'ended', status: 'confirmed', startsAt: '2026-10-01T10:00:00Z', endsAt: '2026-10-01T12:00:00Z' },
    { id: 'pending', status: 'pending', startsAt: '2026-11-01T10:00:00Z', endsAt: '2026-11-01T12:00:00Z' },
  ];
  assert.equal(nextOrder(orders, now).id, 'pending');
  assert.equal(cancellable({ status: 'confirmed' }), false);
  assert.equal(cancellable({ status: 'pending' }), true);
  assert.equal(activeOrder({ status: 'completed' }), false);
});

test('API rejects validation and booking conflicts instead of treating them as success', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Venue occupied.' }), { status: 409 });
    await assert.rejects(request('/orders', { method: 'POST', body: {} }), error => error instanceof ApiError && error.status === 409 && error.message === 'Venue occupied.');
    globalThis.fetch = async () => new Response(JSON.stringify({ errors: { Guests: ['Invalid guest count.'] } }), { status: 400 });
    await assert.rejects(request('/orders'), /Invalid guest count/);
  } finally { globalThis.fetch = previous; }
});

test('API accepts no-content mutations and preserves aborted requests', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await request('/premises/example', { method: 'DELETE' }), null);
    globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError'); };
    await assert.rejects(request('/premises'), error => error.name === 'AbortError');
  } finally { globalThis.fetch = previous; }
});

test('expired sessions notify the app and cannot return account data', async () => {
  const previousFetch = globalThis.fetch, previousWindow = globalThis.window;
  let event;
  try {
    globalThis.window = { dispatchEvent: value => { event = value; } };
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(request('/users/me', { token: 'expired' }), error => error.status === 401);
    assert.equal(event.type, 'session-expired');
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; }
});

test('network errors provide a retryable explanation', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(request('/orders'), error => error.status === 0 && error.message.includes('Unable to connect'));
  } finally { globalThis.fetch = previous; }
});

test('booking boundaries accept maximums and reject unsafe numbers and excessive periods', () => {
  const from = `${year}-01-01T00:00`, to = `${year + 1}-01-01T00:00`;
  const maximumVenue = { id: 'maximum', capacity: 100000 };
  const selections = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`service-${i}`, 100000]));
  // Use an exact elapsed duration rather than assuming the year is not a leap year.
  const exactEnd = new Date(new Date(from).getTime() + 365 * 86400000).toISOString();
  const payload = bookingPayload(maximumVenue, from, exactEnd, 100000, selections);
  assert.equal(payload.services.length, 100);
  assert.equal(payload.guests, 100000);
  assert.throws(() => bookingPayload(maximumVenue, from, exactEnd, 1, { ...selections, extra: 1 }), /100 services/);
  assert.throws(() => bookingPayload(maximumVenue, from, new Date(new Date(exactEnd).getTime() + 60000).toISOString(), 1, {}), /365 days/);
  for (const value of ['', ' ', 0, -1, 1.5, 100001, 1e20, Infinity, NaN]) {
    assert.throws(() => bookingPayload(maximumVenue, from, to, value, {}));
    assert.throws(() => bookingPayload(maximumVenue, start, end, 1, { service: value }));
  }
});

test('malformed successful responses cannot masquerade as saved records', async () => {
  const previous = globalThis.fetch;
  try {
    for (const body of ['', '<html>Proxy error</html>', 'null', '"OK"', '42']) {
      globalThis.fetch = async () => new Response(body, { status: 200 });
      await assert.rejects(request('/users/me'), /unreadable response/);
    }
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => { throw new TypeError('Connection lost'); } });
    await assert.rejects(request('/orders', { method: 'POST', body: {} }), /Refresh before retrying/);
  } finally { globalThis.fetch = previous; }
});

test('timeouts release stalled requests without automatically repeating mutations', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (_, { signal }) => {
      calls++;
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    };
    await assert.rejects(request('/orders', { method: 'POST', body: {}, timeoutMs: 10 }), error => error.status === 0 && /took too long/.test(error.message));
    assert.equal(calls, 1);
    const controller = new AbortController();
    const pending = request('/orders', { signal: controller.signal, timeoutMs: 1000 });
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
  } finally { globalThis.fetch = previous; }
});

test('permission, rate-limit and unavailable-server responses remain actionable', async () => {
  const previous = globalThis.fetch;
  try {
    for (const [status, message] of [[401, /email or password is incorrect/], [403, /access/], [429, /wait a minute/], [503, /Try again/]]) {
      globalThis.fetch = async () => new Response('upstream unavailable', { status });
      await assert.rejects(request('/orders'), error => error.status === status && message.test(error.message));
    }
  } finally { globalThis.fetch = previous; }
});

test('10,000 generated invalid quantities are rejected and valid integers preserved', () => {
  for (let i = 0; i < 10000; i++) {
    const quantity = (i * 7919) % 100000 + 1;
    assert.equal(bookingPayload(venue, start, end, 100, { unit: quantity }).services[0].quantity, quantity);
    assert.throws(() => bookingPayload(venue, start, end, 100, { unit: quantity + 0.25 }), /whole numbers/);
  }
});

test('pagination covers every record exactly once and clamps after filters or deletion', () => {
  const records = Array.from({ length: 2000 }, (_, id) => ({ id }));
  const collected = [];
  for (let page = 1; page <= 80; page++) collected.push(...pageWindow(records, page, 25).items);
  assert.deepEqual(collected, records);
  const filtered = pageWindow(records.slice(0, 26), 80, 25);
  assert.deepEqual([filtered.page, filtered.pages, filtered.start, filtered.end], [2, 2, 26, 26]);
  assert.equal(filtered.items[0].id, 25);
  assert.deepEqual(pageWindow([], 80, 25).items, []);
  assert.equal(pageWindow([], 80, 25).page, 1);
});

test('service discovery combines categories, descriptions, sorting and persistent selections', () => {
  const services = [
    { id: 'food', name: 'Buffet', category: 'FoodPreparation', description: 'Vegetarian servings', price: 80 },
    { id: 'music', name: 'DJ', category: 'Entertainment', description: 'Evening party', price: 500 },
    { id: 'custom', name: 'Quiet room', category: 'Accessibility', description: null, price: 0 },
  ];
  const quantities = { music: 2, food: 80 };
  assert.deepEqual(filterServices(services, { search: ' catering ' }).map(s => s.id), ['food']);
  assert.deepEqual(filterServices(services, { search: 'vegetarian' }).map(s => s.id), ['food']);
  assert.deepEqual(filterServices(services, { category: 'Entertainment', quantities }).map(s => s.id), ['music']);
  assert.deepEqual(filterServices(services, { selectedOnly: true, quantities, sort: 'price-desc' }).map(s => s.id), ['music', 'food']);
  assert.deepEqual(filterServices(services, { sort: 'price-asc' }).map(s => s.id), ['custom', 'food', 'music']);
  assert.equal(serviceCategoryName('Accessibility'), 'Accessibility');
  assert.deepEqual(quantities, { music: 2, food: 80 });
  assert.deepEqual(services.map(s => s.id), ['food', 'music', 'custom']);
});

test('invoice lifecycle uses scoped routes and repeats payment keys without sending a client amount', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return new Response(JSON.stringify({ status: 'issued' })); };
    await api.invoices.get('demo-token', 'order/one');
    await api.invoices.generate('demo-token', 'order/one');
    await api.invoices.deliver('demo-token', 'order/one');
    await api.invoices.pay('demo-token', 'order/one', 'same-key', 'declined', 'invoice-one');
    await api.invoices.pay('demo-token', 'order/one', 'same-key', 'success', 'invoice-one');
    assert.ok(calls[0].url.endsWith('/orders/order%2Fone/invoice'));
    assert.deepEqual(calls.map(call => call.method), ['GET', 'POST', 'POST', 'POST', 'POST']);
    assert.deepEqual(JSON.parse(calls[3].body), { idempotencyKey: 'same-key', outcome: 'declined', invoiceId: 'invoice-one' });
    assert.deepEqual(JSON.parse(calls[4].body), { idempotencyKey: 'same-key', outcome: 'success', invoiceId: 'invoice-one' });
    assert.equal(calls[4].headers.Authorization, 'Bearer demo-token');
    assert.equal(Object.hasOwn(JSON.parse(calls[4].body), 'amount'), false);
  } finally { globalThis.fetch = previous; }
});

test('booking changes and execution actions send scoped revision preconditions', async () => {
  const previous = globalThis.fetch, calls = [];
  try {
    globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return new Response('{}'); };
    await api.changes.quote('token', 'order/one', { booking: {}, expectedRevision: 2 });
    await api.changes.create('token', 'order/one', { booking: {}, expectedRevision: 2, expectedTotal: 150 });
    await api.changes.review('token', 'order/one', 'change/one', { approve: true, note: 'Confirmed' });
    await api.execution.save('token', 'order/one', { expectedVersion: 3, tasks: [] });
    await api.execution.finalize('token', 'order/one', 4);
    await api.execution.dispatch('token', 'order/one', 5);
    await api.briefs.update('token', 'brief/one', 'acknowledged');
    assert.ok(calls[0].url.endsWith('/orders/order%2Fone/changes/quote'));
    assert.equal(JSON.parse(calls[1].body).expectedTotal, 150);
    assert.ok(calls[2].url.endsWith('/orders/order%2Fone/changes/change%2Fone/review'));
    assert.deepEqual(JSON.parse(calls[4].body), { expectedVersion: 4 });
    assert.deepEqual(JSON.parse(calls[5].body), { expectedVersion: 5 });
    assert.ok(calls[6].url.endsWith('/staff/briefs/brief%2Fone'));
    assert.equal(calls[6].method, 'PATCH');
  } finally { globalThis.fetch = previous; }
});

test('execution inputs preserve seconds and stay inside microsecond rental boundaries', () => {
  const start = new Date(executionInput('2027-01-03T22:30:15.123456Z'));
  const end = new Date(executionInput('2027-01-04T01:00:45.654321Z', 'end'));
  assert.equal(start.toISOString(), '2027-01-03T22:30:15.124Z');
  assert.equal(end.toISOString(), '2027-01-04T01:00:45.654Z');
  assert.equal(new Date(executionInput('2027-01-03T22:30:15.123Z')).toISOString(), '2027-01-03T22:30:15.123Z');
  assert.equal(executionInput('invalid'), '');
});

test('staff progress respects withdrawn briefs and actual activity start times', () => {
  const brief = { status: 'sent', supersededAt: null, details: { taskStartsAt: '2027-01-01T10:00:00Z' } };
  assert.equal(nextBriefStatus(brief), 'acknowledged');
  assert.equal(nextBriefStatus({ ...brief, status: 'acknowledged' }), 'in-progress');
  assert.equal(nextBriefStatus({ ...brief, status: 'in-progress' }), 'completed');
  assert.equal(nextBriefStatus({ ...brief, status: 'completed' }), null);
  assert.equal(nextBriefStatus({ ...brief, supersededAt: '2026-12-01T10:00:00Z' }), null);
  assert.equal(canStartBrief(brief, new Date('2027-01-01T09:59:59Z')), false);
  assert.equal(canStartBrief(brief, new Date('2027-01-01T10:00:00Z')), true);
});

test('demo checkout formats test cards and validates successful and declined samples', () => {
  const now = new Date(2026, 9, 27);
  assert.equal(formatDemoCardNumber('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(formatDemoExpiry('1127'), '11/27');
  for (const outcome of ['success', 'declined']) {
    const details = demoCardExample(outcome, now);
    assert.deepEqual(validateDemoPayment(details, now), { errors: {}, outcome });
  }
  const currentMonth = { ...demoCardExample('success', now), expiry: '10/26' };
  assert.equal(validateDemoPayment(currentMonth, now).outcome, 'success');
});

test('demo checkout rejects incomplete details, expired dates, and cards outside the demo allowlist', () => {
  const now = new Date(2026, 9, 27), details = demoCardExample('success', now);
  const empty = validateDemoPayment({ cardholderName: '', cardNumber: '', expiry: '', securityCode: '' }, now);
  assert.deepEqual(Object.keys(empty.errors), ['cardholderName', 'cardNumber', 'expiry', 'securityCode']);
  assert.equal(empty.outcome, null);
  for (const [field, values] of Object.entries({ cardholderName: [' ', 'A', 'a'.repeat(101)],
    cardNumber: ['4111 1111 1111 1111', '4242 4242 4242', '4242 4242 4242 42421'],
    expiry: ['09/26', '12/25', '00/27', '13/27', '1027'], securityCode: ['12', '1234', 'a12'] })) {
    for (const value of values) {
      const result = validateDemoPayment({ ...details, [field]: value }, now);
      assert.ok(result.errors[field], field);
      assert.equal(result.outcome, null);
    }
  }
  assert.equal(validateDemoPayment({ ...details, cardholderName: 'a'.repeat(100) }, now).outcome, 'success');
});
