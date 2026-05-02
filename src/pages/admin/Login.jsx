import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AdminLogin() {
  const navigate        = useNavigate();
  const { state }       = useLocation();
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(state?.expired ? 'Sessione scaduta. Accedi di nuovo.' : '');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!password || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      if (res.ok) {
        const { token } = await res.json();
        sessionStorage.setItem('admin_token', token);
        navigate('/admin/photos');
      } else {
        const { error: msg } = await res.json();
        setError(msg ?? 'Errore.');
      }
    } catch {
      setError('Errore di rete.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.eyebrow}>VOL. I &middot; ISSUE 01</span>
      </header>

      <div style={S.body}>
        <p style={S.sectionLabel}>ADMIN</p>
        <h1 style={S.title}>Accesso riservato.</h1>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="Password"
          autoComplete="current-password"
          style={S.input}
        />

        {error && <p style={S.errorMsg}>{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '…' : 'ACCEDI'}
        </button>
      </div>
    </div>
  );
}

const S = {
  page:         { minHeight: '100dvh', background: '#F8F5F0', display: 'flex', flexDirection: 'column', maxWidth: 400, margin: '0 auto' },
  header:       { padding: '14px 24px 12px', borderBottom: '0.5px solid rgba(14,14,14,0.1)' },
  eyebrow:      { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#0E0E0E', textTransform: 'uppercase' },
  body:         { flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 24px 40px' },
  sectionLabel: { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A', marginBottom: 8 },
  title:        { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 30, fontWeight: 500, color: '#0E0E0E', marginBottom: 36 },
  input:        { width: '100%', boxSizing: 'border-box', fontFamily: 'Georgia, serif', fontSize: 15, color: '#0E0E0E', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(14,14,14,0.35)', outline: 'none', padding: '8px 0 10px', caretColor: '#8B1A1A', marginBottom: 8 },
  errorMsg:     { fontFamily: 'Georgia, serif', fontSize: 12, color: '#8B1A1A', marginTop: 8, marginBottom: 12, letterSpacing: '0.04em' },
  btn:          { marginTop: 24, padding: 13, background: '#8B1A1A', color: '#FFFFFF', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', display: 'block', width: '100%' },
};
