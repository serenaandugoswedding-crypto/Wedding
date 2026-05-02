import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function formatTime(date) {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function Leaderboard() {
  const navigate  = useNavigate();
  const myUuid    = localStorage.getItem('wedding_guest_uuid');

  const [entries,     setEntries]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [updatedAt,   setUpdatedAt]   = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/api/missions?action=leaderboard');
      if (!r.ok) throw new Error();
      const { leaderboard } = await r.json();
      setEntries(leaderboard ?? []);
      setUpdatedAt(new Date());
    } catch {
      setError('Errore nel caricamento.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // primo caricamento
  useState(() => { load(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  return (
    <div style={S.page}>
      <button onClick={() => navigate('/')} style={S.homeBtn}>&larr; HOME</button>

      <header style={S.header}>
        <span style={S.headerLeft}>VOL. I &middot; ISSUE 01</span>
        <span style={S.headerRight}>CLASSIFICA</span>
      </header>

      <div style={S.titleRow}>
        <div>
          <p style={S.sectionLabel}>IL MAGAZINE DEL GIORNO</p>
          <h1 style={S.title}>I Reporter del Giorno</h1>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} style={S.refreshBtn}>
          {refreshing ? '…' : 'AGGIORNA'}
        </button>
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A', marginBottom: 16 }}>{error}</p>
          <button onClick={handleRefresh} style={S.refreshBtn}>RIPROVA</button>
        </div>
      ) : !entries?.length ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', lineHeight: 1.9, marginBottom: 28 }}>
            Nessun reporter ancora.<br />Scatta la prima foto.
          </p>
          <button onClick={() => navigate('/camera')} style={S.ctaBtn}>SCATTA ORA &nbsp;&rarr;</button>
        </div>
      ) : (
        <ol style={S.list}>
          {entries.map((entry, i) => {
            const rank    = i + 1;
            const isTop3  = rank <= 3;
            const isMine  = entry.guest_uuid === myUuid;
            return (
              <li
                key={entry.guest_uuid}
                style={{
                  ...S.row,
                  ...(isTop3 ? S.rowTop3 : {}),
                  ...(isMine ? S.rowMine : {}),
                }}
              >
                <span style={{ ...S.rank, color: isTop3 ? '#8B1A1A' : '#999' }}>
                  #{rank}
                </span>
                <div style={S.rowBody}>
                  <span style={S.guestName}>{entry.display_name}</span>
                  <span style={S.detail}>
                    {entry.photo_count} foto &nbsp;&middot;&nbsp; {entry.total_likes} like &nbsp;&middot;&nbsp; {entry.mission_bonus} bonus
                  </span>
                </div>
                <span style={S.score}>{entry.score} pt</span>
              </li>
            );
          })}
        </ol>
      )}

      <footer style={S.footer}>
        {updatedAt
          ? `Aggiornato alle ${formatTime(updatedAt)}`
          : 'SERENA AND UGO’S WEDDING · A ONE-DAY MAGAZINE'}
      </footer>
    </div>
  );
}

function SkeletonList() {
  return (
    <div style={{ padding: '8px 0' }}>
      <style>{`@keyframes skPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: '0.5px solid rgba(14,14,14,0.08)', animation: 'skPulse 1.4s ease-in-out infinite' }}>
          <div style={{ width: 24, height: 24, background: '#E8E3DD', borderRadius: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, width: '45%', background: '#E8E3DD', borderRadius: 2, marginBottom: 6 }} />
            <div style={{ height: 10, width: '65%', background: '#E8E3DD', borderRadius: 2 }} />
          </div>
          <div style={{ width: 48, height: 18, background: '#E8E3DD', borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}

const S = {
  page:        { minHeight: '100dvh', background: '#F8F5F0', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' },
  homeBtn:     { background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: '10px 20px 4px', alignSelf: 'flex-start' },
  header:      { padding: '10px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(14,14,14,0.1)', background: '#F8F5F0', flexShrink: 0 },
  headerLeft:  { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#0E0E0E', textTransform: 'uppercase' },
  headerRight: { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase' },
  titleRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '20px 20px 12px', borderBottom: '0.5px solid rgba(14,14,14,0.1)' },
  sectionLabel:{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A', marginBottom: 6 },
  title:       { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 28, fontWeight: 500, color: '#0E0E0E', lineHeight: 1.1 },
  refreshBtn:  { background: 'transparent', border: '0.5px solid rgba(139,26,26,0.5)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 12px', color: '#8B1A1A', flexShrink: 0 },
  list:        { listStyle: 'none', margin: 0, padding: 0, flex: 1 },
  row:         { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '0.5px solid rgba(14,14,14,0.08)' },
  rowTop3:     { background: 'rgba(139,26,26,0.04)' },
  rowMine:     { borderLeft: '3px solid #8B1A1A', paddingLeft: 17 },
  rank:        { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 24, fontWeight: 500, width: 36, flexShrink: 0, textAlign: 'right' },
  rowBody:     { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  guestName:   { fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#0E0E0E', letterSpacing: '0.04em' },
  detail:      { fontFamily: 'Georgia, serif', fontSize: 11, color: '#999', letterSpacing: '0.06em' },
  score:       { fontFamily: 'Georgia, serif', fontSize: 20, color: '#8B1A1A', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  center:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' },
  ctaBtn:      { display: 'inline-block', padding: '12px 24px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', border: 'none', borderRadius: 2, cursor: 'pointer' },
  footer:      { padding: '10px 20px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.22em', textAlign: 'center', textTransform: 'uppercase', flexShrink: 0, marginTop: 'auto' },
};
