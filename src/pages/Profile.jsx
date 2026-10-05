import React, { useState } from 'react';
import { User as UserRound, Check, Save } from 'lucide-react';
import { PageHeading, ErrorNotice } from '../components/UI';
export default function Profile({ user, onSave }) {
  const [form, setForm] = useState({ displayName: user.displayName, email: user.email, phone: user.phone || '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const dirty = form.displayName !== user.displayName || form.email !== user.email || form.phone !== (user.phone || '');
  const field = key => ({ value: form[key], onChange: event => { setSaved(false); setForm(previous => ({ ...previous, [key]: event.target.value })); } });
  const submit = async event => {
    event.preventDefault(); if (busy) return; setError(''); setSaved(false); setBusy(true);
    try {
      const updated = await onSave({ displayName: form.displayName.trim(), email: form.email.trim(), phone: form.phone.trim() || null });
      setForm({ displayName: updated.displayName, email: updated.email, phone: updated.phone || '' }); setSaved(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <><PageHeading eyebrow="Account" title="Your contact details" description="Keep your details up to date so your manager can reach you." />
    <div className="profile-layout"><form className="panel form-panel" onSubmit={submit}><div className="section-heading"><h2>Personal information</h2><UserRound size={20} /></div><ErrorNotice message={error} />
      <fieldset disabled={busy}><label className="field">Full name<input required minLength={2} maxLength={100} autoComplete="name" {...field('displayName')} /></label>
      <label className="field">Email address<input type="email" required maxLength={254} autoComplete="email" {...field('email')} /><span className="field-help">You will use this address to sign in.</span></label>
      <label className="field">Phone number <span className="optional">Optional</span><input type="tel" maxLength={20} autoComplete="tel" placeholder="+7 700 123 4567" {...field('phone')} /></label>
      <div className="form-actions">{saved && <span className="saved-label" role="status"><Check size={16} />Changes saved</span>}<button className="button primary" type="submit" disabled={!dirty || busy}><Save size={16} />{busy ? 'Saving…' : 'Save contact details'}</button></div></fieldset></form>
      <aside className="profile-note"><div className="empty-icon"><UserRound size={25} /></div><h3>Details that make planning easier.</h3><p>Your email and phone help your assigned manager coordinate your booking. Your name appears on your account and order details.</p><dl><dt>Account type</dt><dd>Client</dd><dt>Member since</dt><dd>{new Date(user.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</dd></dl></aside></div>
  </>;
}
