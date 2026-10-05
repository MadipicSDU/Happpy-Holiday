import React, { useState } from 'react';
import { CalendarDays, ArrowRight, Eye, EyeOff, Building2, Check } from 'lucide-react';
import { api } from '../services/api';
import { ErrorNotice } from '../components/UI';
export default function Auth({ onLogin, initialMessage }) {
  const [isLogin, setIsLogin] = useState(true), [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ displayName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const field = key => ({ value: form[key], onChange: event => setForm(previous => ({ ...previous, [key]: event.target.value })) });
  const submit = async event => {
    event.preventDefault(); if (loading) return; setError(''); setLoading(true);
    try {
      const response = isLogin ? await api.auth.login(form.email.trim(), form.password)
        : await api.auth.register({ ...form, displayName: form.displayName.trim(), email: form.email.trim(), phone: form.phone.trim() || null });
      onLogin(response.accessToken, response.user);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return <div className="auth-layout">
    <section className="auth-story"><div className="brand brand-light"><span className="brand-mark"><CalendarDays size={22} /></span><span>happy holiday<span className="brand-caption">A space for every occasion</span></span></div>
      <div className="auth-editorial"><p className="eyebrow">Make room for something special</p><h1>Your occasion.<br />The right space.</h1><p>Bring your plans together. Find a venue, choose your services, and review every detail before you submit.</p>
        <div className="auth-promises"><span><Check size={17} />Transparent pricing</span><span><Check size={17} />One place for your bookings</span></div></div>
      <div className="architectural-art" aria-hidden="true"><div className="arch arch-one" /><div className="arch arch-two" /><div className="arch arch-three" /><div className="art-caption">Thoughtfully planned. Beautifully brought together.</div></div>
    </section>
    <section className="auth-panel"><div className="auth-form-wrap"><p className="eyebrow">{isLogin ? 'Welcome back' : 'Your next occasion starts here'}</p><h2>{isLogin ? 'Sign in to your workspace' : 'Create your account'}</h2><p className="muted">{isLogin ? 'Manage your bookings and keep your plans in view.' : 'Find event spaces and submit your first booking.'}</p>
      {initialMessage && !error && <div className="notice notice-warning" role="status">{initialMessage}</div>}<ErrorNotice message={error} />
      <form onSubmit={submit}>
        <fieldset disabled={loading}>
          {!isLogin && <><label className="field">Full name<input autoComplete="name" required minLength={2} maxLength={100} {...field('displayName')} placeholder="Your full name" /></label>
            <label className="field">Phone <span className="optional">Optional</span><input type="tel" autoComplete="tel" maxLength={20} {...field('phone')} placeholder="+7 700 123 4567" /></label></>}
          <label className="field">Email address<input type="email" autoComplete="email" required maxLength={254} {...field('email')} placeholder="you@example.com" /></label>
          <div className="field"><label htmlFor="auth-password">Password</label><div className="password-field"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} {...field('password')} /><button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{!isLogin && <span className="field-help">Use at least 8 characters.</span>}</div>
          <button className="button primary full" type="submit">{loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}{!loading && <ArrowRight size={18} />}</button>
        </fieldset>
      </form><p className="auth-switch">{isLogin ? 'New to Happy Holiday?' : 'Already have an account?'} <button className="text-button" disabled={loading} onClick={() => { setIsLogin(!isLogin); setError(''); }}>{isLogin ? 'Create an account' : 'Sign in'}</button></p>
      <p className="auth-footnote"><Building2 size={15} />A simpler way to plan your event space.</p>
    </div></section>
  </div>;
}
