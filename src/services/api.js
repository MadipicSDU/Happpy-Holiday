const API = (import.meta.env?.VITE_API_URL || 'http://localhost:5294/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; }
}

export async function request(path, { token, method = 'GET', body, signal, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await sendRequest(path, { token, method, body, signal: controller.signal });
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new ApiError('The request took too long. Check your connection and try again. For a submitted change, refresh before retrying to check whether it was saved.', 0);
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', cancel);
  }
}

async function sendRequest(path, { token, method, body, signal }) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method, signal,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Unable to connect. Check your connection and try again.', 0);
  }
  let text;
  try { text = await response.text(); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('The connection was interrupted. Refresh before retrying a submitted change to check whether it was saved.', 0);
  }
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const message = response.status === 401 ? (token ? 'Your session has expired. Please sign in again.' : 'The email or password is incorrect. Please try again.')
      : response.status === 429 ? 'Too many attempts. Please wait a minute and try again.'
      : data?.errors ? Object.values(data.errors).flat().join(' ')
      : data?.detail || data?.title || (response.status === 403 ? 'You do not have access to this action.' : 'This action could not be completed. Try again.');
    if (response.status === 401 && token) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(message, response.status);
  }
  if (response.status !== 204 && (data === null || typeof data !== 'object')) {
    throw new ApiError('The server returned an unreadable response. Refresh before retrying a submitted change to check whether it was saved.', response.status);
  }
  return data;
}

const collection = path => ({
  getAll: (token, signal) => request(path, { token, signal }),
  create: (token, body) => request(path, { token, method: 'POST', body }),
  update: (token, id, body) => request(`${path}/${encodeURIComponent(id)}`, { token, method: 'PUT', body }),
  delete: (token, id) => request(`${path}/${encodeURIComponent(id)}`, { token, method: 'DELETE' }),
});
export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    register: body => request('/auth/register', { method: 'POST', body }),
    createStaff: (token, body) => request('/auth/staff', { token, method: 'POST', body }),
  },
  premises: { ...collection('/premises'),
    alternatives: (token, body, signal) => request('/premises/alternatives', { token, method: 'POST', body, signal }),
    occupancy: (token, from, to, signal) => request(`/premises/occupancy?${new URLSearchParams({ from, to })}`, { token, signal }) },
  services: collection('/services'),
  orders: { ...collection('/orders'),
    quote: (token, body, signal) => request('/orders/quote', { token, method: 'POST', body, signal }),
    updateStatus: (token, id, status) => request(`/orders/${encodeURIComponent(id)}/status`, { token, method: 'PATCH', body: { status } }) },
  clients: { getAll: (token, signal) => request('/users/clients', { token, signal }) },
  invoices: {
    get: (token, id, signal) => request(`/orders/${encodeURIComponent(id)}/invoice`, { token, signal }),
    generate: (token, id) => request(`/orders/${encodeURIComponent(id)}/invoice`, { token, method: 'POST' }),
    deliver: (token, id) => request(`/orders/${encodeURIComponent(id)}/invoice/deliver`, { token, method: 'POST' }),
    pay: (token, id, idempotencyKey, outcome, invoiceId) => request(`/orders/${encodeURIComponent(id)}/invoice/pay`, { token, method: 'POST', body: { idempotencyKey, outcome, invoiceId } }),
    history: (token, id, signal) => request(`/orders/${encodeURIComponent(id)}/invoice/history`, { token, signal }),
  },
  changes: {
    list: (token, id, signal) => request(`/orders/${encodeURIComponent(id)}/changes`, { token, signal }),
    quote: (token, id, body, signal) => request(`/orders/${encodeURIComponent(id)}/changes/quote`, { token, method: 'POST', body, signal }),
    create: (token, id, body) => request(`/orders/${encodeURIComponent(id)}/changes`, { token, method: 'POST', body }),
    withdraw: (token, id, changeId) => request(`/orders/${encodeURIComponent(id)}/changes/${encodeURIComponent(changeId)}/withdraw`, { token, method: 'POST' }),
    review: (token, id, changeId, body) => request(`/orders/${encodeURIComponent(id)}/changes/${encodeURIComponent(changeId)}/review`, { token, method: 'POST', body }),
  },
  execution: {
    get: (token, id, signal) => request(`/orders/${encodeURIComponent(id)}/execution`, { token, signal }),
    save: (token, id, body) => request(`/orders/${encodeURIComponent(id)}/execution`, { token, method: 'PUT', body }),
    finalize: (token, id, expectedVersion) => request(`/orders/${encodeURIComponent(id)}/execution/finalize`, { token, method: 'POST', body: { expectedVersion } }),
    dispatch: (token, id, expectedVersion) => request(`/orders/${encodeURIComponent(id)}/execution/dispatch`, { token, method: 'POST', body: { expectedVersion } }),
  },
  management: {
    operators: (token, signal) => request('/management/operators', { token, signal }),
    dashboard: (token, from, to, signal) => request(`/management/dashboard?${new URLSearchParams({ from, to })}`, { token, signal }),
  },
  briefs: {
    list: (token, signal) => request('/staff/briefs', { token, signal }),
    update: (token, id, status) => request(`/staff/briefs/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: { status } }),
  },
  users: { ...collection('/users'),
    me: (token, signal) => request('/users/me', { token, signal }),
    saveProfile: (token, body) => request('/users/me', { token, method: 'PUT', body }),
    getStaff: (token, signal) => request('/users/staff', { token, signal }) },
};
