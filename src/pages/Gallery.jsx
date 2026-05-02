import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

export default function Gallery() {
  const navigate = useNavigate();
  const [photos,     setPhotos]     = useState([]);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [newCount,   setNewCount]   = useState(0);
  const firstLoadTs = useRef(null);

  const loadPage = useCallback(async (p) => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/photos?page=${p}&limit=${PAGE_SIZE}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setPhotos(d.photos);
      setPage(d.page);
      setTotalPages(d.pages);
      setTotal(d.total);
      if (!firstLoadTs.current) firstLoadTs.current = new Date().toISOString();
    } catch {
      setError('Errore nel caricamento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage]);

  // Polling 30s — badge "X nuove foto"
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!firstLoadTs.current) return;
      try {
        const r = await fetch(`/api/photos?action=count-since&ts=${encodeURIComponent(firstLoadTs.current)}`);
        if (r.ok) {
          const { count } = await r.json();
          if (count > 0) setNewCount(count);
        }
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  function handleBadge() {
    firstLoadTs.current = new Date().toISOString();
    setNewCount(0);
    window.scrollTo({ top: 0 });
    loadPage(1);
  }

  function goPage(p) {
    setNewCount(0);
    window.scrollTo({ top: 0 });
    loadPage(p);
  }

  return (
    <div className="page-enter" style={S.page}>
      <GalleryHeader />

      {newCount > 0 && (
        <button onClick={handleBadge} style={S.badge}>
          +{newCount} nuove foto &middot; aggiorna
        </button>
      )}

      <div style={{ padding: '14px 20px 0' }}>
        <p style={S.sectionLabel}>IL PROVINO DEL GIORNO</p>
        {!loading && total > 0 && (
          <p style={S.totalLine}>{total} foto pubblicate</p>
        )}
      </div>

      {loading ? (
        <div style={S.center}>
          <p style={S.caveatItalic}>caricando…</p>
        </div>
      ) : error ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A', marginBottom: 16 }}>
            {error}
          </p>
          <button onClick={() => loadPage(page)} style={S.ctaBtn}>RIPROVA</button>
        </div>
      ) : photos.length === 0 ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', lineHeight: 1.8, marginBottom: 24 }}>
            Nessuna foto ancora.<br />Sii il primo a pubblicare.
          </p>
          <button onClick={() => navigate('/camera')} style={S.ctaBtn}>
            SCATTA UNA FOTO &nbsp;&rarr;
          </button>
        </div>
      ) : (
        <div style={S.grid}>
          {photos.map(photo => (
            <PolaroidCard
              key={photo.id}
              photo={photo}
              onClick={() => navigate(`/gallery/${photo.id}`, { state: { photo } })}
            />
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div style={S.paginationRow}>
          <button
            onClick={() => goPage(page - 1)}
            disabled={page <= 1}
            style={{ ...S.pageBtn, opacity: page <= 1 ? 0.3 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
          >
            &larr; PREC
          </button>
          <span style={S.pageInfo}>p. {page} / {totalPages}</span>
          <button
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages}
            style={{ ...S.pageBtn, opacity: page >= totalPages ? 0.3 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
          >
            SUCC &rarr;
          </button>
        </div>
      )}

      <GalleryFooter />
    </div>
  );
}

// ── Polaroid card ──────────────────────────────────────────────

function PolaroidCard({ photo, onClick }) {
  const [imgErr, setImgErr] = useState(false);
  const rot = Math.max(-4, Math.min(4, photo.rotation_deg ?? 0));
  const src = imgErr ? null : (photo.thumbnail_url || photo.web_url);

  return (
    <div style={{ padding: '10px 6px', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={onClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          transform: `rotate(${rot}deg)`,
          width: '100%',
        }}
      >
        <div style={{
          background: '#FFFFFF',
          padding: '7px 7px 26px',
          boxShadow: '0 2px 10px rgba(14,14,14,0.18), 0 1px 3px rgba(14,14,14,0.08)',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {src ? (
            <img
              src={src}
              alt={photo.guest_name || 'foto'}
              onError={() => setImgErr(true)}
              style={{
                display: 'block',
                width: '100%',
                aspectRatio: '1',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              aspectRatio: '1',
              background: '#F0EDE8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#2A2A2A', opacity: 0.18 }}>
                ✕
              </span>
            </div>
          )}
          <p style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 12,
            color: '#2A2A2A',
            marginTop: 6,
            textAlign: 'center',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {photo.guest_name || '—'}
          </p>
        </div>
      </button>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function GalleryHeader() {
  return (
    <header style={{
      padding: '14px 20px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '0.5px solid rgba(14,14,14,0.1)',
      flexShrink: 0,
      background: '#F8F5F0',
    }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#0E0E0E', textTransform: 'uppercase' }}>
        VOL. I &middot; ISSUE 01
      </span>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase' }}>
        GALLERIA
      </span>
    </header>
  );
}

function GalleryFooter() {
  return (
    <footer style={{
      padding: '10px 20px',
      background: '#0E0E0E',
      color: '#F8F5F0',
      fontFamily: 'Georgia, serif',
      fontSize: 9,
      letterSpacing: '0.25em',
      textAlign: 'center',
      textTransform: 'uppercase',
      flexShrink: 0,
      marginTop: 'auto',
    }}>
      SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
    </footer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100dvh',
    background: '#F8F5F0',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 480,
    margin: '0 auto',
  },
  badge: {
    display: 'block',
    width: '100%',
    padding: '9px 20px',
    background: '#0E0E0E',
    color: '#F8F5F0',
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    letterSpacing: '0.28em',
    color: '#2A2A2A',
    textTransform: 'uppercase',
    marginBottom: 0,
  },
  totalLine: {
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    color: '#8B1A1A',
    letterSpacing: '0.1em',
    marginTop: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: '4px 12px 16px',
    gap: '0 4px',
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
  paginationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderTop: '0.5px solid rgba(14,14,14,0.1)',
    marginTop: 8,
  },
  pageBtn: {
    background: 'transparent',
    border: 'none',
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: '#0E0E0E',
    padding: '4px 0',
  },
  pageInfo: {
    fontFamily: 'Georgia, serif',
    fontSize: 10,
    letterSpacing: '0.18em',
    color: '#2A2A2A',
  },
};
