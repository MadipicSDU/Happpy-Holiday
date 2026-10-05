import usePagination from '../usePagination';
import React, { useState } from 'react';
import { Search, Copy, Users, Mail, Phone } from 'lucide-react';
import Modal from '../components/Modal';
import { PageHeading, EmptyState, Pagination } from '../components/UI';
export default function MyClients({ clients, showToast, isAdmin }) {
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(null), [copying, setCopying] = useState(false);
  const filtered = clients.filter(client => `${client.name} ${client.email} ${client.phone || ''}`.toLowerCase().includes(search.toLowerCase()));
  const pagination = usePagination(filtered, search);
  const copy = async () => {
    setCopying(true);
    try { await navigator.clipboard.writeText(selected.email); showToast('Email address copied.'); } catch { showToast('Could not copy the email address. Select and copy it manually.', 'error'); } finally { setCopying(false); }
  };
  return <><PageHeading eyebrow="Client directory" title={isAdmin ? 'Clients' : 'Assigned clients'} description="Find contact information and view booking counts for your clients." />
    <div className="list-toolbar"><label className="search-field"><Search size={17} /><input aria-label="Search clients" placeholder="Search by name, email, or phone" value={search} onChange={event => setSearch(event.target.value)} /></label><span className="small muted">{filtered.length} clients</span></div>
    <div className="table-card"><table><caption className="sr-only">Client contacts and booking counts</caption><thead><tr><th>Client</th><th>Contact</th><th>Total bookings</th><th>Latest booking date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pagination.items.map(client => <tr key={client.id}><td><div className="person-cell"><span className="avatar">{client.name?.slice(0, 1).toUpperCase()}</span><strong>{client.name}</strong></div></td><td><span>{client.email}</span><span className="cell-secondary">{client.phone && client.phone !== '—' ? client.phone : 'Phone not provided'}</span></td><td>{client.totalBookings}</td><td>{client.lastBooking}</td><td><button className="button small-button secondary" onClick={() => setSelected(client)}>View profile</button></td></tr>)}</tbody></table>
    {!filtered.length && <EmptyState icon={Users} title={clients.length ? 'No matching clients' : 'No clients yet'} description={clients.length ? 'Try a different name, email, or phone number.' : 'Client details appear here when their orders are assigned.'} />}</div>
    <Pagination pagination={pagination} />
    <Modal isOpen={Boolean(selected)} title="Client profile" onClose={() => setSelected(null)} footer={<><button className="button secondary" onClick={() => setSelected(null)}>Close</button><button className="button primary" disabled={copying} onClick={copy}><Copy size={16} />{copying ? 'Copying…' : 'Copy email'}</button></>}>
      {selected && <><div className="person-heading"><span className="avatar large">{selected.name?.slice(0, 1).toUpperCase()}</span><h3>{selected.name}</h3></div><dl className="details-grid"><div><dt>Email address</dt><dd>{selected.email}</dd></div><div><dt>Phone number</dt><dd>{selected.phone && selected.phone !== '—' ? selected.phone : 'Not provided'}</dd></div><div><dt>Total bookings</dt><dd>{selected.totalBookings}</dd></div><div><dt>Latest booking date</dt><dd>{selected.lastBooking}</dd></div></dl><p className="small muted">Booking counts include all statuses{isAdmin ? '.' : ' for orders assigned to you.'}</p></>}
    </Modal>
  </>;
}
