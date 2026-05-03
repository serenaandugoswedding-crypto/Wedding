import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

function getTopLikeThreshold(photos) {
  if (photos.length === 0) return Infinity;
  const sorted = [...photos].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0));
  const topCount = Math.max(1, Math.ceil(photos.length * 0.15));
  const threshold = sorted[topCount - 1]?.like_count ?? 0;
  return threshold > 0 ? threshold : Infinity;
}

export default function Gallery() {
  const navigate = useNavigate();
  const [photos,     setPhotos]     = useState([]);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [newCount,   setNewCount]   = useState(0);
  const [likedIds,   setLikedIds]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('wedding_likes') ?? '[]'); }
    catch { return []; }
  });
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

  async function handleLike(photoId) {
    if (likedIds.includes(photoId)) return;
    const newLikedIds = [...likedIds, photoId];
    setLikedIds(newLikedIds);
    localStorage.setItem('wedding_likes', JSON.stringify(newLikedIds));
    setPhotos(prev => prev.map(p =>
      p.id === photoId ? { ...p, like_count: (p.like_count ?? 0) + 1 } : p,
    ));
    try {
      await fetch(`/api/photos/${photoId}`, { method: 'POST' });
    } catch { /* rollback silenzioso */ }
  }

  const threshold = getTopLikeThreshold(photos);

  return (
    <div className="page-enter" style={S.page}>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        @keyframes heartPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
      <button onClick={() => navigate('/')} style={S.homeBtn}>
        &larr; HOME
      </button>
      <GalleryHeader />

      {newCount > 0 && (
        <button onClick={handleBadge} style={S.badge}>
          &uarr; {newCount} nuove foto &mdash; aggiorna
        </button>
      )}

      <div style={{ padding: '14px 20px 0' }}>
        <p style={S.sectionLabel}>IL PROVINO DEL GIORNO</p>
        {!loading && total > 0 && (
          <p style={S.totalLine}>{total} foto pubblicate</p>
        )}
      </div>

      {loading ? (
        <div style={S.grid}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
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
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', lineHeight: 1.9, marginBottom: 28 }}>
            Nessuna foto ancora.<br />Sii il primo a scattare.
          </p>
          <button onClick={() => navigate('/camera')} style={S.ctaBtn}>
            SCATTA ORA &nbsp;&rarr;
          </button>
        </div>
      ) : (
        <div style={S.grid}>
          {photos.map(photo => (
            <PolaroidCard
              key={photo.id}
              photo={photo}
              isLiked={likedIds.includes(photo.id)}
              isTop={(photo.like_count ?? 0) >= threshold && threshold !== Infinity}
              onClick={() => navigate(`/gallery/${photo.id}`, { state: { photo } })}
              onLike={() => handleLike(photo.id)}
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
            &larr; PRECEDENTE
          </button>
          <span style={S.pageInfo}>Pagina {page} di {totalPages}</span>
          <button
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages}
            style={{ ...S.pageBtn, opacity: page >= totalPages ? 0.3 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
          >
            SUCCESSIVA &rarr;
          </button>
        </div>
      )}

      <GalleryFooter />
    </div>
  );
}

// ── Polaroid card ──────────────────────────────────────────────

function PolaroidCard({ photo, isLiked, isTop, onClick, onLike }) {
  const [imgErr,    setImgErr]    = useState(false);
  const [hovered,   setHovered]   = useState(false);
  const [animating, setAnimating] = useState(false);
  const rot = Math.max(-6, Math.min(6, photo.rotation_deg ?? 0));
  const src = imgErr ? null : (photo.thumbnail_url || photo.web_url);

  function handleLikeClick(e) {
    e.stopPropagation();
    if (isLiked) return;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 200);
    onLike();
  }

  const scale = isTop ? 1.08 : hovered ? 1.03 : 1;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        transform: `rotate(${rot}deg) scale(${scale})`,
        transformOrigin: 'center bottom',
        transition: 'transform 300ms ease',
        zIndex: isTop ? 3 : hovered ? 2 : 1,
        position: 'relative',
        width: '100%',
      }}
    >
      <div style={{
        background: '#FFFFFF',
        padding: '12px 12px 8px',
        boxShadow: hovered || isTop
          ? '0 8px 24px rgba(0,0,0,0.18)'
          : '0 4px 16px rgba(0,0,0,0.12)',
        boxSizing: 'border-box',
        transition: 'box-shadow 200ms ease',
      }}>
        {src ? (
          <img
            src={src}
            alt={photo.guest_name || 'foto'}
            onError={() => setImgErr(true)}
            style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%', aspectRatio: '4 / 3', background: '#F0EDE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#2A2A2A', opacity: 0.18 }}>✕</span>
          </div>
        )}

        {/* Bordo inferiore polaroid — colonna verticale */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {photo.mission_name && (
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: 10, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: '#8B1A1A', background: 'rgba(139,26,26,0.06)',
              padding: '2px 6px', borderRadius: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              alignSelf: 'flex-start', maxWidth: '100%',
            }}>
              🎯 {photo.mission_name}
            </p>
          )}
          <p style={{
            fontFamily: "'Caveat', cursive", fontSize: 16, color: '#333333',
            lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {photo.guest_name || '—'}
          </p>
          <button
            onClick={handleLikeClick}
            style={{
              background: 'transparent', border: 'none', cursor: isLiked ? 'default' : 'pointer',
              padding: 0, display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
            }}
          >
            <span style={{
              fontSize: 14, color: isLiked ? '#8B1A1A' : '#999', display: 'inline-block',
              animation: animating ? 'heartPop 200ms ease' : 'none',
            }}>
              {isLiked ? '♥' : '♡'}
            </span>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#999' }}>
              {photo.like_count ?? 0}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton card ──────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: '#FFFFFF', padding: '12px 12px 24px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', boxSizing: 'border-box',
      animation: 'skeletonPulse 1.4s ease-in-out infinite',
    }}>
      <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#E8E3DD', borderRadius: 1 }} />
      <div style={{ height: 14, width: '55%', background: '#E8E3DD', borderRadius: 2, margin: '10px auto 0' }} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function GalleryHeader() {
  return (
    <header style={{
      padding: '14px 20px 12px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', borderBottom: '0.5px solid rgba(14,14,14,0.1)',
      flexShrink: 0, background: '#F5F0EB',
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
      padding: '10px 20px', background: '#0E0E0E', color: '#F8F5F0',
      fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.25em',
      textAlign: 'center', textTransform: 'uppercase', flexShrink: 0, marginTop: 'auto',
    }}>
      SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
    </footer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const S = {
  page:         { minHeight: '100dvh', background: '#F5F0EB', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' },
  homeBtn:      { background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: '10px 20px 4px', alignSelf: 'flex-start' },
  badge:        { display: 'block', width: '100%', padding: '9px 20px', background: '#8B1A1A', color: '#FFFFFF', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', textAlign: 'center' },
  sectionLabel: { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', color: '#2A2A2A', textTransform: 'uppercase', marginBottom: 0 },
  totalLine:    { fontFamily: 'Georgia, serif', fontSize: 10, color: '#8B1A1A', letterSpacing: '0.1em', marginTop: 4 },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', padding: '28px 16px 24px', gap: '24px' },
  center:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' },
  ctaBtn:       { display: 'inline-block', padding: '12px 24px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', border: 'none', borderRadius: 2, cursor: 'pointer' },
  paginationRow:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '0.5px solid rgba(14,14,14,0.1)', marginTop: 8 },
  pageBtn:      { background: 'transparent', border: '0.5px solid rgba(139,26,26,0.4)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8B1A1A', padding: '6px 12px' },
  pageInfo:     { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#2A2A2A' },
};
