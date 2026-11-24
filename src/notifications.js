// Change notifications without a push server: the app compares the latest orders with what this user last saw
// (kept per user in this browser) and turns every relevant difference into a notification.
import { money, statusNames } from './utils.js';

const MAX = 40;
const key = (kind, userId) => `hh-${kind}-${userId}`;
const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(name)) ?? fallback; } catch { return fallback; } };
const write = (name, value) => { try { localStorage.setItem(name, JSON.stringify(value)); } catch {} };

export const snapshotOf = orders => Object.fromEntries(orders.map(order => [order.id, {
  status: order.status, change: order.pendingChangeId || null, resolvedChange: order.latestChange?.id || null,
  paid: Number(order.paidAmount) || 0,
}]));

// role: 'client' sees what managers did; 'manager' / 'admin' see what clients did.
export function diffOrders(before, orders, role) {
  const staff = role !== 'client', events = [];
  const add = (order, title, detail, tab = 'details', tone = 'info') => events.push({ orderId: order.id, title, detail, tab, tone });
  for (const order of orders) {
    const old = before[order.id], who = order.client || 'A client', place = order.venue;
    if (!old) { if (staff) add(order, 'New booking', `${who} booked ${place}.`, 'details', 'action'); continue; }
    if (staff && order.pendingChangeId && old.change !== order.pendingChangeId) {
      add(order, 'Change requested', `${who} asked to change ${place}.`, 'changes', 'action');
    }
    const outcome = order.latestChange;
    // Older browser snapshots only tracked the pending ID. Avoid replaying old outcomes after upgrading.
    if (outcome && outcome.id !== old.resolvedChange && (old.resolvedChange !== undefined || outcome.id === old.change)) {
      if (staff && outcome.status === 'withdrawn') add(order, 'Change withdrawn', `${who} withdrew the request for ${place}.`, 'changes');
      if (!staff && outcome.status === 'approved') add(order, 'Change approved', `Your booking at ${place} was updated.`, 'changes', 'success');
      if (!staff && outcome.status === 'rejected') add(order, 'Change declined', `Your manager declined the change for ${place}. Your original booking stays.`, 'changes', 'warning');
      if (!staff && outcome.status === 'expired' && old.status === order.status) add(order, 'Change request expired', `The request for ${place} expired before it was approved.`, 'changes', 'warning');
    }
    if (old.status !== order.status) {
      const byMe = order.cancellation && (staff ? ['manager', 'admin'].includes(order.cancellation.role) : order.cancellation.role === 'client');
      if (order.status === 'cancelled') { if (!byMe) add(order, 'Booking cancelled', staff ? `${who} cancelled ${place}.` : `Your booking at ${place} was cancelled.`, 'details', 'warning'); }
      else if (order.status === 'expired') add(order, 'Unpaid booking expired', `The rental period for ${place} ended without a recorded payment.`, 'details', 'warning');
      else if (!staff && order.status === 'awaiting-payment') add(order, 'Invoice ready', `Pay ${money(Number(order.totalAmount) - (Number(order.paidAmount) || 0))} to confirm ${place}.`, 'payment', 'action');
      else if (!staff && order.status === 'confirmed') add(order, 'Booking confirmed', `${place} is confirmed.`, 'details', 'success');
      else if (!staff) add(order, 'Booking updated', `${place}: ${statusNames[old.status] || old.status} → ${statusNames[order.status] || order.status}.`);
    }
    if (staff && (Number(order.paidAmount) || 0) > old.paid) add(order, 'Payment received', `${who} paid ${money((Number(order.paidAmount) || 0) - old.paid)} for ${place}.`, 'invoice', 'success');
  }
  return events;
}

export function loadNotifications(userId) { return read(key('notes', userId), []); }
export function saveNotifications(userId, list) { write(key('notes', userId), list.slice(0, MAX)); }

// Returns the new notifications (already stored). The first visit only records a baseline.
export function checkForChanges(user, orders) {
  const seenKey = key('seen', user.id), before = read(seenKey, null), now = snapshotOf(orders);
  write(seenKey, now);
  if (!before) return [];
  const at = new Date().toISOString();
  const fresh = diffOrders(before, orders, user.role).map(event => ({ ...event, id: crypto.randomUUID(), at, read: false }));
  if (fresh.length) saveNotifications(user.id, [...fresh, ...loadNotifications(user.id)]);
  return fresh;
}
