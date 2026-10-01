const API = 'http://localhost:5294/api';

const headers = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
});

const handleResponse = async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
        if (data.errors && typeof data.errors === 'object') {
            throw new Error(Object.values(data.errors).flat().join(' '));
        }
        throw new Error(data.detail || data.title || 'Request failed');
    }
    return data;
};

export const api = {
    auth: {
        login: (email, password) =>
            fetch(`${API}/auth/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) }),
        register: (displayName, email, password, phone) =>
            fetch(`${API}/auth/register`, { method: 'POST', headers: headers(), body: JSON.stringify({ displayName, email, password, phone: phone || null }) }),
        createStaff: (token, displayName, email, password, role, phone) =>
            fetch(`${API}/auth/staff`, { method: 'POST', headers: headers(token), body: JSON.stringify({ displayName, email, password, role, phone: phone || null }) }).then(handleResponse),
    },
    premises: {
        getAll: (token) => fetch(`${API}/premises`, { headers: headers(token) }).then(handleResponse),
        create: (token, data) => fetch(`${API}/premises`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data)
        }).then(r => r.json()),
        update: (token, id, data) => fetch(`${API}/premises/${id}`, {
            method: 'PUT',
            headers: headers(token),
            body: JSON.stringify(data)
        }),
    },
    orders: {
        getAll: (token) => fetch(`${API}/orders`, { headers: headers(token) }).then(r => r.json()),
        create: (token, dto) =>
            fetch(`${API}/orders`, { method: 'POST', headers: headers(token), body: JSON.stringify(dto) }).then(r => r.json()),
        updateStatus: (token, id, status) =>
            fetch(`${API}/orders/${id}/status`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ status }) }).then(r => r.json()),
    },
    clients: {
        getAll: (token) => fetch(`${API}/users/clients`, { headers: headers(token) }).then(r => r.json()),
    },
    users: {
        getStaff: (token) => fetch(`${API}/users/staff`, { headers: headers(token) }).then(r => r.json()),
        update: (token, id, data) => fetch(`${API}/users/${id}`, {
            method: 'PUT',
            headers: headers(token),
            body: JSON.stringify(data)
        }).then(r => r.json()),
    },
    services: {
        getAll: (token) => fetch(`${API}/services`, { headers: headers(token) }).then(r => r.json()),
        create: (token, data) => fetch(`${API}/services`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify(data)
        }).then(r => r.json()),
        update: (token, id, data) => fetch(`${API}/services/${id}`, {
            method: 'PUT',
            headers: headers(token),
            body: JSON.stringify(data)
        }),
    },
};
