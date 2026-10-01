import React, { useState } from 'react';

const API = 'http://localhost:5294/api';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url  = isLogin ? `${API}/auth/login` : `${API}/auth/register`;
      const body = isLogin
        ? { email, password }
        : { displayName: name, email, password, phone: phone || null };

      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.errors && typeof data.errors === 'object') {
          // Flatten ASP.NET Core validation errors
          const errorMessages = Object.values(data.errors).flat().join(' ');
          throw new Error(errorMessages);
        }
        throw new Error(data.detail || data.title || (isLogin ? 'Login failed' : 'Registration failed'));
      }

      // AuthResponse = { accessToken, tokenType, expiresAt, user }
      onLogin(data.accessToken, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
    outline: 'none', marginTop: '4px'
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f8fafc'
    }}>
      <div style={{
        width: '100%', maxWidth: '420px', background: 'white',
        borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '40px'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: '#2563eb', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
          }}>
            <span style={{ fontSize: '22px' }}>🎉</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
            Happy Holiday
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
            padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isLogin && (
            <>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Full Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Alex Wong" required style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Phone Number (Optional)</label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000" style={inputStyle}
                />
              </div>
            </>
          )}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required style={inputStyle}
              pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
              title="Please enter a valid email address (e.g. name@domain.com)"
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              Password {!isLogin && <span style={{ color: '#94a3b8', fontWeight: 400 }}>(min 8 chars)</span>}
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={8} style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '11px', background: loading ? '#93c5fd' : '#2563eb',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '4px'
            }}
          >
            {loading ? 'Please wait…' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        {isLogin && (
          <div style={{ marginTop: '20px', padding: '12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
            <strong>Default Admin:</strong> admin@happyholiday.local / Admin123!<br />
            <strong>Default Manager:</strong> manager@happyholiday.local / Manager123!
          </div>
        )}
      </div>
    </div>
  );
}
