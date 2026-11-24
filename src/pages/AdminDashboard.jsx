import usePagination from '../usePagination';
import { serviceCategories, newCategories, categoryGroups } from '../serviceCatalogue';
import { ServiceIcon } from '../components/ServicePicker';
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit3, Trash2, Building2, Users, Package, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import CancellationPolicy from '../components/CancellationPolicy';
import { PageHeading, ErrorNotice, EmptyState, Loading, Pagination, Req, RequiredNote } from '../components/UI';
import { api } from '../services/api';
import { money, categoryName } from '../utils';

const initial = {
  venues: { name: '', address: '', description: '', capacity: 100, pricePerHour: '', promotionPercent: 0, imageUrl: '' },
  services: { name: '', category: 'FoodPreparation', description: '', price: '', concurrentCapacity: '' },
  staff: { name: '', email: '', password: '', phone: '', role: 'manager', clientLimit: 10 },
};
const names = { venues: 'venue', services: 'service', staff: 'staff account' };
export default function AdminDashboard({ token, showToast, venues, services, onRefresh, currentUser }) {
  const [tab, setTab] = useState('venues'), [search, setSearch] = useState(''), [staff, setStaff] = useState([]);
  const [sorts, setSorts] = useState({ venues: 'name-asc', services: 'name-asc' });
  const [customCategory, setCustomCategory] = useState(false), [categoryFilter, setCategoryFilter] = useState('');
  const highlightKey = `last-edited-record:${currentUser.id}`;
  const [lastEdited, setLastEdited] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(highlightKey)) || null; } catch { return null; }
  });
  const [staffLoading, setStaffLoading] = useState(true), [staffError, setStaffError] = useState(''), [staffVersion, setStaffVersion] = useState(0);
  const [editor, setEditor] = useState(null), [form, setForm] = useState({}), [error, setError] = useState(''), [busy, setBusy] = useState(false), [deletion, setDeletion] = useState(null);
  useEffect(() => {
    const abort = new AbortController(); setStaffLoading(true); setStaffError('');
    api.users.getStaff(token, abort.signal).then(setStaff).catch(err => { if (err.name !== 'AbortError') setStaffError(err.message); }).finally(() => { if (!abort.signal.aborted) setStaffLoading(false); });
    return () => abort.abort();
  }, [token, staffVersion]);
  const records = tab === 'venues' ? venues : tab === 'services' ? services : staff;
  const sort = sorts[tab] || 'name-asc';
  const filtered = records.filter(record => `${record.name} ${record.address || ''} ${record.email || ''} ${record.category || ''}`.toLowerCase().includes(search.toLowerCase()) && (tab !== 'services' || !categoryFilter || (categoryFilter === '__new' ? newCategories.includes(record.category) : record.category === categoryFilter))).sort((a, b) => {
    const nameOrder = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    if (sort === 'name-desc') return -nameOrder;
    if (sort.startsWith('price-')) {
      const difference = Number(tab === 'venues' ? a.pricePerHour : a.price) - Number(tab === 'venues' ? b.pricePerHour : b.price);
      return (sort === 'price-desc' ? -difference : difference) || nameOrder;
    }
    if (sort.startsWith('capacity-')) return (sort === 'capacity-desc' ? b.capacity - a.capacity : a.capacity - b.capacity) || nameOrder;
    if (sort === 'category') return categoryName(a.category).localeCompare(categoryName(b.category)) || nameOrder;
    return nameOrder;
  });
  const pagination = usePagination(filtered, `${tab}|${search}|${sort}|${categoryFilter}`);
  const usedCategories = serviceCategories.filter(([key]) => services.some(service => service.category === key));
  const open = record => {
    setEditor({ type: tab, record }); setError('');
    setCustomCategory(Boolean(record && tab === 'services' && !serviceCategories.some(([key]) => key === record.category)));
    setForm(record ? { ...initial[tab], ...record } : { ...initial[tab] });
  };
  const field = key => ({ value: form[key] ?? '', onChange: event => setForm(previous => ({ ...previous, [key]: event.target.value })) });
  const saved = () => { onRefresh(); setStaffVersion(value => value + 1); };
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const kind = editor.type, record = editor.record;
      if (kind === 'venues') {
        const body = { ...(record ? { id: record.id } : {}), name: form.name.trim(), address: form.address.trim(), description: (form.description || '').trim() || null,
          capacity: Number(form.capacity), pricePerHour: Number(form.pricePerHour), promotionPercent: Number(form.promotionPercent || 0), imageUrl: (form.imageUrl || '').trim() || null };
        if (record) await api.premises.update(token, record.id, body); else await api.premises.create(token, body);
      } else if (kind === 'services') {
        const body = { ...(record ? { id: record.id } : {}), name: form.name.trim(), description: (form.description || '').trim() || null, category: form.category.trim(), price: Number(form.price), concurrentCapacity: form.concurrentCapacity === '' || form.concurrentCapacity === null ? null : Number(form.concurrentCapacity) };
        if (record) await api.services.update(token, record.id, body); else await api.services.create(token, body);
      } else if (record) {
        await api.users.update(token, record.id, { name: form.name.trim(), email: form.email.trim(), role: form.role, clientLimit: Number(form.clientLimit) });
      } else {
        await api.auth.createStaff(token, { displayName: form.name.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() || null, role: form.role, clientLimit: Number(form.clientLimit) });
      }
      if (record) {
        const edited = { type: kind, id: record.id };
        setLastEdited(edited);
        try { sessionStorage.setItem(highlightKey, JSON.stringify(edited)); } catch {}
      }
      showToast(`${kind === 'staff' ? 'Staff account' : kind === 'venues' ? 'Venue' : 'Service'} ${record ? 'updated' : 'created'}.`); setEditor(null); saved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const endpoint = deletion.type === 'venues' ? api.premises : deletion.type === 'services' ? api.services : api.users;
      await endpoint.delete(token, deletion.record.id);
      showToast('Record deleted.'); setDeletion(null); saved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const [policyOpen, setPolicyOpen] = useState(false);
  return <><PageHeading eyebrow="Administration" title="Manage your catalogue" description="Maintain event spaces, service rates, and staff accounts."
    action={<button type="button" className="button secondary" onClick={() => setPolicyOpen(true)}>Cancellation policy</button>} />
    <Modal isOpen={policyOpen} title="Cancellation policy" onClose={() => setPolicyOpen(false)}>
      {policyOpen && <CancellationPolicy token={token} />}
    </Modal>
    <div className="dash-tabs admin-tabs" role="tablist" aria-label="What to manage">{[{ key: 'venues', icon: Building2, label: 'Venues', count: venues.length }, { key: 'services', icon: Package, label: 'Services', count: services.length }, { key: 'staff', icon: Users, label: 'Staff & managers', count: staffLoading ? '…' : staff.length }].map(({ key, icon: Icon, label, count }) => <button key={key} role="tab" aria-selected={tab === key} className={`dash-tab ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setSearch(''); }}><Icon size={16} aria-hidden="true" />{label}<span>{count}</span></button>)}</div>
    <p className="admin-tab-help small muted">{tab === 'venues' ? 'Add, edit or remove event spaces. Changes to the rate apply to new quotes only.' : tab === 'services' ? 'Add, edit or remove services and their price per unit.' : 'Create and edit staff, manager and administrator accounts. Managers have a client limit.'}</p>
    <div className="list-toolbar admin-list-toolbar"><label className="search-group"><span className="search-label">{`Search ${tab}`}</span><span className="search-field"><Search size={17} aria-hidden="true" /><input placeholder={`Search ${tab}`} value={search} onChange={event => setSearch(event.target.value)} /></span></label><button className="button primary" onClick={() => open(null)}><Plus size={17} />Add {names[tab]}</button></div>
    <div className="admin-results-bar"><span className="small muted" role="status">{filtered.length} {tab === 'staff' ? 'staff accounts' : tab}</span>{tab !== 'staff' && <label className="admin-sort"><span>Sort by</span><select aria-label={`Sort ${tab}`} value={sort} onChange={event => setSorts(previous => ({ ...previous, [tab]: event.target.value }))}><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>{tab === 'venues' ? <><option value="capacity-asc">Capacity: low to high</option><option value="capacity-desc">Capacity: high to low</option></> : <option value="category">Category: A–Z</option>}</select></label>}</div>
    {tab === 'staff' && <ErrorNotice message={staffError} onRetry={() => setStaffVersion(value => value + 1)} />}
    <div className={tab === 'services' ? 'catalog-layout' : ''}>{tab === 'services' && <aside className="category-rail" aria-label="Categories"><button type="button" className={!categoryFilter ? 'active' : ''} onClick={() => setCategoryFilter('')}>All services<span>{services.length}</span></button><button type="button" className={`is-new ${categoryFilter === '__new' ? 'active' : ''}`} onClick={() => setCategoryFilter('__new')}>New in Sprint 4<span>{services.filter(service => newCategories.includes(service.category)).length}</span></button>{categoryGroups.map(([groupLabel, keys]) => <div key={groupLabel} className="rail-group"><p>{groupLabel}</p>{keys.filter(key => services.some(service => service.category === key)).map(key => <button type="button" key={key} className={categoryFilter === key ? 'active' : ''} onClick={() => setCategoryFilter(key)}>{serviceCategories.find(([k]) => k === key)?.[1]}{newCategories.includes(key) && <em className="new-dot">new</em>}<span>{services.filter(service => service.category === key).length}</span></button>)}</div>)}</aside>}<div>
    {tab === 'services' ? <div className="service-card-grid admin-service-grid">{pagination.items.map(record => <article key={record.id} className={`service-tile ${lastEdited?.type === tab && lastEdited.id === record.id ? 'is-selected' : ''}`}><div className={`service-tile-art service-art-${record.category}`}><ServiceIcon category={record.category} /><span>{categoryName(record.category)}</span>{newCategories.includes(record.category) && <em className="new-badge">New category</em>}</div><div className="service-tile-body"><h3>{record.name}</h3>{lastEdited?.type === tab && lastEdited.id === record.id && <span className="last-edited-label">Last edited</span>}<p>{record.description || 'No description provided.'}</p><div className="service-tile-bottom"><div><strong>{money(record.price)}</strong><span>per unit</span></div><div className="row-actions"><button className="button secondary small-button" aria-label={`Edit ${record.name}`} onClick={() => open(record)}><Edit3 size={15} />Edit</button><button className="button danger-outline small-button" aria-label={`Delete ${record.name}`} onClick={() => { setDeletion({ type: tab, record }); setError(''); }}><Trash2 size={15} aria-hidden="true" />Delete</button></div></div></div></article>)}{!filtered.length && <EmptyState title="No services to display" description="Add a service or try a different search." />}</div> :tab === 'staff' && staffLoading ? <Loading label="Loading staff accounts…" /> : <div className="table-card"><table><caption className="sr-only">{tab} administration</caption><thead><tr><th>{tab === 'staff' ? 'Name & email' : 'Name & details'}</th><th>{tab === 'venues' ? 'Capacity' : tab === 'services' ? 'Category' : 'Role'}</th><th>{tab === 'staff' ? 'Active client limit' : 'Rate'}</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pagination.items.map(record => <tr key={record.id} className={lastEdited?.type === tab && lastEdited.id === record.id ? 'last-edited-row' : undefined}><td><strong>{record.name}</strong>{lastEdited?.type === tab && lastEdited.id === record.id && <span className="last-edited-label">Last edited</span>}<span className="cell-secondary">{record.address || record.email || record.description || 'No description'}</span></td><td>{tab === 'venues' ? `${record.capacity} guests` : tab === 'services' ? categoryName(record.category) : record.role === 'admin' ? 'Administrator' : record.role === 'staff' ? 'Service staff / performer' : 'Manager'}</td><td>{tab === 'venues' ? `${money(record.pricePerHour)} / hour` : tab === 'services' ? `${money(record.price)} / unit` : record.role === 'manager' ? `${record.clientLimit} clients` : 'Not applicable'}</td><td><div className="row-actions"><button className="button secondary small-button" aria-label={`Edit ${record.name}`} onClick={() => open(record)}><Edit3 size={15} aria-hidden="true" />Edit</button><button className="button danger-outline small-button" aria-label={`Delete ${record.name}`} disabled={tab === 'staff' && record.id === currentUser.id} title={tab === 'staff' && record.id === currentUser.id ? 'You cannot delete your own account' : undefined} onClick={() => { setDeletion({ type: tab, record }); setError(''); }}><Trash2 size={15} aria-hidden="true" />Delete</button></div></td></tr>)}</tbody></table>{!filtered.length && !staffError && <EmptyState title="No records to display" description="Add a record or try a different search." />}</div>}
    </div></div>
    <Pagination pagination={pagination} />
    <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={`${editor?.record ? 'Edit' : 'Add'} ${names[editor?.type] || 'record'}`} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button className="button primary" form="admin-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      <ErrorNotice message={error} />{editor && <form id="admin-form" onSubmit={submit}><fieldset disabled={busy}><RequiredNote /><label className="field"><span className="field-label">{editor.type === 'staff' ? 'Full name' : 'Name'}<Req /></span><input required minLength={2} maxLength={editor.type === 'venues' ? 200 : 100} {...field('name')} /></label>
      {editor.type === 'venues' && <><label className="field"><span className="field-label">Address<Req /></span><input required minLength={5} maxLength={500} {...field('address')} /></label><div className="form-row"><label className="field"><span className="field-label">Guest capacity<Req /></span><input type="number" required min={1} max={100000} step={1} {...field('capacity')} /></label><label className="field"><span className="field-label">Hourly rate (KZT)<Req /></span><input type="number" required min={0} max={1000000} step="0.01" {...field('pricePerHour')} /></label></div><label className="field"><span className="field-label">Rental promotion (%)<Req /></span><input type="number" min={0} max={50} step="0.01" required {...field('promotionPercent')} /><span className="field-help">0–50% off venue rental only. New quotes use this rate; existing bookings and invoices keep their stored prices.</span></label><label className="field">Venue photo URL <span className="optional">Optional</span><input type="url" maxLength={2000} {...field('imageUrl')} placeholder="https://…" /><span className="field-help">Use a photo of this venue. A neutral illustration appears when no photo is provided.</span></label></>}
      {editor.type === 'services' && <><label className="field"><span className="field-label">Category<Req /></span><select required value={customCategory ? '__custom' : form.category} onChange={event => { const custom = event.target.value === '__custom'; setCustomCategory(custom); setForm(previous => ({ ...previous, category: custom ? '' : event.target.value })); }}>{categoryGroups.map(([groupLabel, keys]) => <optgroup key={groupLabel} label={groupLabel}>{keys.map(key => <option key={key} value={key}>{serviceCategories.find(([k]) => k === key)?.[1] || key}{newCategories.includes(key) ? ' · new' : ''}</option>)}</optgroup>)}<optgroup label="Not listed"><option value="__custom">Custom category…</option></optgroup></select></label>{customCategory && <label className="field"><span className="field-label">Custom category name<Req /></span><input required minLength={2} maxLength={100} {...field('category')} placeholder="e.g. Childcare or accessibility support" /></label>}<label className="field">Concurrent service capacity <span className="optional">Optional</span><input type="number" min={1} max={100000} step={1} {...field('concurrentCapacity')} /><span className="field-help">Maximum units reserved at one time across bookings. Leave empty when no capacity limit is configured.</span></label><label className="field"><span className="field-label">Price per unit (KZT)<Req /></span><input type="number" required min={0} max={1000000} step="0.01" {...field('price')} /></label></>}
      {editor.type !== 'staff' && <label className="field">Description <span className="optional">Optional</span><textarea rows={3} maxLength={1000} {...field('description')} /></label>}
      {editor.type === 'staff' && <><label className="field"><span className="field-label">Email address<Req /></span><input type="email" autoComplete="off" required maxLength={254} {...field('email')} /></label>
      {!editor.record && <><label className="field"><span className="field-label">Initial password<Req /></span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} {...field('password')} /><span className="field-help">At least 8 characters.</span></label><label className="field">Phone <span className="optional">Optional</span><input type="tel" maxLength={20} {...field('phone')} /></label></>}
      <label className="field"><span className="field-label">Role<Req /></span><select required {...field('role')}><option value="manager">Manager</option><option value="admin">Administrator</option><option value="staff">Service staff / performer</option></select></label>
      {form.role === 'manager' && <label className="field"><span className="field-label">Active client limit<Req /></span><input type="number" required min={1} max={1000} step={1} {...field('clientLimit')} /><span className="field-help">Maximum distinct clients with active orders. An existing client can have multiple bookings.</span></label>}
      {editor.record && <p className="small muted">Role changes are blocked when an account has booking history. Changing a role requires the staff member to sign in again.</p>}</>}
      </fieldset></form>}
    </Modal>
    <Modal isOpen={Boolean(deletion)} onClose={() => setDeletion(null)} title="Delete this record?" busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setDeletion(null)}>Keep record</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete record'}</button></>}><ErrorNotice message={error} /><h3>{deletion?.record.name}</h3><p className="dialog-copy">This action cannot be undone. Records referenced by booking history cannot be deleted.</p></Modal>
  </>;
}
