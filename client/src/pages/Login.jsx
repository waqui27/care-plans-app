import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../api.js';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      auth.login(data);
      nav(data.role === 'superadmin' ? '/super' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">M</div>
        <h1>Sign in</h1>
        <form onSubmit={submit}>
          <div>
            <label className="field-label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@clinic.in" required />
          </div>
          <div>
            <label className="field-label">Password</label>
            <div className="pw-wrap">
              <input className="input" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="show" onClick={() => setShow(s => !s)}>{show ? 'HIDE' : 'SHOW'}</button>
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="footnote">One sign-in for everyone — your role decides where you land.<br />Admins → dashboard · Super admin → console.</div>
      </div>
    </div>
  );
}
