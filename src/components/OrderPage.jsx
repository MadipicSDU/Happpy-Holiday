import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';

// Variant B: an order opens as its own page (not a dialog). The left rail keeps the order facts and the
// section list in view; the right side shows one section at a time; actions sit in a sticky bar (#2).
export default function OrderPage({ isOpen, onClose, title, subtitle, summary, tabs, activeTab, onTabChange, footer, busy, backLabel = 'Back', children }) {
  // The order page gets its own browser-history entry, so the browser Back button returns to the list.
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return undefined;
    if (!window.history.state?.hhOrderPage) window.history.pushState({ ...(window.history.state || {}), hhOrderPage: true }, '');
    const back = () => closeRef.current();
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [isOpen]);
  const bodyRef = useRef(null), sectionRef = useRef(null), navigationId = useId();
  const tabId = id => `${navigationId}-tab-${id}`;
  const panelId = id => `${navigationId}-panel-${id}`;
  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0); }, [activeTab]);
  const openTab = (id, moveFocus) => {
    onTabChange?.(id);
    if (window.matchMedia('(max-width: 1100px)').matches) {
      requestAnimationFrame(() => {
        sectionRef.current?.scrollIntoView({ block: 'start' });
        if (moveFocus) bodyRef.current?.focus({ preventScroll: true });
      });
    }
  };
  const handleTabKey = event => {
    const buttons = [...event.currentTarget.querySelectorAll('[role="tab"]:enabled')];
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    const nextIndex = {
      ArrowUp: (index - 1 + buttons.length) % buttons.length,
      ArrowLeft: (index - 1 + buttons.length) % buttons.length,
      ArrowDown: (index + 1) % buttons.length,
      ArrowRight: (index + 1) % buttons.length,
      Home: 0,
      End: buttons.length - 1,
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    buttons[nextIndex].focus();
    onTabChange?.(buttons[nextIndex].dataset.section);
  };
  const selectedTab = tabs?.find(tab => tab.id === activeTab);
  const tabbable = selectedTab && !selectedTab.disabled ? selectedTab : tabs?.find(tab => !tab.disabled);
  const close = () => { if (window.history.state?.hhOrderPage) window.history.back(); else onClose(); };
  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.classList.add('has-order-page'); window.scrollTo(0, 0);
    const key = event => { if (event.key === 'Escape' && !busy && !document.querySelector('.modal-overlay')) close(); };
    document.addEventListener('keydown', key);
    return () => { document.body.classList.remove('has-order-page'); document.removeEventListener('keydown', key); };
  }, [isOpen, busy]);
  const host = typeof document !== 'undefined' && document.getElementById('main-content');
  if (!isOpen || !host) return null;
  return createPortal(<section className="order-page" aria-label={title}>
    <nav className="op-crumbs" aria-label="Breadcrumb"><button type="button" className="op-back" onClick={close} disabled={busy}><ArrowLeft size={16} />{backLabel}</button><span>/</span><strong>{title}</strong></nav>
    <div className="op-grid">
      <aside className="op-rail">
        {summary}
        {tabs && <nav className="op-nav" role="tablist" aria-label="Order sections" aria-orientation="vertical" onKeyDown={handleTabKey}>{tabs.map(tab => <button key={tab.id} id={tabId(tab.id)} data-section={tab.id} type="button" role="tab" aria-selected={tab.id === activeTab} aria-controls={panelId(tab.id)} tabIndex={tab.id === tabbable?.id ? 0 : -1} disabled={busy || tab.disabled} className={`op-nav-item ${tab.id === activeTab ? 'active' : ''}`} onClick={event => openTab(tab.id, event.detail === 0)}><span>{tab.label}</span>{tab.badge && <span className={`modal-tab-badge tone-${tab.badge.tone}`}>{tab.badge.label}</span>}</button>)}</nav>}
      </aside>
      <div className="op-main" ref={sectionRef}>
        <header className="op-head"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</header>
        <div className="op-body modal-body" ref={bodyRef} id={panelId(activeTab)} role="tabpanel" aria-labelledby={selectedTab ? tabId(activeTab) : undefined} tabIndex={0}>{children}</div>
        {tabs?.filter(tab => tab.id !== activeTab).map(tab => <div key={tab.id} id={panelId(tab.id)} role="tabpanel" aria-labelledby={tabId(tab.id)} hidden />)}
        {footer && <footer className="op-actions modal-footer">{footer}</footer>}
      </div>
    </div>
  </section>, host);
}
