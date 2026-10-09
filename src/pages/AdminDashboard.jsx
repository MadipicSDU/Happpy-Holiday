import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Users, Home as HomeIcon, Briefcase, Plus, Search, Trash2, Edit3, Sparkles, Image as ImageIcon, AlertTriangle, DollarSign } from 'lucide-react';
import Modal from '../components/Modal';

const CATEGORY_STYLES = {
  'Catering': { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  'FoodPreparation': { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  'Decoration': { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' },
  'EquipmentRental': { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' },
  'Equipment & Lighting': { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' },
  'Entertainment': { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  'Entertainment & Music': { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  'Photography': { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  'Photography & Video': { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  'Logistics': { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  'Staff & Logistics': { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
};

function formatCategory(cat = '') {
  if (cat === 'FoodPreparation') return 'Catering';
  if (cat === 'EquipmentRental') return 'Equipment & Lighting';
  return cat || 'General';
}

const PRESET_CATEGORIES = [
  'Catering',
  'Decoration',
  'Equipment & Lighting',
  'Entertainment & Music',
  'Photography & Video',
  'Staff & Logistics'
];

export default function AdminDashboard({ token, showToast, venues = [], setVenues, services = [], setServices }) {
  const [activeTab, setActiveTab] = useState('spaces'); // 'spaces' | 'services' | 'staff'
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [spacesSearch, setSpacesSearch] = useState('');
  const [servicesSearch, setServicesSearch] = useState('');
  const [servicesCatFilter, setServicesCatFilter] = useState('All');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('All');

  // Edit / Add States
  const [editingVenue, setEditingVenue] = useState(null);
  const [isAddingVenue, setIsAddingVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({ name: '', description: '', address: '', rawCapacity: '', rawPrice: '', imageUrl: '' });

  const [editingService, setEditingService] = useState(null);
  const [isAddingService, setIsAddingService] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', category: 'Decoration', price: '' });

  const [editingStaff, setEditingStaff] = useState(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'manager', phone: '' });

  // Delete Confirmation State
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'venue' | 'service' | 'staff', id: string, name: string }

  useEffect(() => {
    loadStaff();
  }, [token]);

  const loadStaff = () => {
    setLoading(true);
    api.users.getStaff(token)
      .then(setStaff)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Staff CRUD
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await api.auth.createStaff(token, newStaff.name, newStaff.email, newStaff.password, newStaff.role, newStaff.phone);
      showToast('Staff member created successfully', 'success');
      setIsAddingStaff(false);
      setNewStaff({ name: '', email: '', password: '', role: 'manager', phone: '' });
      loadStaff();
    } catch (err) {
      showToast(err.message || 'Failed to create staff', 'error');
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    try {
      const updated = await api.users.update(token, editingStaff.id, {
        name: editingStaff.name,
        email: editingStaff.email,
        role: editingStaff.role
      });
      setStaff(prev => prev.map(s => s.id === updated.id ? {
        ...s,
        name: updated.displayName,
        email: updated.email,
        role: updated.role
      } : s));
      showToast('Staff role updated successfully', 'success');
      setEditingStaff(null);
    } catch (err) {
      showToast(err.message || 'Failed to update staff', 'error');
    }
  };

  // Venue CRUD
  const handleCreateVenue = async (e) => {
    e.preventDefault();
    try {
      const created = await api.premises.create(token, {
        name: newVenue.name,
        description: newVenue.description,
        address: newVenue.address || 'N/A',
        capacity: Number(newVenue.rawCapacity),
        pricePerHour: Number(newVenue.rawPrice),
        imageUrl: newVenue.imageUrl || null
      });
      setVenues(prev => [...prev, {
        ...created,
        capacity: `${created.capacity} Guests`,
        rawCapacity: created.capacity,
        price: `${created.pricePerHour.toLocaleString()} ₸/hr`,
        rawPrice: created.pricePerHour,
        imageUrl: created.imageUrl || null,
        image: created.imageUrl || 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop'
      }]);
      showToast('Venue created successfully', 'success');
      setIsAddingVenue(false);
      setNewVenue({ name: '', description: '', address: '', rawCapacity: '', rawPrice: '', imageUrl: '' });
    } catch (err) {
      showToast(err.message || 'Failed to create venue', 'error');
    }
  };

  const handleUpdateVenue = async (e) => {
    e.preventDefault();
    try {
      await api.premises.update(token, editingVenue.id, {
        id: editingVenue.id,
        name: editingVenue.name,
        description: editingVenue.description,
        address: editingVenue.address || 'N/A',
        capacity: Number(editingVenue.rawCapacity),
        pricePerHour: Number(editingVenue.rawPrice),
        imageUrl: editingVenue.imageUrl || null
      });
      setVenues(prev => prev.map(v => v.id === editingVenue.id ? {
        ...v,
        name: editingVenue.name,
        description: editingVenue.description,
        address: editingVenue.address,
        capacity: `${editingVenue.rawCapacity} Guests`,
        rawCapacity: Number(editingVenue.rawCapacity),
        price: `${Number(editingVenue.rawPrice).toLocaleString()} ₸/hr`,
        rawPrice: Number(editingVenue.rawPrice),
        imageUrl: editingVenue.imageUrl || null,
        image: editingVenue.imageUrl || v.image
      } : v));
      showToast('Venue updated successfully', 'success');
      setEditingVenue(null);
    } catch (err) {
      showToast(err.message || 'Failed to update venue', 'error');
    }
  };

  // Service CRUD
  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      const created = await api.services.create(token, {
        name: newService.name,
        description: newService.description,
        category: newService.category,
        price: Number(newService.price)
      });
      setServices(prev => [...prev, created]);
      showToast('Service created successfully', 'success');
      setIsAddingService(false);
      setNewService({ name: '', description: '', category: 'Decoration', price: '' });
    } catch (err) {
      showToast(err.message || 'Failed to create service', 'error');
    }
  };

  const handleUpdateService = async (e) => {
    e.preventDefault();
    try {
      await api.services.update(token, editingService.id, {
        id: editingService.id,
        name: editingService.name,
        description: editingService.description,
        category: editingService.category,
        price: Number(editingService.price)
      });
      setServices(prev => prev.map(s => s.id === editingService.id ? {
        ...s,
        name: editingService.name,
        description: editingService.description,
        category: editingService.category,
        price: Number(editingService.price)
      } : s));
      showToast('Service updated successfully', 'success');
      setEditingService(null);
    } catch (err) {
      showToast(err.message || 'Failed to update service', 'error');
    }
  };

  // Delete Action Dispatcher
  const handleExecuteDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;

    try {
      if (type === 'venue') {
        await api.premises.delete(token, id);
        setVenues(prev => prev.filter(v => v.id !== id));
        showToast('Space deleted successfully', 'success');
      } else if (type === 'service') {
        await api.services.delete(token, id);
        setServices(prev => prev.filter(s => s.id !== id));
        showToast('Service deleted successfully', 'success');
      } else if (type === 'staff') {
        await api.users.delete(token, id);
        setStaff(prev => prev.filter(s => s.id !== id));
        showToast('Staff member removed successfully', 'success');
      }
    } catch (err) {
      showToast('Failed to delete item: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setConfirmDelete(null);
    }
  };

  // Filtered lists
  const filteredVenues = useMemo(() => {
    return venues.filter(v => {
      const q = spacesSearch.toLowerCase();
      return !q || v.name?.toLowerCase().includes(q) || v.address?.toLowerCase().includes(q);
    });
  }, [venues, spacesSearch]);

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const q = servicesSearch.toLowerCase();
      const matchSearch = !q || s.name?.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
      const matchCat = servicesCatFilter === 'All' || formatCategory(s.category) === servicesCatFilter;
      return matchSearch && matchCat;
    });
  }, [services, servicesSearch, servicesCatFilter]);

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const q = staffSearch.toLowerCase();
      const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
      const matchRole = staffRoleFilter === 'All' || s.role === staffRoleFilter.toLowerCase();
      return matchSearch && matchRole;
    });
  }, [staff, staffSearch, staffRoleFilter]);

  const serviceCategories = useMemo(() => {
    const set = new Set(PRESET_CATEGORIES);
    services.forEach(s => set.add(formatCategory(s.category)));
    return ['All', ...Array.from(set)];
  }, [services]);

  // Quick stats
  const avgVenueRate = useMemo(() => {
    if (!venues.length) return 0;
    const total = venues.reduce((sum, v) => sum + (v.rawPrice || 0), 0);
    return Math.round(total / venues.length);
  }, [venues]);

  return (
    <div className="admin-page-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px 60px' }}>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Administrator Portal</h1>
        <p className="page-subtitle">Configure venues, catalog event services, and manage staff access privileges.</p>
      </div>

      {/* KPI Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <HomeIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Active Venues</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{venues.length} Spaces</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fdf4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
            <Briefcase size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Catalog Services</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{services.length} Services</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Staff & Managers</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{staff.length} Members</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Average Rate</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{avgVenueRate.toLocaleString()} ₸/hr</div>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveTab('spaces')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'spaces' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '12px 18px',
            fontSize: '14px',
            fontWeight: '600',
            color: activeTab === 'spaces' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
            transition: 'all 0.15s ease'
          }}
        >
          <HomeIcon size={18} />
          <span>Spaces & Venues</span>
          <span style={{ fontSize: '11px', background: activeTab === 'spaces' ? '#dbeafe' : '#f1f5f9', color: activeTab === 'spaces' ? '#1d4ed8' : '#64748b', padding: '2px 8px', borderRadius: '12px' }}>
            {venues.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'services' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '12px 18px',
            fontSize: '14px',
            fontWeight: '600',
            color: activeTab === 'services' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
            transition: 'all 0.15s ease'
          }}
        >
          <Briefcase size={18} />
          <span>Additional Services</span>
          <span style={{ fontSize: '11px', background: activeTab === 'services' ? '#dbeafe' : '#f1f5f9', color: activeTab === 'services' ? '#1d4ed8' : '#64748b', padding: '2px 8px', borderRadius: '12px' }}>
            {services.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'staff' ? '3px solid #2563eb' : '3px solid transparent',
            padding: '12px 18px',
            fontSize: '14px',
            fontWeight: '600',
            color: activeTab === 'staff' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={18} />
          <span>Team & Staff</span>
          <span style={{ fontSize: '11px', background: activeTab === 'staff' ? '#dbeafe' : '#f1f5f9', color: activeTab === 'staff' ? '#1d4ed8' : '#64748b', padding: '2px 8px', borderRadius: '12px' }}>
            {staff.length}
          </span>
        </button>
      </div>

      {/* ─────────────────── TAB 1: SPACES ─────────────────── */}
      {activeTab === 'spaces' && (
        <section>
          {/* Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search spaces by name or address..."
                value={spacesSearch}
                onChange={e => setSpacesSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#fff'
                }}
              />
            </div>

            <button
              className="btn-solid-primary"
              onClick={() => setIsAddingVenue(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
            >
              <Plus size={16} />
              <span>Add New Space</span>
            </button>
          </div>

          {/* Venues Table */}
          <div className="table-card">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Photo</th>
                  <th>Space Details</th>
                  <th>Capacity</th>
                  <th>Price Rate (₸)</th>
                  <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVenues.map(v => (
                  <tr key={v.id}>
                    <td>
                      <img
                        src={v.image}
                        alt={v.name}
                        style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                      />
                    </td>
                    <td>
                      <div className="client-name-cell" style={{ fontWeight: '600', color: '#0f172a' }}>{v.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{v.address || 'No address specified'}</div>
                    </td>
                    <td>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' }}>
                        {v.capacity}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>
                        {v.rawPrice ? `${v.rawPrice.toLocaleString()} ₸/hr` : v.price}
                      </strong>
                    </td>
                    <td>
                      <div className="table-actions-cell">
                        <button
                          className="btn-table-action btn-table-view"
                          onClick={() => setEditingVenue({ ...v })}
                          title="Edit Space"
                        >
                          <Edit3 size={14} style={{ marginRight: '4px' }} />
                          Edit
                        </button>
                        <button
                          className="btn-table-action"
                          onClick={() => setConfirmDelete({ type: 'venue', id: v.id, name: v.name })}
                          style={{ color: '#dc2626', borderColor: '#fee2e2', background: '#fef2f2' }}
                          title="Delete Space"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredVenues.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No spaces match your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─────────────────── TAB 2: SERVICES ─────────────────── */}
      {activeTab === 'services' && (
        <section>
          {/* Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={servicesSearch}
                  onChange={e => setServicesSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#fff'
                  }}
                />
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {serviceCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setServicesCatFilter(cat)}
                    style={{
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: servicesCatFilter === cat ? '#2563eb' : '#f1f5f9',
                      color: servicesCatFilter === cat ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-solid-primary"
              onClick={() => setIsAddingService(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
            >
              <Plus size={16} />
              <span>Add New Service</span>
            </button>
          </div>

          {/* Services Table */}
          <div className="table-card">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Service Name & Description</th>
                  <th>Category</th>
                  <th>Flat Price (₸)</th>
                  <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map(s => {
                  const catLabel = formatCategory(s.category);
                  const tagStyle = CATEGORY_STYLES[s.category] || CATEGORY_STYLES[catLabel] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="client-name-cell" style={{ fontWeight: '600', color: '#0f172a' }}>{s.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', maxWidth: '440px' }}>
                          {s.description || 'No description provided'}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: tagStyle.bg,
                          color: tagStyle.text,
                          border: `1px solid ${tagStyle.border}`
                        }}>
                          {catLabel}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                          {s.price?.toLocaleString()} ₸
                        </strong>
                      </td>
                      <td>
                        <div className="table-actions-cell">
                          <button
                            className="btn-table-action btn-table-view"
                            onClick={() => setEditingService({ ...s })}
                            title="Edit Service"
                          >
                            <Edit3 size={14} style={{ marginRight: '4px' }} />
                            Edit
                          </button>
                          <button
                            className="btn-table-action"
                            onClick={() => setConfirmDelete({ type: 'service', id: s.id, name: s.name })}
                            style={{ color: '#dc2626', borderColor: '#fee2e2', background: '#fef2f2' }}
                            title="Delete Service"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredServices.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No event services match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─────────────────── TAB 3: STAFF ─────────────────── */}
      {activeTab === 'staff' && (
        <section>
          {/* Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#fff'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {['All', 'Manager', 'Admin'].map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setStaffRoleFilter(role)}
                    style={{
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: staffRoleFilter === role ? '#2563eb' : '#f1f5f9',
                      color: staffRoleFilter === role ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-solid-primary"
              onClick={() => setIsAddingStaff(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
            >
              <Plus size={16} />
              <span>Add Staff Member</span>
            </button>
          </div>

          {/* Staff Table */}
          <div className="table-card">
            {loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Loading staff members...</div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Email Address</th>
                    <th>Assigned Role</th>
                    <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: s.role === 'admin' ? '#fef3c7' : '#dbeafe',
                            color: s.role === 'admin' ? '#92400e' : '#1e40af',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '13px'
                          }}>
                            {s.name ? s.name[0].toUpperCase() : 'U'}
                          </div>
                          <span className="client-name-cell" style={{ fontWeight: '600', color: '#0f172a' }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ color: '#475569' }}>{s.email}</td>
                      <td>
                        <span className={`status-badge ${s.role === 'admin' ? 'confirmed' : 'awaiting-payment'}`} style={{ textTransform: 'capitalize' }}>
                          {s.role}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions-cell">
                          <button
                            className="btn-table-action btn-table-view"
                            onClick={() => setEditingStaff({ ...s })}
                            title="Edit Role"
                          >
                            <Edit3 size={14} style={{ marginRight: '4px' }} />
                            Edit Role
                          </button>
                          <button
                            className="btn-table-action"
                            onClick={() => setConfirmDelete({ type: 'staff', id: s.id, name: s.name })}
                            style={{ color: '#dc2626', borderColor: '#fee2e2', background: '#fef2f2' }}
                            title="Remove Member"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No staff members matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* 1. Add Venue Modal */}
      {isAddingVenue && (
        <Modal title="Add New Space" isOpen={true} onClose={() => setIsAddingVenue(false)}>
          <form onSubmit={handleCreateVenue}>
            <div className="form-group">
              <label>Space Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Sapphire Banquet Hall"
                value={newVenue.name}
                onChange={e => setNewVenue({ ...newVenue, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                placeholder="Describe the architectural style, amenities, lighting, and ambiance..."
                value={newVenue.description}
                onChange={e => setNewVenue({ ...newVenue, description: e.target.value })}
                rows={3}
                required
              />
            </div>

            <div className="form-group">
              <label>Photo URL (Optional)</label>
              <input
                type="url"
                className="form-control"
                value={newVenue.imageUrl || ''}
                onChange={e => setNewVenue({ ...newVenue, imageUrl: e.target.value })}
                placeholder="https://images.unsplash.com/..."
              />
              {newVenue.imageUrl && (
                <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', height: '120px', border: '1px solid #e2e8f0' }}>
                  <img src={newVenue.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Physical Address</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 15 Dostyk Ave, Almaty"
                value={newVenue.address}
                onChange={e => setNewVenue({ ...newVenue, address: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Capacity (Guests)</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="e.g. 200"
                  value={newVenue.rawCapacity}
                  onChange={e => setNewVenue({ ...newVenue, rawCapacity: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Price per Hour (₸)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="e.g. 25000"
                  value={newVenue.rawPrice}
                  onChange={e => setNewVenue({ ...newVenue, rawPrice: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setIsAddingVenue(false)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Create Space</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Edit Venue Modal */}
      {editingVenue && (
        <Modal title="Edit Space" isOpen={true} onClose={() => setEditingVenue(null)}>
          <form onSubmit={handleUpdateVenue}>
            <div className="form-group">
              <label>Space Name</label>
              <input
                type="text"
                className="form-control"
                value={editingVenue.name}
                onChange={e => setEditingVenue({ ...editingVenue, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                value={editingVenue.description}
                onChange={e => setEditingVenue({ ...editingVenue, description: e.target.value })}
                rows={3}
                required
              />
            </div>

            <div className="form-group">
              <label>Photo URL (Optional)</label>
              <input
                type="url"
                className="form-control"
                value={editingVenue.imageUrl || ''}
                onChange={e => setEditingVenue({ ...editingVenue, imageUrl: e.target.value })}
                placeholder="https://..."
              />
              {(editingVenue.imageUrl || editingVenue.image) && (
                <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', height: '120px', border: '1px solid #e2e8f0' }}>
                  <img src={editingVenue.imageUrl || editingVenue.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Physical Address</label>
              <input
                type="text"
                className="form-control"
                value={editingVenue.address || ''}
                onChange={e => setEditingVenue({ ...editingVenue, address: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Capacity (Guests)</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={editingVenue.rawCapacity}
                  onChange={e => setEditingVenue({ ...editingVenue, rawCapacity: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Price per Hour (₸)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={editingVenue.rawPrice}
                  onChange={e => setEditingVenue({ ...editingVenue, rawPrice: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setEditingVenue(null)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Add Service Modal (With Live Client Preview!) */}
      {isAddingService && (
        <Modal title="Add New Event Service" isOpen={true} onClose={() => setIsAddingService(false)}>
          <form onSubmit={handleCreateService}>
            <div className="form-group">
              <label>Service Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Signature Cocktail Bar & Bartender"
                value={newService.name}
                onChange={e => setNewService({ ...newService, name: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Category</label>
                <select
                  className="form-control"
                  value={newService.category}
                  onChange={e => setNewService({ ...newService, category: e.target.value })}
                  required
                >
                  {PRESET_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Flat Price (₸)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="e.g. 15000"
                  value={newService.price}
                  onChange={e => setNewService({ ...newService, price: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description & Scope</label>
              <textarea
                className="form-control"
                placeholder="Specify what this service covers for the customer during the event..."
                value={newService.description}
                onChange={e => setNewService({ ...newService, description: e.target.value })}
                rows={3}
                required
              />
            </div>

            {/* Live Client View Preview */}
            <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '8px' }}>
                Client Booking Preview
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1.5px solid #2563eb',
                background: '#eff6ff'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                      {newService.name || 'Service Name Preview'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '1px 8px',
                      borderRadius: '10px',
                      background: CATEGORY_STYLES[newService.category]?.bg || '#f1f5f9',
                      color: CATEGORY_STYLES[newService.category]?.text || '#475569',
                      border: `1px solid ${CATEGORY_STYLES[newService.category]?.border || '#e2e8f0'}`
                    }}>
                      {formatCategory(newService.category)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {newService.description || 'Description of service scope will appear here...'}
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '14px' }}>
                  +{Number(newService.price || 0).toLocaleString()} ₸
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setIsAddingService(false)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Create Service</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Edit Service Modal (With Live Client Preview!) */}
      {editingService && (
        <Modal title="Edit Event Service" isOpen={true} onClose={() => setEditingService(null)}>
          <form onSubmit={handleUpdateService}>
            <div className="form-group">
              <label>Service Name</label>
              <input
                type="text"
                className="form-control"
                value={editingService.name}
                onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Category</label>
                <select
                  className="form-control"
                  value={formatCategory(editingService.category)}
                  onChange={e => setEditingService({ ...editingService, category: e.target.value })}
                  required
                >
                  {PRESET_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Flat Price (₸)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={editingService.price}
                  onChange={e => setEditingService({ ...editingService, price: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description & Scope</label>
              <textarea
                className="form-control"
                value={editingService.description || ''}
                onChange={e => setEditingService({ ...editingService, description: e.target.value })}
                rows={3}
                required
              />
            </div>

            {/* Live Client View Preview */}
            <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '8px' }}>
                Client Booking Preview
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1.5px solid #2563eb',
                background: '#eff6ff'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                      {editingService.name || 'Service Name Preview'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '1px 8px',
                      borderRadius: '10px',
                      background: CATEGORY_STYLES[editingService.category]?.bg || '#f1f5f9',
                      color: CATEGORY_STYLES[editingService.category]?.text || '#475569',
                      border: `1px solid ${CATEGORY_STYLES[editingService.category]?.border || '#e2e8f0'}`
                    }}>
                      {formatCategory(editingService.category)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {editingService.description || 'Description of service scope will appear here...'}
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '14px' }}>
                  +{Number(editingService.price || 0).toLocaleString()} ₸
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setEditingService(null)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Edit Staff Modal */}
      {editingStaff && (
        <Modal title="Edit Staff Role" isOpen={true} onClose={() => setEditingStaff(null)}>
          <form onSubmit={handleUpdateStaff}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                className="form-control"
                value={editingStaff.name}
                onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={editingStaff.email}
                onChange={e => setEditingStaff({ ...editingStaff, email: e.target.value })}
                required
                pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                className="form-control"
                value={editingStaff.role}
                onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value })}
                required
              >
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setEditingStaff(null)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Add Staff Modal */}
      {isAddingStaff && (
        <Modal title="Create New Staff Member" isOpen={true} onClose={() => setIsAddingStaff(false)}>
          <form onSubmit={handleCreateStaff}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Dana Saparova"
                value={newStaff.name}
                onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                required
                minLength={2}
              />
            </div>
            <div className="form-group">
              <label>Phone Number (Optional)</label>
              <input
                type="tel"
                className="form-control"
                placeholder="+7 (707) 123-4567"
                value={newStaff.phone}
                onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="staff@happyholiday.com"
                value={newStaff.email}
                onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                required
                pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
              />
            </div>
            <div className="form-group">
              <label>Temporary Password (min 8 chars)</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={newStaff.password}
                onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                className="form-control"
                value={newStaff.role}
                onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                required
              >
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setIsAddingStaff(false)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Create Staff Member</button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Safe Delete Confirmation Modal */}
      {confirmDelete && (
        <Modal title="Confirm Deletion" isOpen={true} onClose={() => setConfirmDelete(null)}>
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              Are you sure you want to delete this {confirmDelete.type}?
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              You are about to permanently delete <strong>"{confirmDelete.name}"</strong>. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                className="btn-outline-primary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-solid-primary"
                onClick={handleExecuteDelete}
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
