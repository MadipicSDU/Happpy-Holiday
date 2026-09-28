import React, { useState, useMemo } from 'react';
import Modal from '../components/Modal';

export default function OrderQueue({ orders, onUpdateOrderStatus, showToast }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('confirmed');

  // Filter & sort
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    if (sortBy === 'date') {
      result.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    } else if (sortBy === 'id') {
      result.sort((a, b) => a.id.localeCompare(b.id));
    } else if (sortBy === 'client') {
      result.sort((a, b) => a.client.localeCompare(b.client));
    }

    return result;
  }, [orders, statusFilter, sortBy]);

  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const handleOpenStatusModal = (order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setIsStatusModalOpen(true);
  };

  const handleSaveStatus = () => {
    if (!selectedOrder) return;
    
    const labelMap = {
      'awaiting-payment': 'Awaiting Payment',
      'confirmed': 'Confirmed',
      'change-requested': 'Change Requested',
      'completed': 'Completed'
    };

    onUpdateOrderStatus(selectedOrder.id, newStatus, labelMap[newStatus] || newStatus);
    setIsStatusModalOpen(false);
    showToast(`Order ${selectedOrder.id} status updated to ${labelMap[newStatus]}!`);
  };

  return (
    <div className="order-queue-page">
      <div className="table-header-controls">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Order Queue</h1>
          <p className="page-subtitle">Manage and process inbound reservations and booking adjustments.</p>
        </div>

        <div className="filter-selects-group">
          <select 
            className="select-filter" 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Status: All Orders</option>
            <option value="awaiting-payment">Awaiting Payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="change-requested">Change Requested</option>
            <option value="completed">Completed</option>
          </select>

          <select 
            className="select-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">Sort by: Event Date</option>
            <option value="id">Sort by: Order ID</option>
            <option value="client">Sort by: Client Name</option>
          </select>
        </div>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Client</th>
              <th>Venue</th>
              <th>Event Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', paddingRight: '28px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td className="order-id-cell">{order.id}</td>
                <td className="client-name-cell">{order.client}</td>
                <td>{order.venue}</td>
                <td>{order.eventDate}</td>
                <td>
                  <span className={`status-badge ${order.status}`}>
                    {order.statusLabel}
                  </span>
                </td>
                <td>
                  <div className="table-actions-cell">
                    <button 
                      className="btn-table-action btn-table-view"
                      onClick={() => handleOpenDetails(order)}
                    >
                      View Details
                    </button>
                    <button 
                      className="btn-table-action btn-table-update"
                      onClick={() => handleOpenStatusModal(order)}
                    >
                      Update Status
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                  No reservations matching selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={`Reservation Details - ${selectedOrder?.id}`}
        footer={
          <button className="btn-solid-primary" onClick={() => setIsDetailsOpen(false)}>
            Close
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Client:</span>
            <strong>{selectedOrder?.client}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Reserved Venue:</span>
            <strong>{selectedOrder?.venue}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Scheduled Date:</span>
            <strong>{selectedOrder?.eventDate}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Expected Attendance:</span>
            <strong>{selectedOrder?.guests || 120} Guests</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>Contract Amount:</span>
            <strong style={{ color: '#2563eb', fontSize: '15px' }}>{selectedOrder?.amount || '$1,800.00'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b' }}>Current Status:</span>
            <span className={`status-badge ${selectedOrder?.status}`}>
              {selectedOrder?.statusLabel}
            </span>
          </div>
        </div>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Update Status - ${selectedOrder?.id}`}
        footer={
          <>
            <button className="btn-outline-neutral" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-solid-primary" onClick={handleSaveStatus}>
              Apply Status
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>Select New Status for {selectedOrder?.client}'s Reservation:</label>
          <select 
            value={newStatus} 
            onChange={(e) => setNewStatus(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          >
            <option value="awaiting-payment">Awaiting Payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="change-requested">Change Requested</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
