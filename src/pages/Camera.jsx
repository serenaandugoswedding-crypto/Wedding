import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FILTERS, applyFilterToCanvas, canvasToBase64, renderThumbnail } from '../lib/filters';
import { useGuestIdentity } from '../hooks/useGuestIdentity';
import { useUploadQueue } from '../hooks/useUploadQueue';

const PHASE = { VIEWFINDER: 'viewfinder', PREVIEW: 'preview', UPLOADING: 'uploading', DONE: 'done' };

export default function Camera() {
  const navigate = useNavigate();
  const { uuid } = useGuestIdentity();
  const { pendingCount, uploadOrQueue } = useUploadQueue();

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const capturedImg = useRef(null);

  const [phase,          setPhase]          = useState(PHASE.VIEWFINDER);
  const [capturedSrc,    setCapturedSrc]    = useState('');
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [filteredSrc,    setFilteredSrc]    = useState('');
  const [thumbnails,     setThumbnails]     = useState([]);
  const [dedication,     setDedication]     = useState('');
  const [missionId,      setMissionId]      = useState('');
  const [missions,       setMissions]       = useState([]);
  const [error,          setError]          = useState('');
  const [cameraError,    setCameraError]    = useState('');

  // Start camera
  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (active) setCameraError('Fotocamera non disponibile. Verifica i permessi del browser.');
      }
    }
    if (phase === PHASE.VIEWFINDER) startCamera();
    return () => { active = false; if (phase !== PHASE.VIEWFINDER) stopStream(); };
  }, [phase]);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  // Load missions
  useEffect(() => {
    fetch('/api/missions')
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.missions && setMissions(d.missions))
      .catch(() => {});
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stopStream();
    setCapturedSrc(canvas.toDataURL('image/jpeg', 0.95));
    setPhase(PHASE.PREVIEW);
  }

  // Build thumbnails once image loads
  useEffect(() => {
    if (!capturedSrc) return;
    const img  = new Image();
    img.onload = () => {
      capturedImg.current = img;
      setThumbnails(FILTERS.map(f => ({ ...f, thumb: renderThumbnail(img, f) })));
      const c = applyFilterToCanvas(img, FILTERS[0]);
      setFilteredSrc(canvasToBase64(c));
    };
    img.src = capturedSrc;
  }, [capturedSrc]);

  function selectFilter(filter) {
    setSelectedFilter(filter);
    if (capturedImg.current) {
      const c = applyFilterToCanvas(capturedImg.current, filter);
      setFilteredSrc(canvasToBase64(c));
    }
  }

  async function handlePublish() {
    if (!uuid) { setError('Torna alla cover e inserisci il tuo nome.'); return; }
    setPhase(PHASE.UPLOADING);
    const result = await uploadOrQueue({
      photo_base64: filteredSrc,
      guest_uuid:   uuid,
      filter_used:  selectedFilter.id,
      dedication:   dedication.trim() || null,
      mission_id:   missionId || null,
    });
    if (result.ok || result.queued) {
      setPhase(PHASE.DONE);
    } else {
      setError(result.error ? `Errore: ${result.error}` : 'Qualcosa è andato storto. Riprova.');
      setPhase(PHASE.PREVIEW);
    }
  }

  function resetForNewShot() {
    setCapturedSrc('');
    setFilteredSrc('');
    setThumbnails([]);
    setDedication('');
    setMissionId('');
    setSelectedFilter(FILTERS[0]);
    setError('');
    setPhase(PHASE.VIEWFINDER);
  }

  // ── DONE ────────────────────────────────────────────────────
  if (phase === PHASE.DONE) {
    return (
      <div className="page-enter" style={S.page}>
        <EditorialHeader right="SCATTA" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 28, color: '#4B1528', marginBottom: 8 }}>
            Pubblicato.
          </p>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', marginBottom: 32, letterSpacing: '0.04em' }}>
            La tua foto è nel wall.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <ActionBtn onClick={resetForNewShot}>SCATTA ANCORA</ActionBtn>
            <ActionBtn onClick={() => navigate('/gallery')} outline>VEDI GALLERIA</ActionBtn>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── UPLOADING ────────────────────────────────────────────────
  if (phase === PHASE.UPLOADING) {
    return (
      <div className="page-enter" style={S.page}>
        <EditorialHeader right="SCATTA" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: '#2A2A2A', fontStyle: 'italic' }}>
            caricando…
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  // ── PREVIEW ──────────────────────────────────────────────────
  if (phase === PHASE.PREVIEW) {
    return (
      <div className="page-enter" style={S.page}>
        <EditorialHeader right="SCATTA" />
        {pendingCount > 0 && <PendingBadge count={pendingCount} />}

        {/* Filtered preview */}
        <div style={{ width: '100%', background: '#0E0E0E', flexShrink: 0 }}>
          {filteredSrc
            ? <img src={filteredSrc} alt="Anteprima" style={{ width: '100%', display: 'block', maxHeight: '55vw', objectFit: 'cover' }} />
            : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: '#F8F5F0', fontStyle: 'italic' }}>applicando il filtro…</p>
              </div>
          }
        </div>

        {/* Filter strip */}
        <div style={{ borderBottom: '0.5px solid rgba(14,14,14,0.1)', flexShrink: 0 }}>
          <div style={{ overflowX: 'auto', display: 'flex', gap: 10, padding: '12px 20px 10px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {thumbnails.map(f => (
              <button
                key={f.id}
                onClick={() => selectFilter(f)}
                style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <div style={{
                  width: 60, height: 60, borderRadius: 2, overflow: 'hidden',
                  outline: selectedFilter.id === f.id ? '1.5px solid #0E0E0E' : '1.5px solid transparent',
                  outlineOffset: 2,
                }}>
                  <img src={f.thumb} alt={f.label} style={{ width: 60, height: 60, display: 'block', objectFit: 'cover' }} />
                </div>
                <span style={{
                  fontFamily: 'Georgia, serif', fontSize: 8, letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: selectedFilter.id === f.id ? '#0E0E0E' : '#2A2A2A',
                  fontWeight: selectedFilter.id === f.id ? 500 : 400,
                }}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Dedication + mission */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          <p style={S.labelSm}>DEDICA — FACOLTATIVA</p>
          <textarea
            value={dedication}
            onChange={e => setDedication(e.target.value)}
            placeholder="Scrivi qualcosa…"
            maxLength={280}
            rows={3}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              borderBottom: '0.5px solid rgba(14,14,14,0.25)', outline: 'none',
              fontFamily: "'Caveat', cursive", fontSize: 18, color: '#0E0E0E',
              resize: 'none', padding: '4px 0 8px', caretColor: '#8B1A1A',
            }}
          />

          {missions.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={S.labelSm}>MISSIONE — FACOLTATIVA</p>
              <select
                value={missionId}
                onChange={e => setMissionId(e.target.value)}
                style={{
                  width: '100%', background: '#F8F5F0',
                  border: '0.5px solid rgba(14,14,14,0.25)', borderRadius: 2,
                  fontFamily: 'Georgia, serif', fontSize: 13, color: '#0E0E0E',
                  padding: '8px 10px', outline: 'none', appearance: 'none',
                }}
              >
                <option value="">Nessuna missione</option>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>{m.title} (+{m.bonus_points}pt)</option>
                ))}
              </select>
            </div>
          )}

          {error && <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A', marginTop: 10 }}>{error}</p>}
        </div>

        {/* PUBBLICA */}
        <div style={{ padding: '14px 20px 20px', borderTop: '0.5px solid rgba(14,14,14,0.1)', background: '#F8F5F0', flexShrink: 0 }}>
          <button onClick={handlePublish} style={S.ctaBtn}>
            PUBBLICA &nbsp;&rarr;
          </button>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: '#2A2A2A', textAlign: 'center', margin: '8px 0 0', fontStyle: 'italic' }}>
            Pubblicato con filtro &middot; {selectedFilter.label}
          </p>
        </div>

        <Footer />
      </div>
    );
  }

  // ── VIEWFINDER ───────────────────────────────────────────────
  return (
    <div style={{ ...S.page, background: '#0E0E0E' }}>
      <div style={{ position: 'absolute', top: 14, left: 20, zIndex: 10 }}>
        <button
          onClick={() => { stopStream(); navigate('/home'); }}
          style={{ background: 'transparent', border: 'none', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', cursor: 'pointer', textTransform: 'uppercase' }}
        >
          &larr;&nbsp; INDIETRO
        </button>
      </div>

      {pendingCount > 0 && (
        <div style={{ position: 'absolute', top: 14, right: 20, zIndex: 10 }}>
          <PendingBadge count={pendingCount} dark />
        </div>
      )}

      {cameraError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#F8F5F0', textAlign: 'center', lineHeight: 1.7 }}>{cameraError}</p>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover', display: 'block' }} />
      )}

      <div style={{ padding: '28px 0 40px', display: 'flex', justifyContent: 'center', background: '#0E0E0E', flexShrink: 0 }}>
        <button
          onClick={capturePhoto}
          disabled={!!cameraError}
          aria-label="Scatta foto"
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#F8F5F0', border: '3px solid rgba(248,245,240,0.3)',
            cursor: cameraError ? 'not-allowed' : 'pointer', outline: 'none',
            boxShadow: '0 0 0 7px rgba(248,245,240,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#F8F5F0' }} />
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function EditorialHeader({ right }) {
  return (
    <header style={{ padding: '14px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(14,14,14,0.1)', flexShrink: 0, background: '#F8F5F0' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#0E0E0E', textTransform: 'uppercase' }}>VOL. I &middot; ISSUE 01</span>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase' }}>{right}</span>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '10px 20px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.25em', textAlign: 'center', textTransform: 'uppercase', flexShrink: 0 }}>
      SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
    </footer>
  );
}

function ActionBtn({ onClick, children, outline = false }) {
  return (
    <button onClick={onClick} style={{
      padding: '11px 22px', borderRadius: 2, cursor: 'pointer',
      fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
      background: outline ? 'transparent' : '#0E0E0E',
      color: outline ? '#0E0E0E' : '#F8F5F0',
      border: outline ? '0.5px solid rgba(14,14,14,0.4)' : 'none',
    }}>{children}</button>
  );
}

function PendingBadge({ count, dark = false }) {
  return (
    <div style={{ padding: '6px 20px', background: dark ? 'rgba(248,245,240,0.08)' : 'rgba(14,14,14,0.04)', borderBottom: dark ? 'none' : '0.5px solid rgba(14,14,14,0.08)' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: dark ? '#F8F5F0' : '#2A2A2A' }}>
        &middot; {count} foto in attesa &middot;
      </span>
    </div>
  );
}

const S = {
  page: { minHeight: '100dvh', background: '#F8F5F0', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' },
  labelSm: { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A', marginBottom: 8 },
  ctaBtn: { display: 'block', width: '100%', padding: '13px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', border: 'none', borderRadius: 2, cursor: 'pointer' },
};
