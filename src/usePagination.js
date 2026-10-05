import { useEffect, useState } from 'react';

export function pageWindow(records, requestedPage, pageSize) {
  const pages = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pages));
  const start = (page - 1) * pageSize;
  return { items: records.slice(start, start + pageSize), page, pages, total: records.length, start: records.length ? start + 1 : 0, end: Math.min(start + pageSize, records.length) };
}

export default function usePagination(records, resetKey = '', pageSize = 25) {
  const [requestedPage, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const result = pageWindow(records, requestedPage, pageSize);
  useEffect(() => { if (requestedPage !== result.page) setPage(result.page); }, [requestedPage, result.page]);
  return { ...result, setPage };
}
