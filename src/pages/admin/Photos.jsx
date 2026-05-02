import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE   = 20;
const MAX_ZIP     = 50;
const getAdminToken = () => sessionStorage.getItem('admin_token');

function formatBytes(b) {
  if (!b) return '0 B';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(0)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export default function AdminPhotos() {
  const navigate = useNavigate();

  const [photos,     setPhotos]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [status,     setStatus]     = useState('live');
  const [selected,   setSelected]   = useState(new Set());
  const [stats,      setStats]      = useState(null);
  const [actionMsg,  setActionMsg]  = useState('');
  const [modalPhoto, setModalPhoto] = useState(null);
  const [busy,       setBusy]       = useState(false);

  function handle401() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin', { state: { expired: true } });
  }

  async function apiFetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`,
        ...(opts.headers ?? {}),
      },
    });
    if (res.status === 401) { handle401(); throw new Error('401'); }
    return res;
  }

  const loadPhotos = useCallback(async (p, st) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/admin/photos?page=${p}&limit=${PAGE_SIZE}&status=${st}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setPhotos(d.photos ?? []);
      setTotal(d.total ?? 0);
      setPage(d.page ?? p);
      setTotalPages(d.pages ?? 1);
    } catch (e) {
      if (e.message !== '401') setError('Errore nel caricamento.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadStats() {
    try {
      const res = await apiFetch('/api/admin/photos?action=stats');
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    loadPhotos(1, 'live');
    loadStats();
  }, []);

  function changeStatus(s) {
    setStatus(s);
    setSelected(new Set());
    loadPhotos(1, s);
  }

  function goPage(p) {
    setSelected(new Set());
    window.scrollTo({ top: 0 });
    loadPhotos(p, status);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll()   { setSelected(new Set(photos.map(p => p.id))); }
  function deselectAll() { setSelected(new Set()); }

  async function runAction(action) {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setActionMsg('');
    try {
      const res = await apiFetch(`/api/admin/photos/actions?action=${action}`, {
        method: 'POST',
        body:   JSON.stringify({ ids }),
      });
      if (!res.ok) { setActionMsg('Errore.'); return; }
      setSelected(new Set());
      await Promise.all([loadPhotos(page, status), loadStats()]);
    } catch (e) {
      if (e.message !== '401') setActionMsg('Errore.');
    } finally {
      setBusy(false);
    }
  }

  async function runZip(ids) {
    if (!ids.length) return;
    if (ids.length > MAX_ZIP) { setActionMsg(`Max ${MAX_ZIP} foto per ZIP.`); return; }
    setBusy(true);
    setActionMsg('Preparando ZIP…');
    try {
      const res = await fetch('/api/admin/photos/actions?action=zip', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAdminToken()}` },
        body:    JSON.stringify({ ids }),
      });
      if (res.status === 401) { handle401(); return; }
      if (!res.ok) { setActionMsg('Errore ZIP.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `wedding_photos_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMsg('');
    } catch (e) {
      if (e.message !== '401') setActionMsg('Errore ZIP.');
    } finally {
      setBusy(false);
    }
  }

  async function runModalAction(action, photoId) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/photos/actions?action=${action}`, {
        method: 'POST',
        body:   JSON.stringify({ ids: [photoId] }),
      });
      if (res.ok) {
        setModalPhoto(null);
        await Promise.all([loadPhotos(page, status), loadStats()]);
      }
    } catch { /* 401 handled */ } finally { setBusy(false); }
  }

  async function validateMission(photoId, percent) {
    setBusy(true);
    try {
      const res = await apiFetch('/api/admin/missions?action=validate', {
        method: 'POST',
        body:   JSON.stringify({ photo_id: photoId, percent }),
      });
      if (res.ok) {
        const d = await res.json();
        setModalPhoto(prev => prev ? { ...prev, mission_score: d.mission_score } : prev);
        await loadPhotos(page, status);
      }
    } catch { /* 401 handled */ } finally { setBusy(false); }
  }

  function logout() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  const selCount  = selected.size;
  const zipOk     = selCount > 0 && selCount <= MAX_ZIP;

  return (
    <div style={S.page}>
      <style>{`
        @media (min-width: 640px) { .admin-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => navigate('/admin/dashboard')} style={S.backLink}>← DASHBOARD</button>
          <span style={S.headerSub}>ADMIN &middot; FOTO</span>
          <span style={S.headerTitle}>Gestione foto</span>
        </div>
        <button onClick={logout} style={S.exitBtn}>ESCI</button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={S.statsBar}>
          <span>Live: <b>{stats.counts.live}</b></span>
          <span style={S.dot}>&middot;</span>
          <span>Eliminate: <b>{stats.counts.deleted}</b></span>
          <span style={S.dot}>&middot;</span>
          <span>Archiviate: <b>{stats.counts.archived}</b></span>
          <span style={S.dot}>&middot;</span>
          <span>Pick: <b>{stats.counts.editors_picks}</b></span>
          <span style={S.dot}>&middot;</span>
          <span>{formatBytes(stats.storage.photos_bytes)} + {formatBytes(stats.storage.archive_bytes)} = {formatBytes(stats.storage.total_bytes)}</span>
        </div>
      )}

      {/* Filters */}
      <div style={S.filterRow}>
        {[['live','LIVE'],['deleted','ELIMINATE'],['all','TUTTE']].map(([s, label]) => (
          <button
            key={s}
            onClick={() => changeStatus(s)}
            style={{ ...S.filterBtn, ...(status === s ? S.filterBtnActive : {}) }}
          >
            {label}
          </button>
        ))}
        <button onClick={() => loadPhotos(page, status)} style={S.refreshBtn}>AGGIORNA</button>
      </div>

      {/* Select + bulk toolbar */}
      <div style={S.selectRow}>
        <button onClick={selectAll}   style={S.selectBtn}>SELEZIONA TUTTE</button>
        <span style={{ color: 'rgba(14,14,14,0.2)', margin: '0 8px' }}>|</span>
        <button onClick={deselectAll} style={S.selectBtn}>DESELEZIONA</button>
        {selCount > 0 && <span style={S.selCount}>&nbsp;&nbsp;{selCount} selezionate</span>}
      </div>

      {selCount > 0 && (
        <div style={S.bulkBar}>
          <button onClick={() => runAction('delete')}        disabled={busy} style={S.bulkBtn}>ELIMINA ({selCount})</button>
          <button onClick={() => runAction('restore')}       disabled={busy} style={S.bulkBtn}>RIPRISTINA ({selCount})</button>
          <button onClick={() => runAction('mark-archived')} disabled={busy} style={S.bulkBtn}>ARCHIVIA ({selCount})</button>
          <button
            onClick={() => runZip([...selected])}
            disabled={busy || !zipOk}
            style={{ ...S.bulkBtn, opacity: zipOk ? 1 : 0.35 }}
            title={selCount > MAX_ZIP ? `Max ${MAX_ZIP} foto per ZIP` : ''}
          >
            ZIP ({selCount})
          </button>
          {selCount > MAX_ZIP && (
            <span style={S.actionMsg}>Max {MAX_ZIP} foto per ZIP.</span>
          )}
          {actionMsg && selCount <= MAX_ZIP && (
            <span style={S.actionMsg}>{actionMsg}</span>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={S.center}><p style={S.caveat}>caricando…</p></div>
      ) : error ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A', marginBottom: 12 }}>{error}</p>
          <button onClick={() => loadPhotos(page, status)} style={S.refreshBtn}>RIPROVA</button>
        </div>
      ) : photos.length === 0 ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#666' }}>Nessuna foto.</p>
        </div>
      ) : (
        <div className="admin-grid" style={S.grid}>
          {photos.map(photo => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              checked={selected.has(photo.id)}
              onToggle={() => toggleSelect(photo.id)}
              onOpen={() => setModalPhoto(photo)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div style={S.paginationRow}>
          <button onClick={() => goPage(page - 1)} disabled={page <= 1} style={{ ...S.pageBtn, opacity: page <= 1 ? 0.3 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}>
            &larr; PREC
          </button>
          <span style={S.pageInfo}>Pagina {page} di {totalPages}</span>
          <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} style={{ ...S.pageBtn, opacity: page >= totalPages ? 0.3 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}>
            SUCC &rarr;
          </button>
        </div>
      )}

      {/* Single photo modal */}
      {modalPhoto && (
        <PhotoModal
          photo={modalPhoto}
          busy={busy}
          onClose={() => setModalPhoto(null)}
          onAction={action => runModalAction(action, modalPhoto.id)}
          onZip={() => runZip([modalPhoto.id])}
          onValidate={(percent) => validateMission(modalPhoto.id, percent)}
        />
      )}
    </div>
  );
}

// ── Photo card ─────────────────────────────────────────────────

function PhotoCard({ photo, checked, onToggle, onOpen }) {
  const src = photo.thumbnail_url || photo.drive_url;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onOpen} style={S.cardBtn}>
        {src ? (
          <img src={src} alt="" style={S.cardImg} />
        ) : (
          <div style={{ ...S.cardImg, background: '#E8E3DD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, opacity: 0.25 }}>✕</span>
          </div>
        )}
        <div style={S.cardMeta}>
          <span style={S.cardName}>{photo.guest_name ?? '—'}</span>
          <span style={S.cardDate}>{formatDate(photo.created_at)}</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
            {photo.deleted_at  && <span style={S.badgeRed}>ELIMINATA</span>}
            {photo.archived_at && <span style={S.badgeGreen}>ARCHIVIATA</span>}
          </div>
        </div>
      </button>
      <label style={S.checkWrap}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#8B1A1A' }}
        />
      </label>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────

function PhotoModal({ photo, busy, onClose, onAction, onZip, onValidate }) {
  const src = photo.drive_url || photo.thumbnail_url;
  return (
    <div onClick={onClose} style={S.overlay}>
      <button onClick={onClose} style={S.closeBtn}>&times;</button>
      <div onClick={e => e.stopPropagation()} style={S.modalContent}>
        <img src={src} alt="" style={{ maxWidth: '90vw', maxHeight: '55vh', objectFit: 'contain', display: 'block' }} />
        <div style={{ padding: '16px 0 12px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: '#F8F5F0', marginBottom: 4 }}>{photo.guest_name ?? '—'}</p>
          {photo.dedication && (
            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13, color: '#999', marginBottom: 8 }}>
              &ldquo;{photo.dedication}&rdquo;
            </p>
          )}
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#888' }}>{formatDate(photo.created_at)}</p>
        </div>

        {photo.mission_id && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
              🎯 Missione: {photo.mission_name ?? photo.mission_id}
            </p>
            {photo.mission_score != null ? (
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#F8F5F0', marginBottom: 8 }}>
                  {photo.mission_score} pt assegnati
                </p>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, color: '#888' }}>CAMBIA:</span>
                  {[25, 50, 75, 100].map(p => (
                    <button key={p} disabled={busy} onClick={() => onValidate(p)} style={S.pctBtn}>{p}%</button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#888', marginBottom: 8 }}>Valida punteggio:</p>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[25, 50, 75, 100].map(p => (
                    <button key={p} disabled={busy} onClick={() => onValidate(p)} style={S.pctBtn}>{p}%</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingBottom: 48 }}>
          <button disabled={busy} onClick={() => onAction('delete')}        style={S.modalBtn}>ELIMINA</button>
          <button disabled={busy} onClick={() => onAction('restore')}       style={S.modalBtn}>RIPRISTINA</button>
          <button disabled={busy} onClick={() => onAction('mark-archived')} style={S.modalBtn}>ARCHIVIA</button>
          <button disabled={busy} onClick={onZip}                           style={S.modalBtn}>SCARICA ZIP</button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const S = {
  page:           { minHeight: '100dvh', background: '#F8F5F0', fontFamily: 'Georgia, serif', maxWidth: 960, margin: '0 auto', paddingBottom: 60 },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '0.5px solid rgba(14,14,14,0.12)', background: '#F8F5F0' },
  backLink:       { background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: 0, marginBottom: 4 },
  headerSub:      { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', color: '#2A2A2A', textTransform: 'uppercase' },
  headerTitle:    { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 28, fontWeight: 500, color: '#0E0E0E', marginTop: 4 },
  exitBtn:        { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.3)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', color: '#0E0E0E' },
  statsBar:       { display: 'flex', flexWrap: 'wrap', gap: '4px 8px', padding: '10px 24px', background: '#F0EDE8', borderBottom: '0.5px solid rgba(14,14,14,0.08)', fontFamily: 'Georgia, serif', fontSize: 11, color: '#666', alignItems: 'center' },
  dot:            { color: '#bbb' },
  filterRow:      { display: 'flex', gap: 8, padding: '12px 24px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '0.5px solid rgba(14,14,14,0.08)' },
  filterBtn:      { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.3)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', padding: '5px 14px', color: '#2A2A2A' },
  filterBtnActive:{ background: '#8B1A1A', color: '#FFFFFF', border: '0.5px solid #8B1A1A' },
  refreshBtn:     { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.2)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', padding: '5px 14px', color: '#666', marginLeft: 'auto' },
  selectRow:      { padding: '8px 24px', borderBottom: '0.5px solid rgba(14,14,14,0.06)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
  selectBtn:      { background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', padding: 0, color: '#8B1A1A' },
  selCount:       { fontFamily: 'Georgia, serif', fontSize: 10, color: '#666', letterSpacing: '0.1em' },
  bulkBar:        { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 24px', background: '#0E0E0E', alignItems: 'center' },
  bulkBtn:        { background: 'transparent', border: '0.5px solid rgba(248,245,240,0.4)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer', padding: '5px 12px', color: '#F8F5F0' },
  actionMsg:      { fontFamily: 'Georgia, serif', fontSize: 11, color: '#F8A0A0', marginLeft: 8 },
  grid:           { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, padding: '16px 24px' },
  cardBtn:        { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.1)', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left', display: 'block' },
  cardImg:        { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' },
  cardMeta:       { padding: '8px 10px 10px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 2 },
  cardName:       { fontFamily: "'Caveat', cursive", fontSize: 13, color: '#0E0E0E' },
  cardDate:       { fontFamily: 'Georgia, serif', fontSize: 11, color: '#999' },
  badgeRed:       { fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8B1A1A', background: 'rgba(139,26,26,0.08)', padding: '1px 5px' },
  badgeGreen:     { fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1A6B2A', background: 'rgba(26,107,42,0.08)', padding: '1px 5px' },
  checkWrap:      { position: 'absolute', top: 8, left: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.88)', padding: 3, borderRadius: 2 },
  center:         { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' },
  caveat:         { fontFamily: "'Caveat', cursive", fontSize: 20, color: '#2A2A2A', fontStyle: 'italic' },
  paginationRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '0.5px solid rgba(14,14,14,0.1)' },
  pageBtn:        { background: 'transparent', border: '0.5px solid rgba(139,26,26,0.4)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8B1A1A', padding: '5px 12px', cursor: 'pointer' },
  pageInfo:       { fontFamily: 'Georgia, serif', fontSize: 11, color: '#666', letterSpacing: '0.1em' },
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 200, cursor: 'pointer', overflowY: 'auto' },
  closeBtn:       { position: 'fixed', top: 16, right: 20, background: 'none', border: 'none', color: '#FFFFFF', fontSize: 32, lineHeight: 1, cursor: 'pointer', zIndex: 201, padding: '4px 8px', fontFamily: 'Georgia, serif' },
  modalContent:   { display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '90vw', cursor: 'default' },
  modalBtn:       { background: 'transparent', border: '0.5px solid rgba(248,245,240,0.4)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', color: '#F8F5F0' },
  pctBtn:         { background: 'rgba(139,26,26,0.15)', border: '0.5px solid rgba(139,26,26,0.6)', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer', padding: '5px 12px', color: '#F8A0A0', borderRadius: 2 },
};
