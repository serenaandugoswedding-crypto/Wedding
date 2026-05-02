import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const getAdminToken = () => sessionStorage.getItem('admin_token');

function formatBytes(b) {
  if (!b) return '0 B';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(0)} MB`;
}

export default function AdminDashboard() {
  const navigate    = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { navigate('/admin'); return; }
    fetch('/api/admin/photos?action=stats', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d))
      .catch(() => {});
  }, []);

  function logout() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <p style={S.eyebrow}>ADMIN &middot; DASHBOARD</p>
          <h1 style={S.title}>Dashboard</h1>
        </div>
        <button onClick={logout} style={S.exitBtn}>ESCI</button>
      </div>

      {stats && (
        <div style={S.statsBlock}>
          <p style={S.statLine}>
            Live: <b>{stats.counts.live}</b> &nbsp;&middot;&nbsp;
            Eliminate: <b>{stats.counts.deleted}</b> &nbsp;&middot;&nbsp;
            Archiviate: <b>{stats.counts.archived}</b> &nbsp;&middot;&nbsp;
            Editor's pick: <b>{stats.counts.editors_picks}</b>
          </p>
          <p style={S.statLine}>
            Storage: {formatBytes(stats.storage.photos_bytes)} + {formatBytes(stats.storage.archive_bytes)} = <b>{formatBytes(stats.storage.total_bytes)}</b>
          </p>
        </div>
      )}

      <div style={S.links}>
        <button onClick={() => navigate('/admin/photos')} style={S.linkBtn}>
          → GESTIONE FOTO
        </button>
      </div>
    </div>
  );
}

const S = {
  page:       { minHeight: '100dvh', background: '#F8F5F0', fontFamily: 'Georgia, serif', maxWidth: 600, margin: '0 auto', padding: '32px 24px' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 20, borderBottom: '0.5px solid rgba(14,14,14,0.12)' },
  eyebrow:    { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A', marginBottom: 8 },
  title:      { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 32, fontWeight: 500, color: '#0E0E0E' },
  exitBtn:    { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.3)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', color: '#0E0E0E' },
  statsBlock: { background: '#F0EDE8', padding: '16px 20px', marginBottom: 32, borderLeft: '2px solid #8B1A1A' },
  statLine:   { fontFamily: 'Georgia, serif', fontSize: 12, color: '#444', marginBottom: 6, letterSpacing: '0.04em', lineHeight: 1.7 },
  links:      { display: 'flex', flexDirection: 'column', gap: 12 },
  linkBtn:    { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.25)', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', padding: '14px 20px', color: '#0E0E0E', textAlign: 'left' },
};
