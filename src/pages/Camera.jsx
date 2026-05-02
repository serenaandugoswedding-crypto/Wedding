import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FILTERS, applyFilterToCanvas, canvasToBase64, resizeCanvasToMaxDimension, renderThumbnail } from '../lib/filters';
import { useGuestIdentity } from '../hooks/useGuestIdentity';
import { useUploadQueue } from '../hooks/useUploadQueue';

const PHASE = { UPLOADING: 'uploading', DONE: 'done' };

export default function Camera() {
  const navigate = useNavigate();
  const { uuid } = useGuestIdentity();
  const { pendingCount, uploadOrQueue } = useUploadQueue();

  const fileInputRef = useRef(null);

  const [phase,              setPhase]              = useState(null);
  const [uploadedImage,      setUploadedImage]      = useState(null);   // HTMLImageElement
  const [originalDimensions, setOriginalDimensions] = useState(null);
  const [isProcessing,       setIsProcessing]       = useState(false);
  const [selectedFilter,     setSelectedFilter]     = useState(FILTERS[0]);
  const [filteredSrc,        setFilteredSrc]        = useState('');
  const [isFilterChanging,   setIsFilterChanging]   = useState(false);
  const [filterThumbnails,   setFilterThumbnails]   = useState({});     // { [filterId]: dataURL }
  const [photoLoadKey,       setPhotoLoadKey]       = useState(0);      // incrementa su ogni nuovo upload → triggera fade-in
  const [dedication,         setDedication]         = useState('');
  const [missionId,          setMissionId]          = useState('');
  const [missions,           setMissions]           = useState([]);
  const [error,              setError]              = useState('');

  // Load missions
  useEffect(() => {
    fetch('/api/missions')
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.missions && setMissions(d.missions))
      .catch(() => {});
  }, []);

  // Genera thumbnail strip progressivamente e anteprima iniziale quando l'immagine è pronta
  useEffect(() => {
    if (!uploadedImage) return;

    // Anteprima iniziale (ORIGINALE, subito)
    const c = applyFilterToCanvas(uploadedImage, FILTERS[0], 1200);
    setFilteredSrc(canvasToBase64(c));

    // Thumbnail progressivi: primo subito, poi uno per volta cedendo il main thread
    async function buildThumbnails() {
      setFilterThumbnails({ [FILTERS[0].id]: renderThumbnail(uploadedImage, FILTERS[0], 90) });
      for (const filter of FILTERS.slice(1)) {
        await new Promise(r => setTimeout(r, 0));
        setFilterThumbnails(prev => ({
          ...prev,
          [filter.id]: renderThumbnail(uploadedImage, filter, 90),
        }));
      }
    }
    buildThumbnails();
  }, [uploadedImage]);

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    setError('');

    // Revoca URL del file precedente per liberare memoria (importante su iPhone con foto grandi)
    if (uploadedImage?.src) URL.revokeObjectURL(uploadedImage.src);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });

    setUploadedImage(img);
    setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setSelectedFilter(FILTERS[0]);
    setFilteredSrc('');
    setFilterThumbnails({});
    setPhotoLoadKey(k => k + 1);
    setIsProcessing(false);
  }

  function selectFilter(filter) {
    setSelectedFilter(filter);
    if (!uploadedImage) return;
    setIsFilterChanging(true);
    // Cede il main thread per far renderizzare l'opacity 0.6 prima del calcolo pesante
    setTimeout(() => {
      const c = applyFilterToCanvas(uploadedImage, filter, 1200);
      setFilteredSrc(canvasToBase64(c));
      setIsFilterChanging(false);
    }, 0);
  }

  async function handlePublish() {
    if (!uuid) { setError('Torna alla cover e inserisci il tuo nome.'); return; }
    if (!uploadedImage) return;
    setPhase(PHASE.UPLOADING);

    // IMPORTANTE: nessun maxDim — il filtro lavora sull'originale full-res.
    // Non aggiungere maxDim qui: causerebbe il bug 486KB dove archive veniva ridotto.
    const filteredCanvas = applyFilterToCanvas(uploadedImage, selectedFilter);
    const photo_archive_base64 = canvasToBase64(filteredCanvas, 0.92);

    // Versione web ridotta a 1600px per la gallery
    const webCanvas        = resizeCanvasToMaxDimension(filteredCanvas, 1600);
    const photo_web_base64 = canvasToBase64(webCanvas, 0.82);

    console.log('[handlePublish] archive:', (photo_archive_base64.length * 0.75 / 1024).toFixed(0), 'KB approx');
    console.log('[handlePublish] web:', (photo_web_base64.length * 0.75 / 1024).toFixed(0), 'KB approx');

    const result = await uploadOrQueue({
      photo_web_base64,
      photo_archive_base64,
      guest_uuid:  uuid,
      filter_used: selectedFilter.id,
      dedication:  dedication.trim() || null,
      mission_id:  missionId || null,
    });
    if (result.ok || result.queued) {
      setPhase(PHASE.DONE);
    } else {
      setError(result.error ? `Errore: ${result.error}` : 'Qualcosa è andato storto. Riprova.');
      setPhase(null);
    }
  }

  function resetUpload() {
    if (uploadedImage?.src) URL.revokeObjectURL(uploadedImage.src);
    setUploadedImage(null);
    setOriginalDimensions(null);
    setSelectedFilter(FILTERS[0]);
    setFilteredSrc('');
    setFilterThumbnails({});
    setDedication('');
    setMissionId('');
    setError('');
    setPhase(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── DONE ────────────────────────────────────────────────────
  if (phase === PHASE.DONE) {
    return (
      <div className="page-enter" style={S.page}>
        <HomeBtn navigate={navigate} />
        <EditorialHeader right="SCATTA" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 28, color: '#4B1528', marginBottom: 8 }}>
            Pubblicato.
          </p>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', marginBottom: 32, letterSpacing: '0.04em' }}>
            La tua foto è nel wall.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <ActionBtn onClick={resetUpload}>SCATTA ANCORA</ActionBtn>
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
        <HomeBtn navigate={navigate} />
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

  // File input condiviso tra stato vuoto e preview
  const fileInput = (
    <input
      type="file"
      accept="image/*"
      onChange={handleFileSelect}
      ref={fileInputRef}
      style={{ display: 'none' }}
    />
  );

  // ── EMPTY STATE ──────────────────────────────────────────────
  if (!uploadedImage) {
    return (
      <div className="page-enter" style={S.page}>
        <HomeBtn navigate={navigate} />
        <EditorialHeader right="SCATTA" />
        {fileInput}
        {pendingCount > 0 && <PendingBadge count={pendingCount} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', letterSpacing: '0.04em', marginBottom: 28, lineHeight: 1.8 }}>
            Aggiungi una foto<br />al numero del giorno.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            style={{ ...S.ctaBtn, opacity: isProcessing ? 0.6 : 1 }}
          >
            {isProcessing ? 'CARICANDO…' : 'SCEGLI O SCATTA →'}
          </button>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 10, color: '#2A2A2A', letterSpacing: '0.12em', marginTop: 20, opacity: 0.45 }}>
            formato jpg · png · heic &nbsp;·&nbsp; max 10MB
          </p>
        </div>

        <Footer />
      </div>
    );
  }

  // ── PREVIEW ──────────────────────────────────────────────────
  const changeFotoBtn = (
    <button
      onClick={resetUpload}
      style={{ background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}
    >
      ↻ CAMBIA
    </button>
  );

  return (
    <div className="page-enter" style={{ ...S.page, height: '100dvh', overflow: 'hidden' }}>
      <style>{`
        @keyframes thumbIn  { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes photoIn  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <HomeBtn navigate={navigate} />
      <EditorialHeader right={changeFotoBtn} compact />
      {fileInput}
      {pendingCount > 0 && <PendingBadge count={pendingCount} />}

      {/* Preview principale — key cambia solo su nuovo upload, non su cambio filtro */}
      <div
        key={photoLoadKey}
        style={{ width: '100%', background: '#0E0E0E', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120, animation: photoLoadKey > 0 ? 'photoIn 0.2s ease-out' : 'none' }}
      >
        {filteredSrc ? (
          <img
            src={filteredSrc}
            alt="Anteprima"
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '55vh',
              objectFit: 'contain',
              opacity: isFilterChanging ? 0.55 : 1,
              transition: 'opacity 0.12s ease-out',
            }}
          />
        ) : (
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: '#F8F5F0', fontStyle: 'italic', padding: '40px 0' }}>
            applicando il filtro…
          </p>
        )}
      </div>

      {/* Filter strip Photoshop-style */}
      <div style={{ borderBottom: '0.5px solid rgba(14,14,14,0.1)', flexShrink: 0 }}>
        <div style={{
          overflowX: 'auto',
          display: 'flex',
          gap: 8,
          padding: '10px 16px 8px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'x mandatory',
        }}>
          {FILTERS.map(f => {
            const thumb = filterThumbnails[f.id];
            const isActive = selectedFilter.id === f.id;
            return (
              <button
                key={f.id}
                onClick={() => selectFilter(f)}
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  scrollSnapAlign: 'start',
                }}
              >
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  overflow: 'hidden',
                  outline: isActive ? '2px solid #8B1A1A' : '1px solid rgba(14,14,14,0.12)',
                  outlineOffset: 2,
                  background: 'rgba(14,14,14,0.06)',
                }}>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={f.label}
                      style={{
                        width: 60,
                        height: 60,
                        display: 'block',
                        objectFit: 'cover',
                        animation: 'thumbIn 0.18s ease-out',
                      }}
                    />
                  ) : (
                    <div style={{ width: 60, height: 60, background: 'rgba(14,14,14,0.06)' }} />
                  )}
                </div>
                <span style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: isActive ? '#8B1A1A' : '#2A2A2A',
                  fontWeight: isActive ? 500 : 400,
                }}>
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dedication + mission */}
      <div style={{ padding: '12px 20px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <p style={S.labelSm}>DEDICA — FACOLTATIVA</p>
        <textarea
          value={dedication}
          onChange={e => setDedication(e.target.value)}
          placeholder="Scrivi qualcosa…"
          maxLength={280}
          style={{
            width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none',
            borderBottom: '0.5px solid rgba(14,14,14,0.25)', outline: 'none',
            fontFamily: "'Caveat', cursive", fontSize: 18, color: '#0E0E0E',
            resize: 'none', padding: '4px 0 8px', caretColor: '#8B1A1A',
            height: '80px',
          }}
        />

        {missions.length > 0 && (
          <div style={{ marginTop: 12 }}>
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

        {originalDimensions && (
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: '#2A2A2A', marginTop: 12, opacity: 0.35, letterSpacing: '0.1em' }}>
            {originalDimensions.width} × {originalDimensions.height}px
          </p>
        )}
      </div>

      {/* PUBBLICA — sticky bottom bar */}
      <div style={{
        padding: '12px 20px',
        paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom) + 12px))',
        borderTop: '0.5px solid rgba(14,14,14,0.1)',
        background: '#F8F5F0',
        flexShrink: 0,
      }}>
        <button onClick={handlePublish} style={S.ctaBtn}>
          PUBBLICA &nbsp;&rarr;
        </button>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: '#2A2A2A', textAlign: 'center', margin: '6px 0 0', fontStyle: 'italic' }}>
          Pubblicato con filtro &middot; {selectedFilter.label}
        </p>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function HomeBtn({ navigate }) {
  return (
    <button
      onClick={() => navigate('/')}
      style={{
        background: 'transparent',
        border: 'none',
        fontFamily: 'Georgia, serif',
        fontSize: 10,
        letterSpacing: '0.18em',
        color: '#8B1A1A',
        textTransform: 'uppercase',
        cursor: 'pointer',
        padding: '10px 20px 4px',
        alignSelf: 'flex-start',
        flexShrink: 0,
      }}
    >
      &larr; HOME
    </button>
  );
}

function EditorialHeader({ right, compact = false }) {
  return (
    <header style={{ padding: compact ? '9px 20px 7px' : '14px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(14,14,14,0.1)', flexShrink: 0, background: '#F8F5F0' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#0E0E0E', textTransform: 'uppercase' }}>VOL. I &middot; ISSUE 01</span>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase' }}>{right}</div>
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
  page: { height: '100dvh', background: '#F8F5F0', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' },
  labelSm: { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A', marginBottom: 8 },
  ctaBtn: { display: 'block', width: '100%', padding: '13px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', border: 'none', borderRadius: 2, cursor: 'pointer' },
};
