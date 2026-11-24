import React from 'react';
import { CalendarDays, Clock, Users, Wallet, Hourglass, MapPin, User } from 'lucide-react';
import { Status } from './UI';
import { activeOrder, money, day, time, hours, deadline, shortRef, relative } from '../utils';

// Fixed left column of the order dialog (#2): the order you are working on never scrolls away or changes between tabs.
export default function OrderSummary({ order, staff }) {
  const due = Math.max(0, Number(order.totalAmount) - Number(order.paidAmount || 0)), dl = order.changeDeadline && deadline(order.changeDeadline);
  const live = activeOrder(order);
  return <div className="order-summary">
    <Status order={order} />
    <h3>{order.venue}</h3>
    <p className="order-summary-address"><MapPin size={14} />{order.address}</p>
    <dl>
      {staff && order.client && <div><dt><User size={15} />Client</dt><dd>{order.client}</dd></div>}
      <div><dt><CalendarDays size={15} />Date</dt><dd>{day(order.startsAt)}<small>{relative(order.startsAt)}</small></dd></div>
      <div><dt><Clock size={15} />Time</dt><dd>{time(order.startsAt)}–{time(order.endsAt)}<small>{hours(order)} hours</small></dd></div>
      <div><dt><Users size={15} />Guests</dt><dd>{order.guests}</dd></div>
      <div><dt><Wallet size={15} />Total</dt><dd>{money(order.totalAmount)}<small className={due > 0 && order.paidAmount > 0 ? 'is-amber' : ''}>{order.status === 'expired' ? 'Expired without payment' : order.paidAmount >= order.totalAmount && order.paidAmount > 0 ? 'Paid in full' : order.paidAmount > 0 ? `${money(due)} still due` : 'Not paid yet'}</small></dd></div>
      {live && dl && <div><dt><Hourglass size={15} />Changes</dt><dd><span className={`deadline-chip tone-${dl.tone}`}>{dl.label}</span></dd></div>}
    </dl>
    {order.pendingChangeId && <p className="order-summary-flag">{staff ? 'Client asked for a change' : 'Your change request is waiting for the manager'}</p>}
    <p className="order-summary-ref">Order {shortRef(order.id)}{order.revision > 1 ? ` · Revision ${order.revision}` : ''}</p>
  </div>;
}
