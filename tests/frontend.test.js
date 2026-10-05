import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingPayload, nextOrder, cancellable, activeOrder } from '../src/utils.js';
import { request, ApiError } from '../src/services/api.js';
import { pageWindow } from '../src/usePagination.js';

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
