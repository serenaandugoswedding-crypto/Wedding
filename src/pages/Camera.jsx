import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FILTERS, applyFilterToCanvas, canvasToBase64, resizeCanvasToMaxDimension, renderThumbnail } from '../lib/filters';
import { useGuestIdentity } from '../hooks/useGuestIdentity';
import { useUploadQueue } from '../hooks/useUploadQueue';

const PHASE = { UPLOADING: 'uploading', DONE: 'done' };
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'];

export default function Camera() {
  const navigate = useNavigate();
  const { uuid } = useGuestIdentity();
  const { pendingCount, uploadOrQueue, retryPendingUploads } = useUploadQueue();

  const fileInputRef = useRef(null);

  const [phase,              setPhase]              = useState(null);
  const [uploadedImage,      setUploadedImage]      = useState(null);   // HTMLImageElement
  const [originalDimensions, setOriginalDimensions] = useState(null);
  const [isProcessing,       setIsProcessing]       = useState(false);
  const [isPublishingRender, setIsPublishingRender] = useState(false);
  const [selectedFilter,     setSelectedFilter]     = useState(FILTERS[0]);
  const [filteredSrc,        setFilteredSrc]        = useState('');
  const [isFilterChanging,   setIsFilterChanging]   = useState(false);
  const [filterThumbnails,   setFilterThumbnails]   = useState({});     // { [filterId]: dataURL }
  const [photoLoadKey,       setPhotoLoadKey]       = useState(0);      // incrementa su ogni nuovo upload → triggera fade-in
  const [dedication,         setDedication]         = useState('');
  const [missionId,          setMissionId]          = useState('');
  const [missions,           setMissions]           = useState([]);
  const [error,              setError]              = useState('');
  const [queuedPublish,      setQueuedPublish]      = useState(false);
  const [queueMessage,       setQueueMessage]       = useState('');
  const [isRetryingQueue,    setIsRetryingQueue]    = useState(false);

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
    if (phase === PHASE.UPLOADING || isProcessing || isPublishingRender || isFilterChanging) return;

    if (file.size > MAX_FILE_BYTES) {
      setError('La foto supera 10MB. Scegli un file più leggero.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const hasSupportedType = file.type ? file.type.startsWith('image/') : false;
    const hasSupportedExtension = extension ? SUPPORTED_IMAGE_EXTENSIONS.includes(extension) : false;
    if (!hasSupportedType && !hasSupportedExtension) {
      setError('Formato non supportato. Usa una foto JPG, PNG, HEIC o WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setError('');
    setQueuedPublish(false);
    setQueueMessage('');

    // Revoca URL del file precedente per liberare memoria (importante su iPhone con foto grandi)
    if (uploadedImage?.src) URL.revokeObjectURL(uploadedImage.src);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });
    } catch {
      URL.revokeObjectURL(objectUrl);
      setError('Non riesco a leggere questa immagine. Prova con un altro file.');
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadedImage(img);
    setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setSelectedFilter(FILTERS[0]);
    setFilteredSrc('');
    setFilterThumbnails({});
    setPhotoLoadKey(k => k + 1);
    setIsProcessing(false);
  }

  function selectFilter(filter) {
    if (phase === PHASE.UPLOADING || isPublishingRender || isFilterChanging) return;
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
    if (phase === PHASE.UPLOADING || isPublishingRender || isFilterChanging) return;
    if (!uuid) { setError('Torna alla cover e inserisci il tuo nome.'); return; }
    if (!uploadedImage) return;
    setPhase(PHASE.UPLOADING);
    setIsPublishingRender(true);
    setError('');
    setQueuedPublish(false);
    setQueueMessage('');

    let photo_archive_base64;
    let photo_web_base64;
    try {
      // IMPORTANTE: nessun maxDim — il filtro lavora sull'originale full-res.
      // Non aggiungere maxDim qui: causerebbe il bug 486KB dove archive veniva ridotto.
      const filteredCanvas = applyFilterToCanvas(uploadedImage, selectedFilter);
      photo_archive_base64 = canvasToBase64(filteredCanvas, 0.92);

      // Versione web ridotta a 1600px per la gallery
      const webCanvas        = resizeCanvasToMaxDimension(filteredCanvas, 1600);
      photo_web_base64 = canvasToBase64(webCanvas, 0.82);
    } catch (err) {
      console.error('[Camera] render error:', err);
      setIsPublishingRender(false);
      setError('Non sono riuscito a preparare la foto. Riprova senza cambiare immagine.');
      setPhase(null);
      return;
    }

    let result;
    try {
      result = await uploadOrQueue({
        photo_web_base64,
        photo_archive_base64,
        guest_uuid:  uuid,
        filter_used: selectedFilter.id,
        dedication:  dedication.trim() || null,
        mission_id:  missionId || null,
      });
    } catch (err) {
      console.error('[Camera] upload error:', err);
      setIsPublishingRender(false);
      setError('Upload non riuscito. Controlla la connessione e riprova.');
      setPhase(null);
      return;
    }
    setIsPublishingRender(false);
    if (result.ok || result.queued) {
      setQueuedPublish(Boolean(result.queued));
      setQueueMessage(result.queued ? 'Foto salvata. Verrà pubblicata quando torna connessione.' : '');
      setPhase(PHASE.DONE);
    } else {
      setError(result.error ? `Upload non riuscito: ${result.error}` : 'Upload non riuscito. Controlla la connessione e riprova.');
      setPhase(null);
    }
  }

  async function handleRetryPendingUploads() {
    if (isRetryingQueue) return;
    setIsRetryingQueue(true);
    setQueueMessage('');
    try {
      const result = await retryPendingUploads();
      if (result.offline) {
        setQueueMessage('Sei offline. Le foto restano salvate e verranno pubblicate quando torna connessione.');
      } else if (result.remaining > 0) {
        setQueueMessage(`${result.uploaded} foto pubblicate. ${result.remaining} ancora in attesa.`);
      } else {
        setQueueMessage(result.uploaded > 0 ? 'Foto in coda pubblicate.' : 'Nessuna foto in attesa.');
      }
    } catch {
      setQueueMessage('Riprova non riuscito. Le foto restano salvate in coda.');
    } finally {
      setIsRetryingQueue(false);
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
    setQueuedPublish(false);
    setQueueMessage('');
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
            {queuedPublish ? 'Salvato.' : 'Pubblicato.'}
          </p>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', marginBottom: 32, letterSpacing: '0.04em' }}>
            {queuedPublish ? 'Foto salvata. Verrà pubblicata quando torna connessione.' : 'La tua foto è nel wall.'}
          </p>
          {pendingCount > 0 && (
            <div style={{ width: '100%', marginBottom: 24 }}>
              <PendingBadge count={pendingCount} onRetry={handleRetryPendingUploads} isRetrying={isRetryingQueue} message={queueMessage} />
            </div>
          )}
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
      {pendingCount > 0 && <PendingBadge count={pendingCount} onRetry={handleRetryPendingUploads} isRetrying={isRetryingQueue} message={queueMessage} />}

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
          {missions.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p style={S.labelSm}>MISSIONI DEL GIORNO</p>
              <div style={{ height: '0.5px', background: 'rgba(14,14,14,0.12)', marginBottom: 12 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {missions.map(m => {
                  const sel = missionId === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMissionId(sel ? '' : m.id)}
                      style={{
                        position: 'relative',
                        background: sel ? 'rgba(139,26,26,0.04)' : 'transparent',
                        border: sel ? '2px solid #8B1A1A' : '1px solid rgba(14,14,14,0.1)',
                        borderRadius: 2,
                        padding: '10px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <span style={{ position: 'absolute', top: 10, right: 12, fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A' }}>
                        +{m.bonus_points} pt
                      </span>
                      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', color: '#0E0E0E', marginBottom: 2, paddingRight: 52 }}>
                        {m.title}
                      </p>
                      {m.description && (
                        <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                          {m.description}
                        </p>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => setMissionId('')}
                  style={{
                    background: missionId === '' ? 'rgba(139,26,26,0.04)' : 'transparent',
                    border: missionId === '' ? '2px solid #8B1A1A' : '1px solid rgba(14,14,14,0.1)',
                    borderRadius: 2,
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'Georgia, serif',
                    fontSize: 12,
                    color: '#666',
                  }}
                >
                  Nessuna missione
                </button>
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: 8 }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#2A2A2A', letterSpacing: '0.04em', marginBottom: 28, lineHeight: 1.8 }}>
              Aggiungi una foto<br />al numero del giorno.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isPublishingRender || isFilterChanging}
              style={{ ...S.ctaBtn, opacity: isProcessing || isPublishingRender || isFilterChanging ? 0.6 : 1 }}
            >
              {isProcessing ? 'CARICANDO…' : 'SCEGLI O SCATTA →'}
            </button>
            {error && <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A', marginTop: 12 }}>{error}</p>}
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 10, color: '#2A2A2A', letterSpacing: '0.12em', marginTop: 20, opacity: 0.45 }}>
              formato jpg · png · heic &nbsp;·&nbsp; max 10MB
            </p>
          </div>
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
        {pendingCount > 0 && <PendingBadge count={pendingCount} onRetry={handleRetryPendingUploads} isRetrying={isRetryingQueue} message={queueMessage} />}

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
              maxHeight: '45vh',
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
      <div style={{ borderBottom: '0.5px solid rgba(14,14,14,0.1)', flexShrink: 0, height: 80, boxSizing: 'border-box' }}>
        <div style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 16px',
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
                disabled={phase === PHASE.UPLOADING || isPublishingRender || isFilterChanging}
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
            height: '60px',
          }}
        />

        {missionId && missions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={S.labelSm}>MISSIONE SELEZIONATA</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A' }}>
                {missions.find(m => m.id === missionId)?.title ?? ''}
              </span>
              <button
                onClick={() => setMissionId('')}
                style={{ background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.14em', color: '#666', cursor: 'pointer', padding: 0, textTransform: 'uppercase' }}
              >
                RIMUOVI
              </button>
            </div>
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
        <button
          onClick={handlePublish}
          disabled={phase === PHASE.UPLOADING || isPublishingRender || isFilterChanging}
          style={{ ...S.ctaBtn, opacity: phase === PHASE.UPLOADING || isPublishingRender || isFilterChanging ? 0.55 : 1 }}
        >
          {isPublishingRender ? 'PREPARO LA FOTO...' : 'PUBBLICA  →'}
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

function PendingBadge({ count, dark = false, onRetry, isRetrying = false, message = '' }) {
  return (
    <div style={{ padding: '8px 20px', background: dark ? 'rgba(248,245,240,0.08)' : 'rgba(14,14,14,0.04)', borderBottom: dark ? 'none' : '0.5px solid rgba(14,14,14,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.14em', color: dark ? '#F8F5F0' : '#2A2A2A', textTransform: 'uppercase' }}>
          {count === 1 ? '1 foto in coda' : `${count} foto in coda`}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            style={{
              background: 'transparent',
              border: '0.5px solid rgba(139,26,26,0.45)',
              borderRadius: 2,
              color: dark ? '#F8F5F0' : '#8B1A1A',
              cursor: isRetrying ? 'default' : 'pointer',
              fontFamily: 'Georgia, serif',
              fontSize: 9,
              letterSpacing: '0.16em',
              opacity: isRetrying ? 0.55 : 1,
              padding: '5px 8px',
              textTransform: 'uppercase',
            }}
          >
            {isRetrying ? 'RIPROVO...' : 'RIPROVA ORA'}
          </button>
        )}
      </div>
      {message && (
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: dark ? '#F8F5F0' : '#2A2A2A', margin: '6px 0 0', lineHeight: 1.4 }}>
          {message}
        </p>
      )}
    </div>
  );
}

const S = {
  page: { height: '100dvh', background: '#F8F5F0', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' },
  labelSm: { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A', marginBottom: 8 },
  ctaBtn: { display: 'block', width: '100%', padding: '13px', background: '#0E0E0E', color: '#F8F5F0', fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', border: 'none', borderRadius: 2, cursor: 'pointer' },
};
