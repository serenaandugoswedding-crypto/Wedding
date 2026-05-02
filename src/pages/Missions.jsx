import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Missions() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    fetch('/api/missions')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ missions }) => setMissions(missions ?? []))
      .catch(() => setError('Errore nel caricamento.'));
  }, []);

  return (
    <div style={S.page}>
      <button onClick={() => navigate('/')} style={S.homeBtn}>&larr; HOME</button>

      <header style={S.header}>
        <span style={S.headerLeft}>VOL. I &middot; ISSUE 01</span>
        <span style={S.headerRight}>MISSIONI</span>
      </header>

      <div style={{ padding: '20px 20px 0' }}>
        <p style={S.sectionLabel}>IL NUMERO DI OGGI</p>
        <h1 style={S.title}>Missioni</h1>
      </div>

      {missions === null && !error ? (
        <div style={S.center}><p style={S.caveat}>caricando…</p></div>
      ) : error ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A' }}>{error}</p>
        </div>
      ) : missions.length === 0 ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A' }}>Nessuna missione attiva.</p>
        </div>
      ) : (
        <ul style={S.list}>
          {missions.map((m, i) => (
            <li key={m.id} style={{ ...S.item, borderTop: i === 0 ? '0.5px solid rgba(14,14,14,0.12)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={S.missionTitle}>{m.title}</span>
                <span style={S.bonus}>+{m.bonus_points} pt</span>
              </div>
              {m.description && (
                <p style={S.description}>{m.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <footer style={S.footer}>
        SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
      </footer>
    </div>
  );
}

const S = {
  page:         { minHeight: '100dvh', background: '#F8F5F0', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' },
  homeBtn:      { background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: '10px 20px 4px', alignSelf: 'flex-start' },
  header:       { padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(14,14,14,0.1)', flexShrink: 0 },
  headerLeft:   { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#0E0E0E', textTransform: 'uppercase' },
  headerRight:  { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase' },
  sectionLabel: { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A', marginBottom: 6 },
  title:        { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 28, fontWeight: 500, color: '#0E0E0E', marginBottom: 16 },
  list:         { listStyle: 'none', margin: 0, padding: '0 20px 32px', flex: 1 },
  item:         { padding: '20px 0', borderBottom: '0.5px solid rgba(14,14,14,0.1)' },
  missionTitle: { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 18, fontWeight: 400, color: '#0E0E0E' },
  bonus:        { fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A', fontWeight: 700, flexShrink: 0, marginLeft: 12 },
  description:  { fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', lineHeight: 1.6 },
  center:       { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' },
  caveat:       { fontFamily: "'Caveat', cursive", fontSize: 20, color: '#2A2A2A', fontStyle: 'italic' },
  footer:       { padding: '10px 20px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.25em', textAlign: 'center', textTransform: 'uppercase', flexShrink: 0, marginTop: 'auto' },
};
