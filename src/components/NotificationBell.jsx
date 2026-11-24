import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { relative } from '../utils';

// Bell in the top bar: unread count, a short list of what changed, each item opens the order.
export default function NotificationBell({ items, onOpen, onReadAll, onClear, onPanelOpen }) {
  const [open, setOpen] = useState(false), ref = useRef(null);
  const unread = items.filter(item => !item.read).length;
  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const key = event => { if (event.key === 'Escape') { setOpen(false); ref.current?.querySelector('.bell-button')?.focus(); } };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className="bell" ref={ref}>
    <button type="button" className="icon-button bell-button" aria-expanded={open} aria-haspopup="true" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications" onClick={() => { if (!open) onPanelOpen?.(); setOpen(value => !value); }}>
      <Bell size={18} aria-hidden="true" />{unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}</button>
    {open && <section className="bell-panel" aria-label="Notifications">
      <header><strong>Notifications</strong>{unread > 0 && <button type="button" className="text-button" onClick={onReadAll}><CheckCheck size={15} aria-hidden="true" />Mark all as read</button>}</header>
      {items.length ? <ul>{items.map(item => <li key={item.id} className={`bell-item tone-${item.tone} ${item.read ? '' : 'is-unread'}`}>
        <button type="button" onClick={() => { setOpen(false); onOpen(item); }}><span className="bell-dot" aria-hidden="true" /><span><strong>{item.title}</strong><span>{item.detail}</span><small>{relative(item.at)}{item.read ? '' : ' · new'}</small></span></button></li>)}</ul>
        : <p className="bell-empty">No notifications yet. You will see here when something changes in your bookings.</p>}
      {items.length > 0 && <footer><button type="button" className="text-button" onClick={onClear}><X size={14} aria-hidden="true" />Clear all</button></footer>}
    </section>}
  </div>;
}
