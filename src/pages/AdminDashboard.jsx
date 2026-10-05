import usePagination from '../usePagination';
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit3, Trash2, Building2, Users, Package, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import { PageHeading, ErrorNotice, EmptyState, Loading, Pagination } from '../components/UI';
import { api } from '../services/api';
import { money, categoryName } from '../utils';

const initial = {
  venues: { name: '', address: '', description: '', capacity: 100, pricePerHour: '', imageUrl: '' },
  services: { name: '', category: 'FoodPreparation', description: '', price: '' },
  staff: { name: '', email: '', password: '', phone: '', role: 'manager', clientLimit: 10 },
};
const names = { venues: 'venue', services: 'service', staff: 'staff account' };
export default function AdminDashboard({ token, showToast, venues, services, onRefresh, currentUser }) {
  const [tab, setTab] = useState('venues'), [search, setSearch] = useState(''), [staff, setStaff] = useState([]);
  const [sorts, setSorts] = useState({ venues: 'name-asc', services: 'name-asc' });
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
  const filtered = records.filter(record => `${record.name} ${record.address || ''} ${record.email || ''} ${record.category || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
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
  const pagination = usePagination(filtered, `${tab}|${search}|${sort}`);
  const open = record => {
    setEditor({ type: tab, record }); setError('');
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
          capacity: Number(form.capacity), pricePerHour: Number(form.pricePerHour), imageUrl: (form.imageUrl || '').trim() || null };
        if (record) await api.premises.update(token, record.id, body); else await api.premises.create(token, body);
      } else if (kind === 'services') {
        const body = { ...(record ? { id: record.id } : {}), name: form.name.trim(), description: (form.description || '').trim() || null, category: form.category.trim(), price: Number(form.price) };
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
  return <><PageHeading eyebrow="Administration" title="Manage your catalogue" description="Maintain event spaces, service rates, and staff accounts." />
    <div className="admin-summary">{[{ key: 'venues', icon: Building2, label: 'Venues', count: venues.length }, { key: 'services', icon: Package, label: 'Services', count: services.length }, { key: 'staff', icon: Users, label: 'Staff accounts', count: staffLoading ? '…' : staff.length }].map(({ key, icon: Icon, label, count }) => <button key={key} className={`admin-summary-card ${tab === key ? 'selected' : ''}`} aria-pressed={tab === key} onClick={() => { setTab(key); setSearch(''); }}><Icon size={21} /><span>{label}<strong>{count}</strong></span></button>)}</div>
    <div className="list-toolbar admin-list-toolbar"><label className="search-field"><Search size={17} /><input aria-label={`Search ${tab}`} placeholder={`Search ${tab}`} value={search} onChange={event => setSearch(event.target.value)} /></label><button className="button primary" onClick={() => open(null)}><Plus size={17} />Add {names[tab]}</button></div>
    <div className="admin-results-bar"><span className="small muted" role="status">{filtered.length} {tab === 'staff' ? 'staff accounts' : tab}</span>{tab !== 'staff' && <label className="admin-sort"><span>Sort by</span><select aria-label={`Sort ${tab}`} value={sort} onChange={event => setSorts(previous => ({ ...previous, [tab]: event.target.value }))}><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>{tab === 'venues' ? <><option value="capacity-asc">Capacity: low to high</option><option value="capacity-desc">Capacity: high to low</option></> : <option value="category">Category: A–Z</option>}</select></label>}</div>
    {tab === 'staff' && <ErrorNotice message={staffError} onRetry={() => setStaffVersion(value => value + 1)} />}
    {tab === 'staff' && staffLoading ? <Loading label="Loading staff accounts…" /> : <div className="table-card"><table><caption className="sr-only">{tab} administration</caption><thead><tr><th>{tab === 'staff' ? 'Name & email' : 'Name & details'}</th><th>{tab === 'venues' ? 'Capacity' : tab === 'services' ? 'Category' : 'Role'}</th><th>{tab === 'staff' ? 'Active client limit' : 'Rate'}</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pagination.items.map(record => <tr key={record.id} className={lastEdited?.type === tab && lastEdited.id === record.id ? 'last-edited-row' : undefined}><td><strong>{record.name}</strong>{lastEdited?.type === tab && lastEdited.id === record.id && <span className="last-edited-label">Last edited</span>}<span className="cell-secondary">{record.address || record.email || record.description || 'No description'}</span></td><td>{tab === 'venues' ? `${record.capacity} guests` : tab === 'services' ? categoryName(record.category) : record.role === 'admin' ? 'Administrator' : 'Manager'}</td><td>{tab === 'venues' ? `${money(record.pricePerHour)} / hour` : tab === 'services' ? `${money(record.price)} / unit` : record.role === 'manager' ? `${record.clientLimit} clients` : 'Not applicable'}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${record.name}`} onClick={() => open(record)}><Edit3 size={17} /></button><button className="icon-button destructive" aria-label={`Delete ${record.name}`} disabled={tab === 'staff' && record.id === currentUser.id} onClick={() => { setDeletion({ type: tab, record }); setError(''); }}><Trash2 size={17} /></button></div></td></tr>)}</tbody></table>{!filtered.length && !staffError && <EmptyState title="No records to display" description="Add a record or try a different search." />}</div>}
    <Pagination pagination={pagination} />
    <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={`${editor?.record ? 'Edit' : 'Add'} ${names[editor?.type] || 'record'}`} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button className="button primary" form="admin-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      <ErrorNotice message={error} />{editor && <form id="admin-form" onSubmit={submit}><fieldset disabled={busy}><label className="field">{editor.type === 'staff' ? 'Full name' : 'Name'}<input required minLength={2} maxLength={editor.type === 'venues' ? 200 : 100} {...field('name')} /></label>
      {editor.type === 'venues' && <><label className="field">Address<input required minLength={5} maxLength={500} {...field('address')} /></label><div className="form-row"><label className="field">Guest capacity<input type="number" required min={1} max={100000} step={1} {...field('capacity')} /></label><label className="field">Hourly rate (KZT)<input type="number" required min={0} max={1000000} step="0.01" {...field('pricePerHour')} /></label></div><label className="field">Venue photo URL <span className="optional">Optional</span><input type="url" maxLength={2000} {...field('imageUrl')} placeholder="https://…" /><span className="field-help">Use a photo of this venue. A neutral illustration appears when no photo is provided.</span></label></>}
      {editor.type === 'services' && <><label className="field">Category<select required {...field('category')}><option value="FoodPreparation">Food preparation</option><option value="EquipmentRental">Equipment rental</option>{form.category && !['FoodPreparation', 'EquipmentRental'].includes(form.category) && <option value={form.category}>{categoryName(form.category)}</option>}</select></label><label className="field">Price per unit (KZT)<input type="number" required min={0} max={1000000} step="0.01" {...field('price')} /></label></>}
      {editor.type !== 'staff' && <label className="field">Description <span className="optional">Optional</span><textarea rows={3} maxLength={1000} {...field('description')} /></label>}
      {editor.type === 'staff' && <><label className="field">Email address<input type="email" autoComplete="off" required maxLength={254} {...field('email')} /></label>
      {!editor.record && <><label className="field">Initial password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} {...field('password')} /><span className="field-help">At least 8 characters.</span></label><label className="field">Phone <span className="optional">Optional</span><input type="tel" maxLength={20} {...field('phone')} /></label></>}
      <label className="field">Role<select required {...field('role')}><option value="manager">Manager</option><option value="admin">Administrator</option></select></label>
      {form.role === 'manager' && <label className="field">Active client limit<input type="number" required min={1} max={1000} step={1} {...field('clientLimit')} /><span className="field-help">Maximum distinct clients with active orders. An existing client can have multiple bookings.</span></label>}
      {editor.record && <p className="small muted">Role changes are blocked when an account has booking history. Changing a role requires the staff member to sign in again.</p>}</>}
      </fieldset></form>}
    </Modal>
    <Modal isOpen={Boolean(deletion)} onClose={() => setDeletion(null)} title="Delete this record?" busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setDeletion(null)}>Keep record</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete record'}</button></>}><ErrorNotice message={error} /><h3>{deletion?.record.name}</h3><p className="dialog-copy">This action cannot be undone. Records referenced by booking history cannot be deleted.</p></Modal>
  </>;
}
