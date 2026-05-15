import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect email or password.');
    } finally { setLoading(false); }
  };

  return (
    <div style={S.page}>
      <Glow />
      <div className="cx-card cx-in" style={S.card}>
        <Logo />
        <h1 style={S.heading}>Welcome back</h1>
        <p style={S.sub}>Sign in to your workspace</p>
        {error && <ErrorBox msg={error} />}
        <form onSubmit={handleSubmit} style={S.form}>
          <Field label="Email">
            <input className="cx-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              required autoComplete="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input className="cx-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password" placeholder="Your password" />
          </Field>
          <button type="submit" disabled={loading} className="cx-btn" style={S.submit}>
            {loading ? <Spinner label="Signing in…" /> : 'Sign in'}
          </button>
        </form>
        <p style={S.footer}>
          No account?{' '}
          <Link to="/register" style={S.link}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ─── shared pieces ──────────────────────────────────── */

export function Logo() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:28 }}>
      <div style={{
        width:28, height:28, borderRadius:7,
        background:'var(--accent)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:17, color:'var(--text)', letterSpacing:'-0.01em' }}>
        Cortex
      </span>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label className="cx-label">{label}</label>
      {children}
    </div>
  );
}

export function ErrorBox({ msg }) {
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:8,
      background:'var(--error-soft)', border:'1px solid var(--error-ring)',
      borderRadius:9, padding:'9px 12px',
      fontSize:13, color:'var(--error)', marginBottom:2,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{ flexShrink:0, marginTop:1 }}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {msg}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <>
      <span className="cx-spin" style={{
        display:'inline-block', width:13, height:13,
        border:'2px solid rgba(255,255,255,0.25)', borderTopColor:'#fff',
        borderRadius:'50%',
      }} />
      {label}
    </>
  );
}

function Glow() {
  return (
    <>
      <div style={{
        position:'fixed', top:-100, left:-80, width:460, height:460,
        background:'radial-gradient(ellipse, rgba(124,92,246,0.07) 0%, transparent 70%)',
        pointerEvents:'none',
      }} />
      <div style={{
        position:'fixed', bottom:-90, right:-80, width:360, height:360,
        background:'radial-gradient(ellipse, rgba(45,212,191,0.04) 0%, transparent 70%)',
        pointerEvents:'none',
      }} />
    </>
  );
}

const S = {
  page: {
    minHeight:'100vh', background:'var(--bg)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:20, fontFamily:'var(--font-body)', position:'relative', overflow:'hidden',
  },
  card:   { width:'100%', maxWidth:396, padding:34 },
  heading:{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:22, color:'var(--text)', margin:'0 0 5px' },
  sub:    { fontSize:14, color:'var(--text-2)', margin:'0 0 22px' },
  form:   { display:'flex', flexDirection:'column', gap:14 },
  submit: { width:'100%', padding:11, marginTop:2 },
  footer: { fontSize:13, color:'var(--text-2)', marginTop:22, textAlign:'center', margin:'22px 0 0' },
  link:   { color:'var(--accent)', fontWeight:500, textDecoration:'none' },
};