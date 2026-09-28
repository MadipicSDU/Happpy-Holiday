import React, { useState, useMemo } from 'react';
import { Search, Mail, Phone, Building, CalendarCheck } from 'lucide-react';
import Modal from '../components/Modal';

export default function MyClients({ clients, showToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  const handleOpenProfile = (client) => {
    setSelectedClient(client);
    setIsProfileOpen(true);
  };

  return (
    <div className="my-clients-page">
      <div className="table-header-controls">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">My Clients</h1>
          <p className="page-subtitle">Maintain relationships, review booking histories, and access client documentation.</p>
        </div>

        <div className="search-input-wrapper">
          <Search size={15} className="search-icon-inside" />
          <input 
            type="text" 
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Email Address</th>
              <th>Phone Number</th>
              <th>Total Bookings</th>
              <th>Last Booking</th>
              <th style={{ textAlign: 'right', paddingRight: '28px' }}>Profile</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id}>
                <td className="client-name-cell">{client.name}</td>
                <td>{client.email}</td>
                <td>{client.phone}</td>
                <td>{client.totalBookings}</td>
                <td>{client.lastBooking}</td>
                <td>
                  <div className="table-actions-cell">
                    <button 
                      className="btn-table-action btn-table-view"
                      onClick={() => handleOpenProfile(client)}
                    >
                      View Profile
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                  No clients matching "{searchQuery}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Client Profile Modal */}
      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title={`Client Dossier - ${selectedClient?.name}`}
        footer={
          <>
            <button 
              className="btn-outline-neutral" 
              onClick={() => {
                showToast(`Contact email copied to clipboard`);
                navigator.clipboard?.writeText(selectedClient?.email);
              }}
            >
              Copy Email
            </button>
            <button className="btn-solid-primary" onClick={() => setIsProfileOpen(false)}>
              Close Profile
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '9999px',
              background: '#dbeafe',
              color: '#1d4ed8',
              fontSize: '18px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {selectedClient?.name.charAt(0)}
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{selectedClient?.name}</h4>
              <p style={{ color: '#64748b' }}>{selectedClient?.company || 'Private Host'}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Direct Email</div>
              <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '4px' }}>{selectedClient?.email}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Phone Contact</div>
              <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '4px' }}>{selectedClient?.phone}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Total Reservations</div>
              <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '16px', marginTop: '4px' }}>
                {selectedClient?.totalBookings} Completed
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Most Recent Event</div>
              <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '4px' }}>{selectedClient?.lastBooking}</div>
            </div>
          </div>

          {selectedClient?.notes && (
            <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ color: '#1e40af', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>Client Preferences & Notes</div>
              <div style={{ color: '#1e3a8a', fontSize: '13px' }}>{selectedClient?.notes}</div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
