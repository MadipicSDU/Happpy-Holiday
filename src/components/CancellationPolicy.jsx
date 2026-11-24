import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ErrorNotice, Loading } from './UI';

export default function CancellationPolicy({ token }) {
  const [form, setForm] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [version, setVersion] = useState(0);
  useEffect(() => { const abort = new AbortController(); setError(''); api.cancellations.policy(token, abort.signal).then(value => { if (!abort.signal.aborted) setForm(value); }).catch(err => { if (!abort.signal.aborted) setError(err.message); }); return () => abort.abort(); }, [token, version]);
  const save = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setSaved(false);
    try { const result = await api.cancellations.savePolicy(token, { expectedVersion: form.version, cutoffHours: Number(form.cutoffHours), earlyPercent: Number(form.earlyPercent), latePercent: Number(form.latePercent) }); setForm(result); setSaved(true); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const field = key => ({ value: form?.[key] ?? '', onChange: event => { setSaved(false); setForm(previous => ({ ...previous, [key]: event.target.value })); } });
  return <section className="panel policy-panel"><h2>Cancellation terms for new bookings</h2><p className="muted">Set the change deadline and cancellation fees. Existing bookings keep their stored terms. The initial rates are zero.</p><ErrorNotice message={error} onRetry={() => setVersion(v => v + 1)} />
    {!form ? !error && <Loading label="Loading cancellation policy…" /> : <form onSubmit={save}><fieldset disabled={busy}><div className="form-grid"><label className="field">Change cutoff (hours before event)<input required type="number" min={1} max={8760} step={1} {...field('cutoffHours')} /></label><label className="field">Before-deadline cancellation (%)<input required type="number" min={0} max={100} step="0.01" {...field('earlyPercent')} /></label><label className="field">After-deadline cancellation (%)<input required type="number" min={0} max={100} step="0.01" {...field('latePercent')} /></label></div><p className="small muted">Percentages apply to the full agreed order value. A penalty can exceed the payment already applied, leaving a balance due.</p><button className="button secondary" type="submit">{busy ? 'Saving…' : 'Save new policy version'}</button>{saved && <p role="status">Policy version {form.version} saved for new bookings.</p>}</fieldset></form>}
  </section>;
}
