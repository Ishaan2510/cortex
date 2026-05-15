import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { Logo, Field, ErrorBox, Spinner } from './Login';

export default function Register() {
  const [name, setName]         = useState('');
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
      const { data } = await api.post('/api/auth/register', { name, email, password });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={S.page}>
      <div style={S.glow1} />
      <div style={S.glow2} />

      <div className="cx-card cx-in" style={S.card}>
        <Logo />
        <h1 style={S.heading}>Create account</h1>
        <p style={S.sub}>Your AI workspace awaits</p>
        {error && <ErrorBox msg={error} />}
        <form onSubmit={handleSubmit} style={S.form}>
          <Field label="Name">
            <input className="cx-input" type="text" value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name" placeholder="Your name" />
          </Field>
          <Field label="Email">
            <input className="cx-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              required autoComplete="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input className="cx-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              required minLength={6} autoComplete="new-password" placeholder="Min. 6 characters" />
          </Field>
          <button type="submit" disabled={loading} className="cx-btn" style={S.submit}>
            {loading ? <Spinner label="Creating account…" /> : 'Get started'}
          </button>
        </form>
        <p style={S.footer}>
          Already have an account?{' '}
          <Link to="/login" style={S.link}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight:'100vh', background:'var(--bg)',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:20, fontFamily:'var(--font-body)', position:'relative', overflow:'hidden',
  },
  glow1: {
    position:'fixed', top:-100, right:-80, width:460, height:460,
    background:'radial-gradient(ellipse, rgba(124,92,246,0.07) 0%, transparent 70%)',
    pointerEvents:'none',
  },
  glow2: {
    position:'fixed', bottom:-90, left:-80, width:360, height:360,
    background:'radial-gradient(ellipse, rgba(45,212,191,0.04) 0%, transparent 70%)',
    pointerEvents:'none',
  },
  card:   { width:'100%', maxWidth:396, padding:34 },
  heading:{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:22, color:'var(--text)', margin:'0 0 5px' },
  sub:    { fontSize:14, color:'var(--text-2)', margin:'0 0 22px' },
  form:   { display:'flex', flexDirection:'column', gap:14 },
  submit: { width:'100%', padding:11, marginTop:2 },
  footer: { fontSize:13, color:'var(--text-2)', marginTop:22, textAlign:'center', margin:'22px 0 0' },
  link:   { color:'var(--accent)', fontWeight:500, textDecoration:'none' },
};