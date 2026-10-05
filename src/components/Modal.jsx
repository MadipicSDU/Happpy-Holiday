import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, footer, busy = false, wide = false }) {
  const ref = useRef(null), titleId = useId(), closeRef = useRef(onClose), busyRef = useRef(busy);
  closeRef.current = onClose; busyRef.current = busy;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    const root = document.getElementById('root'), wasInert = root?.inert;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...ref.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
    (focusable()[0] || ref.current).focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busyRef.current) closeRef.current(); }
      if (event.key === 'Tab') {
        const elements = focusable(), first = elements[0], last = elements.at(-1);
        if (!first) { event.preventDefault(); ref.current.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { if (root) root.inert = wasInert; document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); if (previous?.isConnected) previous.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return createPortal(<div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={ref} className={`modal-content ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="modal-header"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={20} /></button></header>
      <div className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}
    </section>
  </div>, document.body);
}
