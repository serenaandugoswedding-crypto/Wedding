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

  function close() { navigate('/gallery'); }

  return (
    <div onClick={close} style={S.overlay}>
      <button onClick={close} style={S.closeBtn}>&times;</button>

      {loading ? (
        <p style={S.caveatLight}>caricando…</p>

      ) : error || !photo ? (
        <div style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#F8F5F0', marginBottom: 20 }}>
            {error || 'Foto non trovata.'}
          </p>
          <button onClick={close} style={S.backBtn}>← GALLERIA</button>
        </div>

      ) : (
        <div onClick={e => e.stopPropagation()} style={S.content}>
          <img
            src={photo.web_url}
            alt={photo.guest_name || 'foto'}
            style={S.img}
          />
          <div style={S.meta}>
            <p style={S.guestName}>{photo.guest_name || '—'}</p>
            {photo.dedication && (
              <p style={S.dedication}>&ldquo;{photo.dedication}&rdquo;</p>
            )}
            {photo.mission_name && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>
                  🎯 Missione: {photo.mission_name}
                </p>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#999' }}>
                  {photo.mission_score != null
                    ? `${photo.mission_score} pt assegnati`
                    : 'Validazione in corso'}
                </p>
              </div>
            )}
            <p style={S.filterLabel}>
              {FILTER_LABELS[photo.filter_used] ?? photo.filter_used ?? '—'}
            </p>
            <p style={S.dateLabel}>{formatDate(photo.created_at)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    overflowY: 'auto',
    cursor: 'pointer',
  },
  closeBtn: {
    position: 'fixed',
    top: 16,
    right: 20,
    background: 'none',
    border: 'none',
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    zIndex: 101,
    padding: '4px 8px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '90vw',
    width: '100%',
    cursor: 'default',
  },
  img: {
    display: 'block',
    maxWidth: '90vw',
    maxHeight: '70vh',
    objectFit: 'contain',
  },
  meta: {
    width: '100%',
    padding: '20px 0 48px',
    textAlign: 'center',
  },
  guestName: {
    fontFamily: "'Caveat', cursive",
    fontSize: 18,
    color: '#F8F5F0',
    marginBottom: 10,
  },
  dedication: {
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#999999',
    lineHeight: 1.6,
    marginBottom: 12,
    maxWidth: 320,
    margin: '0 auto 12px',
  },
  filterLabel: {
    fontFamily: 'Georgia, serif',
    fontSize: 12,
    color: '#999999',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateLabel: {
    fontFamily: 'Georgia, serif',
    fontSize: 12,
    color: '#999999',
  },
  caveatLight: {
    fontFamily: "'Caveat', cursive",
    fontSize: 20,
    color: '#F8F5F0',
    fontStyle: 'italic',
  },
  backBtn: {
    background: 'transparent',
    border: '0.5px solid rgba(248,245,240,0.4)',
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: '#F8F5F0',
    padding: '8px 16px',
    cursor: 'pointer',
  },
};
