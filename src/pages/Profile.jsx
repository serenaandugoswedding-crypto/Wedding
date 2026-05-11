import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuestIdentity } from '../hooks/useGuestIdentity';

export default function Profile() {
  const navigate = useNavigate();
  const { uuid } = useGuestIdentity();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [missionTab, setMissionTab] = useState('completed');

  useEffect(() => {
    if (!uuid) { navigate('/'); return; }
    fetch(`/api/me?uuid=${encodeURIComponent(uuid)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setData)
      .catch(() => setError('Errore nel caricamento.'))
      .finally(() => setLoading(false));
  }, [uuid, navigate]);

  if (!uuid) return null;

  if (loading) {
    return (
      <div className="page-enter" style={S.page}>
        <HomeBtn navigate={navigate} />
        <EditorialHeader />
        <div style={S.center}><p style={S.caveat}>caricando…</p></div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter" style={S.page}>
        <HomeBtn navigate={navigate} />
        <EditorialHeader />
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A' }}>{error}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const { guest, stats, photos, missions } = data;
  const completedCount = missions.completed.length;
  const availableCount = missions.available.length;

  return (
    <div className="page-enter" style={S.page}>
      <HomeBtn navigate={navigate} />
      <EditorialHeader />

      {/* ── Profilo masthead ── */}
      <div style={{ padding: '28px 20px 20px', textAlign: 'center', background: '#F8F5F0' }}>
        <p style={S.label}>IL MIO NUMERO</p>
        <div style={{
          fontFamily: "'Bodoni Moda', Georgia, serif",
          fontSize: 38, fontWeight: 500, lineHeight: 1.05,
          letterSpacing: '-0.01em', color: '#0E0E0E', marginTop: 8, marginBottom: 14,
        }}>
          {guest.display_name}
        </div>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', marginBottom: 6 }}>
          PUNTEGGIO {guest.score} &middot; {guest.rank ? `${guest.rank}° su ${guest.total_guests}` : '—'}
        </p>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.12em', color: '#2A2A2A', opacity: 0.7 }}>
          {stats.photos_count} foto &middot; {stats.likes_received} like &middot; {stats.missions_submitted} missioni
        </p>
        <div style={{ margin: '16px auto 0', width: '70%', height: '0.5px', background: '#0E0E0E' }} />
      </div>

      {/* ── Le mie foto ── */}
      <div style={{ padding: '8px 20px 0', borderTop: '0.5px solid rgba(14,14,14,0.06)' }}>
        <p style={S.label}>LE MIE FOTO</p>
      </div>

      {photos.length === 0 ? (
        <div style={{ ...S.center, minHeight: 140 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', lineHeight: 1.9, marginBottom: 20 }}>
            Non hai ancora scattato.
          </p>
          <button onClick={() => navigate('/camera')} style={S.ctaBtn}>→ VAI ALLA CAMERA</button>
        </div>
      ) : (
        <div style={S.grid}>
          {photos.map(photo => (
            <ProfilePolaroid
              key={photo.id}
              photo={photo}
              onClick={() => navigate(`/gallery/${photo.id}`, {
                state: { photo: { ...photo, web_url: photo.drive_url } },
              })}
            />
          ))}
        </div>
      )}

      {/* ── Missioni ── */}
      <div style={{ padding: '20px 20px 8px', borderTop: '0.5px solid rgba(14,14,14,0.1)', marginTop: 8 }}>
        <p style={S.label}>MISSIONI</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <SegBtn active={missionTab === 'completed'} onClick={() => setMissionTab('completed')}>
            COMPLETATE ({completedCount})
          </SegBtn>
          <SegBtn active={missionTab === 'available'} onClick={() => setMissionTab('available')}>
            DA FARE ({availableCount})
          </SegBtn>
        </div>
      </div>

      <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {missionTab === 'completed' ? (
          completedCount === 0 ? (
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', padding: '12px 0', opacity: 0.7 }}>
              Nessuna missione completata.
            </p>
          ) : missions.completed.map(m => (
            <div key={m.id} style={S.missionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', color: '#0E0E0E', marginBottom: 3 }}>
                    {m.title}
                  </p>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A' }}>
                    +{m.bonus_points} pt
                  </p>
                </div>
                <span style={{
                  fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.12em',
                  textTransform: 'uppercase', padding: '4px 8px', borderRadius: 2, flexShrink: 0,
                  background: m.status === 'validated' ? 'rgba(14,100,14,0.08)' : 'rgba(139,26,26,0.06)',
                  color: m.status === 'validated' ? '#0E640E' : '#8B1A1A',
                }}>
                  {m.status === 'validated' ? '✓ VALIDATA' : '⏳ IN ATTESA'}
                </span>
              </div>
            </div>
          ))
        ) : (
          availableCount === 0 ? (
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', padding: '12px 0', opacity: 0.7 }}>
              Tutte le missioni completate.
            </p>
          ) : missions.available.map(m => (
            <div key={m.id} style={S.missionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', color: '#0E0E0E', marginBottom: 3 }}>
                    {m.title}
                  </p>
                  {m.description && (
                    <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#666', lineHeight: 1.4, marginBottom: 6 }}>
                      {m.description}
                    </p>
                  )}
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A' }}>
                    +{m.bonus_points} pt
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/camera?mission=${m.id}`)}
                  style={{ ...S.ctaBtnSm, flexShrink: 0, alignSelf: 'flex-start' }}
                >
                  SCATTA →
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Footer />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function ProfilePolaroid({ photo, onClick }) {
  const [imgErr, setImgErr] = useState(false);
  const src = imgErr ? null : (photo.thumbnail_url || photo.drive_url);

  return (
    <div onClick={onClick} style={{ cursor: 'pointer', width: '100%' }}>
      <div style={{
        background: '#FFFFFF', padding: '12px 12px 8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)', boxSizing: 'border-box',
      }}>
        {src ? (
          <img
            src={src}
            alt="foto"
            onError={() => setImgErr(true)}
            style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#2A2A2A', opacity: 0.18 }}>✕</span>
          </div>
        )}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: '#555', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
            {photo.dedication ? (photo.dedication.length > 28 ? photo.dedication.slice(0, 28) + '…' : photo.dedication) : '—'}
          </span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#999', flexShrink: 0 }}>
            ♥ {photo.like_count ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function HomeBtn({ navigate }) {
  return (
    <button
      onClick={() => navigate('/')}
      style={{ background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: '10px 20px 4px', alignSelf: 'flex-start' }}
    >
      &larr; HOME
    </button>
  );
}

function EditorialHeader() {
  return (
    <header style={{ padding: '14px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(14,14,14,0.1)', flexShrink: 0 }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#0E0E0E', textTransform: 'uppercase' }}>VOL. I &middot; ISSUE 01</span>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase' }}>IL MIO NUMERO</span>
    </header>
  );
}

function SegBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      border: '0.5px solid rgba(139,26,26,0.45)', borderRadius: 2,
      fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.14em',
      textTransform: 'uppercase', padding: '7px 10px', cursor: 'pointer',
      background: active ? '#0E0E0E' : 'transparent',
      color: active ? '#F8F5F0' : '#8B1A1A',
    }}>
      {children}
    </button>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '10px 20px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.25em', textAlign: 'center', textTransform: 'uppercase', flexShrink: 0, marginTop: 'auto' }}>
      SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
    </footer>
  );
}

const S = {
  page:       { minHeight: '100dvh', background: '#F8F5F0', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' },
  center:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' },
  caveat:     { fontFamily: "'Caveat', cursive", fontSize: 22, color: '#2A2A2A', fontStyle: 'italic' },
  label:      { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', color: '#2A2A2A', textTransform: 'uppercase', marginBottom: 0 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', padding: '16px 16px 8px', gap: '20px' },
  ctaBtn:     { display: 'inline-block', padding: '11px 22px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', border: 'none', borderRadius: 2, cursor: 'pointer' },
  ctaBtnSm:   { padding: '8px 12px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.20em', textTransform: 'uppercase', border: 'none', borderRadius: 2, cursor: 'pointer' },
  missionCard:{ background: '#FFFFFF', border: '0.5px solid rgba(14,14,14,0.08)', borderRadius: 2, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
};
