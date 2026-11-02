import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { money, period } from '../utils';
import { ErrorNotice, Loading, VenueArt, EmptyState } from './UI';
import usePagination from '../usePagination';
import { Pagination } from './UI';

export default function AlternativeVenues({ token, request, onChoose }) {
  const [checked, setChecked] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const { premiseId, startsAt, endsAt, guests, orderId } = request;
  const requestKey = JSON.stringify([premiseId, startsAt, endsAt, guests, orderId]);
  const result = checked?.key === requestKey ? checked.data : null;
  useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError('');
    api.premises.alternatives(token, { premiseId, startsAt, endsAt, guests, orderId }, abort.signal).then(data => { if (!abort.signal.aborted) setChecked({ key: requestKey, data }); })
      .catch(err => { if (!abort.signal.aborted) setError(err.message); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [token, premiseId, startsAt, endsAt, guests, orderId, requestKey, version]);
  const pagination = usePagination(result?.alternatives || [], version, 6);
  return <section className="alternatives-panel" aria-busy={busy}><div className="section-heading"><h3>Availability & alternatives</h3><button type="button" className="text-button" disabled={busy} onClick={() => setVersion(value => value + 1)}>{busy ? 'Checking…' : 'Check again'}</button></div><p className="small muted">{period(request)} · {request.guests} guests</p><ErrorNotice message={error} />{busy && !result ? <Loading label="Checking suitable venues…" /> : result && <><div className={`notice ${result.requestedAvailable ? 'notice-info' : 'notice-warning'}`}>{result.requestedAvailable ? 'The requested venue is available for this period.' : 'The requested venue is occupied or too small. These alternatives fit your guest count and were available when checked.'}</div><div className="service-card-grid">{pagination.items.map(venue => <article className="service-tile" key={venue.id}><div className="alternative-photo"><VenueArt venue={venue} /></div><div className="service-tile-body"><h3>{venue.name}</h3><p>{venue.address} · Up to {venue.capacity} guests</p><strong>{money(venue.rentalAmount)} rental estimate</strong>{venue.promotionPercent > 0 && <span className="promotion-label">{venue.promotionPercent}% rental promotion · save {money(venue.rentalDiscount)}</span>}{onChoose && <button type="button" className="button secondary" disabled={busy} onClick={() => onChoose(venue)}>Choose this venue</button>}</div></article>)}</div><Pagination pagination={pagination} />{!result.alternatives.length && <EmptyState title="No suitable alternative venues" description="Try a different rental period or guest count." />}<p className="small muted">{result.note}</p>{!onChoose && <p className="small muted">Suggest these options to the client. Changing an existing order will be handled in the next sprint.</p>}</>}</section>;
}
