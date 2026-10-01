import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Home as HomeIcon, Briefcase } from 'lucide-react';
import Modal from '../components/Modal';

export default function AdminDashboard({ token, showToast, venues, setVenues, services, setServices }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit States
  const [editingVenue, setEditingVenue] = useState(null);
  const [isAddingVenue, setIsAddingVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({ name: '', description: '', address: '', rawCapacity: '', rawPrice: '', imageUrl: '' });

  const [editingService, setEditingService] = useState(null);
  const [isAddingService, setIsAddingService] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', category: 'Decoration', price: '' });

  const [editingStaff, setEditingStaff] = useState(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'manager', phone: '' });

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

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await api.auth.createStaff(token, newStaff.name, newStaff.email, newStaff.password, newStaff.role, newStaff.phone);
      showToast('Staff member created successfully', 'success');
      setIsAddingStaff(false);
      setNewStaff({ name: '', email: '', password: '', role: 'manager', phone: '' });
      loadStaff();
    } catch (err) {
      showToast('Failed to create staff', 'error');
    }
  };

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
        price: `$${created.pricePerHour}/hr`,
        rawPrice: created.pricePerHour,
        imageUrl: created.imageUrl || null,
        image: created.imageUrl || 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop'
      }]);
      showToast('Venue created successfully', 'success');
      setIsAddingVenue(false);
      setNewVenue({ name: '', description: '', address: '', rawCapacity: '', rawPrice: '' });
    } catch (err) {
      showToast('Failed to create venue', 'error');
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
        capacity: `${editingVenue.rawCapacity} Guests`,
        rawCapacity: editingVenue.rawCapacity,
        price: `$${editingVenue.rawPrice}/hr`,
        rawPrice: editingVenue.rawPrice,
        imageUrl: editingVenue.imageUrl || null,
        image: editingVenue.imageUrl || v.image
      } : v));
      showToast('Venue updated successfully', 'success');
      setEditingVenue(null);
    } catch (err) {
      showToast('Failed to update venue', 'error');
    }
  };

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
      showToast('Failed to create service', 'error');
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
      showToast('Failed to update service', 'error');
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
      showToast('Staff updated successfully', 'success');
      setEditingStaff(null);
    } catch (err) {
      showToast('Failed to update staff', 'error');
    }
  };

  return (
    <div className="my-clients-page">
      <div className="table-header-controls">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Manage spaces and staff accounts.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Venues Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingLeft: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HomeIcon size={20} color="#0f172a" />
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>Manage Spaces</h2>
            </div>
            <button className="btn-solid-primary" onClick={() => setIsAddingVenue(true)} style={{ padding: '6px 14px', fontSize: '13px' }}>
              + Add Space
            </button>
          </div>
          <div className="table-card">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Space Name</th>
                  <th>Capacity</th>
                  <th>Price/hr</th>
                  <th style={{ textAlign: 'right', paddingRight: '28px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map(v => (
                  <tr key={v.id}>
                    <td className="client-name-cell">{v.name}</td>
                    <td>{v.capacity}</td>
                    <td>{v.price}</td>
                    <td>
                      <div className="table-actions-cell">
                        <button className="btn-table-action btn-table-view" onClick={() => setEditingVenue({...v})}>
                          Edit Space
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Services Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingLeft: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={20} color="#0f172a" />
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>Manage Additional Services</h2>
            </div>
            <button className="btn-solid-primary" onClick={() => setIsAddingService(true)} style={{ padding: '6px 14px', fontSize: '13px' }}>
              + Add Service
            </button>
          </div>
          <div className="table-card">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'right', paddingRight: '28px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.id}>
                    <td className="client-name-cell">{s.name}</td>
                    <td>{s.category}</td>
                    <td>${s.price.toFixed(2)}</td>
                    <td>
                      <div className="table-actions-cell">
                        <button className="btn-table-action btn-table-view" onClick={() => setEditingService({...s})}>
                          Edit Service
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Staff Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingLeft: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="#0f172a" />
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>Manage Managers & Admins</h2>
            </div>
            <button className="btn-solid-primary" onClick={() => setIsAddingStaff(true)} style={{ padding: '6px 14px', fontSize: '13px' }}>
              + Add Staff
            </button>
          </div>
          <div className="table-card">
            {loading ? <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>Loading staff...</div> : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right', paddingRight: '28px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td className="client-name-cell">{s.name}</td>
                      <td>{s.email}</td>
                      <td><span className={`status-badge ${s.role === 'admin' ? 'confirmed' : 'awaiting-payment'}`}>{s.role}</span></td>
                      <td>
                        <div className="table-actions-cell">
                          <button className="btn-table-action btn-table-view" onClick={() => setEditingStaff({...s})}>
                            Edit Role
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Edit Venue Modal */}
      {editingVenue && (
        <Modal title="Edit Space" isOpen={true} onClose={() => setEditingVenue(null)}>
          <form onSubmit={handleUpdateVenue}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" className="form-control" value={editingVenue.name} onChange={e => setEditingVenue({...editingVenue, name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={editingVenue.description} onChange={e => setEditingVenue({...editingVenue, description: e.target.value})} rows={3} required />
            </div>
            <div className="form-group">
              <label>Photo URL (Optional)</label>
              <input type="url" className="form-control" value={editingVenue.imageUrl || ''} onChange={e => setEditingVenue({...editingVenue, imageUrl: e.target.value})} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" className="form-control" value={editingVenue.address || ''} onChange={e => setEditingVenue({...editingVenue, address: e.target.value})} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" className="form-control" value={editingVenue.rawCapacity} onChange={e => setEditingVenue({...editingVenue, rawCapacity: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Price per Hour</label>
                <input type="number" className="form-control" value={editingVenue.rawPrice} onChange={e => setEditingVenue({...editingVenue, rawPrice: e.target.value})} required />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setEditingVenue(null)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <Modal title="Edit Staff" isOpen={true} onClose={() => setEditingStaff(null)}>
          <form onSubmit={handleUpdateStaff}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" className="form-control" value={editingStaff.name} onChange={e => setEditingStaff({...editingStaff, name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="form-control" value={editingStaff.email} onChange={e => setEditingStaff({...editingStaff, email: e.target.value})} required pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" title="Please enter a valid email address (e.g. name@domain.com)" />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-control" value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value})} required>
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

      {/* Add Venue Modal */}
      {isAddingVenue && (
        <Modal title="Add New Space" isOpen={true} onClose={() => setIsAddingVenue(false)}>
          <form onSubmit={handleCreateVenue}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" className="form-control" value={newVenue.name} onChange={e => setNewVenue({...newVenue, name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={newVenue.description} onChange={e => setNewVenue({...newVenue, description: e.target.value})} rows={3} required />
            </div>
            <div className="form-group">
              <label>Photo URL (Optional)</label>
              <input type="url" className="form-control" value={newVenue.imageUrl || ''} onChange={e => setNewVenue({...newVenue, imageUrl: e.target.value})} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" className="form-control" value={newVenue.address || ''} onChange={e => setNewVenue({...newVenue, address: e.target.value})} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" className="form-control" value={newVenue.rawCapacity} onChange={e => setNewVenue({...newVenue, rawCapacity: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Price per Hour</label>
                <input type="number" className="form-control" value={newVenue.rawPrice} onChange={e => setNewVenue({...newVenue, rawPrice: e.target.value})} required />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setIsAddingVenue(false)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Create Space</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <Modal title="Edit Service" isOpen={true} onClose={() => setEditingService(null)}>
          <form onSubmit={handleUpdateService}>
            <div className="form-group">
              <label>Service Name</label>
              <input type="text" className="form-control" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={editingService.description} onChange={e => setEditingService({...editingService, description: e.target.value})} rows={2} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={editingService.category} onChange={e => setEditingService({...editingService, category: e.target.value})} required>
                  <option value="Decoration">Decoration</option>
                  <option value="Catering">Catering</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Photography">Photography</option>
                  <option value="Logistics">Logistics</option>
                </select>
              </div>
              <div className="form-group">
                <label>Price (Flat Rate)</label>
                <input type="number" className="form-control" value={editingService.price} onChange={e => setEditingService({...editingService, price: e.target.value})} required />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setEditingService(null)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Service Modal */}
      {isAddingService && (
        <Modal title="Add New Service" isOpen={true} onClose={() => setIsAddingService(false)}>
          <form onSubmit={handleCreateService}>
            <div className="form-group">
              <label>Service Name</label>
              <input type="text" className="form-control" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} rows={2} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={newService.category} onChange={e => setNewService({...newService, category: e.target.value})} required>
                  <option value="Decoration">Decoration</option>
                  <option value="Catering">Catering</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Photography">Photography</option>
                  <option value="Logistics">Logistics</option>
                </select>
              </div>
              <div className="form-group">
                <label>Price (Flat Rate)</label>
                <input type="number" className="form-control" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} required />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setIsAddingService(false)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Create Service</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <Modal title="Create New Staff" isOpen={true} onClose={() => setIsAddingStaff(false)}>
          <form onSubmit={handleCreateStaff}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" className="form-control" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} required minLength={2} />
            </div>
            <div className="form-group">
              <label>Phone Number (Optional)</label>
              <input type="tel" className="form-control" value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="form-control" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} required pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" title="Please enter a valid email address (e.g. name@domain.com)" />
            </div>
            <div className="form-group">
              <label>Temporary Password</label>
              <input type="password" className="form-control" value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} required minLength={8} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-control" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} required>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn-outline-primary" onClick={() => setIsAddingStaff(false)}>Cancel</button>
              <button type="submit" className="btn-solid-primary">Create Staff</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
