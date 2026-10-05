import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { ErrorNotice } from './UI';
import { period } from '../utils';
export default function CancelBookingDialog({ order, onClose, onCancel }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { setError(''); }, [order?.id]);
  const cancel = async () => {
    if (busy) return; setBusy(true); setError('');
    try { await onCancel(order.id); onClose(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Modal isOpen={Boolean(order)} title="Cancel this booking?" onClose={onClose} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={onClose}>Keep booking</button><button className="button danger" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel booking'}</button></>}>
    <ErrorNotice message={error} /><h3>{order?.venue}</h3><p className="muted">{order && period(order)}</p><p className="dialog-copy">This will cancel the pending or unpaid order and release the venue. This action cannot be undone.</p>
  </Modal>;
}
