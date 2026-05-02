import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

const FILTER_LABELS = {
  originale:        'ORIGINALE',
  bn_drama:         'B&N',
  sepia_editorial:  'SEPIA',
  bloom_cipria:     'BLOOM',
  vintage_polaroid: 'VINTAGE',
  inchiostro:       'INCHIOSTRO',
  notte_party:      'NOTTE',
};

function formatDate(isoStr) {
  if (!isoStr) return '';
  return new Intl.DateTimeFormat('it-IT', {
    day:    'numeric',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(isoStr));
}

export default function PhotoDetail() {
  const { photoId } = useParams();
  const { state }   = useLocation();
  const navigate    = useNavigate();

  const [photo,   setPhoto]   = useState(state?.photo ?? null);
  const [loading, setLoading] = useState(!state?.photo);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (photo) return;
    setLoading(true);
    fetch(`/api/photos/${photoId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setPhoto(d))
      .catch(() => setError('Foto non trovata.'))
      .finally(() => setLoading(false));
  }, [photoId, photo]);

  return (
    <div className="page-enter" style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <button onClick={() => navigate('/gallery')} style={S.backBtn}>
          &larr; GALLERIA
        </button>
        <span style={S.headerRight}>FOTO</span>
      </header>

      {loading ? (
        <div style={S.center}>
          <p style={S.caveatItalic}>caricando…</p>
        </div>

      ) : error || !photo ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A', marginBottom: 16 }}>
            {error || 'Foto non trovata.'}
          </p>
          <button onClick={() => navigate('/gallery')} style={S.ctaBtn}>
            TORNA ALLA GALLERIA
          </button>
        </div>

      ) : (
        <>
          {/* Full-width image on dark bg */}
          <div style={{ background: '#0E0E0E', flexShrink: 0 }}>
            <img
              src={photo.thumbnail_url || photo.web_url}
              alt={photo.guest_name || 'foto'}
              style={{
                display: 'block',
                width: '100%',
                maxHeight: '62vh',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Metadata */}
          <div style={{ flex: 1, padding: '20px 20px 32px', overflowY: 'auto' }}>

            {/* Guest name */}
            <p style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 26,
              color: '#0E0E0E',
              marginBottom: 4,
            }}>
              {photo.guest_name || '—'}
            </p>

            {/* Filter + date */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 16,
            }}>
              <span style={{
                fontFamily: 'Georgia, serif',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#8B1A1A',
              }}>
                {FILTER_LABELS[photo.filter_used] ?? photo.filter_used ?? '—'}
              </span>
              <span style={{
                fontFamily: 'Georgia, serif',
                fontSize: 10,
                letterSpacing: '0.1em',
                color: '#2A2A2A',
              }}>
                {formatDate(photo.created_at)}
              </span>
            </div>

            <div style={{ height: '0.5px', background: 'rgba(14,14,14,0.1)', marginBottom: 16 }} />

            {/* Dedication */}
            {photo.dedication ? (
              <p style={{
                fontFamily: "'Caveat', cursive",
                fontSize: 19,
                color: '#2A2A2A',
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}>
                &ldquo;{photo.dedication}&rdquo;
              </p>
            ) : (
              <p style={{
                fontFamily: 'Georgia, serif',
                fontSize: 11,
                color: '#2A2A2A',
                opacity: 0.35,
                letterSpacing: '0.1em',
              }}>
                Nessuna dedica.
              </p>
            )}
          </div>
        </>
      )}

      <footer style={S.footer}>
        SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
      </footer>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100dvh',
    background: '#F8F5F0',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 480,
    margin: '0 auto',
  },
  header: {
    padding: '14px 20px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '0.5px solid rgba(14,14,14,0.1)',
    background: '#F8F5F0',
    flexShrink: 0,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    letterSpacing: '0.18em',
    color: '#0E0E0E',
    textTransform: 'uppercase',
    cursor: 'pointer',
    padding: 0,
  },
  headerRight: {
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    letterSpacing: '0.18em',
    color: '#8B1A1A',
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  caveatItalic: {
    fontFamily: "'Caveat', cursive",
    fontSize: 20,
    color: '#2A2A2A',
    fontStyle: 'italic',
  },
  ctaBtn: {
    display: 'inline-block',
    padding: '12px 24px',
    background: '#0E0E0E',
    color: '#F8F5F0',
    fontFamily: 'Georgia, serif',
    fontSize: 11,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    border: 'none',
    borderRadius: 2,
    cursor: 'pointer',
  },
  footer: {
    padding: '10px 20px',
    background: '#0E0E0E',
    color: '#F8F5F0',
    fontFamily: 'Georgia, serif',
    fontSize: 9,
    letterSpacing: '0.25em',
    textAlign: 'center',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
};
