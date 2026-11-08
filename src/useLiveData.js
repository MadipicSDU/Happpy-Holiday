import { useEffect, useState } from 'react';

export default function useLiveData(load, dependencies = []) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(true), [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setBusy(true);
    load(abort.signal).then(value => { if (!abort.signal.aborted) { setData(value); setError(''); } })
      .catch(error => { if (!abort.signal.aborted) setError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [...dependencies, version]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setVersion(value => value + 1); };
    const timer = setInterval(refresh, 30000); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return { data, error, busy, refresh: () => setVersion(value => value + 1) };
}
