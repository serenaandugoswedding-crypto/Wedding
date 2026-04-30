import sharp from 'sharp';
import { uploadToDrive, uploadToArchive } from './_lib/drive-client.js';
import { getSupabaseAdmin } from './_lib/supabase-admin.js';

const VALID_FILTERS = [
  'originale', 'bn_drama', 'sepia_editorial',
  'bloom_cipria', 'vintage_polaroid', 'inchiostro', 'notte_party',
];

// Limite per campo base64: web max 4 MB stringa (~3 MB decoded), archive max 15 MB (~11 MB decoded)
const MAX_WEB_B64     = 4  * 1024 * 1024;
const MAX_ARCHIVE_B64 = 15 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    photo_web_base64,
    photo_archive_base64,
    photo_base64,      // legacy: item in coda offline prima di M3-bis
    guest_uuid,
    dedication,
    mission_id,
    filter_used,
  } = req.body ?? {};

  // Supporto backward compat: se arriva photo_base64 (formato pre-M3-bis),
  // usalo come versione web. L'archive non sarà disponibile per queste foto.
  const webB64     = photo_web_base64 || photo_base64 || null;
  const archiveB64 = photo_archive_base64 || null;
  const isLegacy   = !photo_web_base64 && !!photo_base64;

  console.log('[upload] body keys received:', {
    format:          isLegacy ? 'legacy' : 'dual-version',
    has_web:         !!webB64,
    web_len:         webB64?.length ?? null,
    has_archive:     !!archiveB64,
    archive_len:     archiveB64?.length ?? null,
    guest_uuid,
    filter_used,
    has_dedication:  !!dedication,
    has_mission_id:  !!mission_id,
  });

  // ── Validazione ──────────────────────────────────────────────
  if (!webB64 || typeof webB64 !== 'string') {
    console.error('[upload] 400: web photo missing');
    return res.status(400).json({ error: 'photo_web_base64 required' });
  }
  if (!guest_uuid || typeof guest_uuid !== 'string') {
    console.error('[upload] 400: guest_uuid missing');
    return res.status(400).json({ error: 'guest_uuid required' });
  }
  if (webB64.length > MAX_WEB_B64) {
    console.error('[upload] 400: web photo too large', webB64.length);
    return res.status(400).json({ error: 'Web photo too large (max ~3MB)' });
  }
  if (archiveB64 && archiveB64.length > MAX_ARCHIVE_B64) {
    console.error('[upload] 400: archive photo too large', archiveB64.length);
    return res.status(400).json({ error: 'Archive photo too large (max ~11MB)' });
  }

  const filterUsed = VALID_FILTERS.includes(filter_used) ? filter_used : 'originale';

  const webBuffer = Buffer.from(
    webB64.replace(/^data:image\/\w+;base64,/, ''),
    'base64',
  );

  const mime = detectMime(webBuffer);
  if (!mime) {
    console.error('[upload] 400: invalid image format, first bytes:', webBuffer.slice(0, 8).toString('hex'));
    return res.status(400).json({ error: 'Invalid image format' });
  }

  const supabase = getSupabaseAdmin();

  // ── Verifica ospite ──────────────────────────────────────────
  const { data: guest, error: guestErr } = await supabase
    .from('guests')
    .select('uuid')
    .eq('uuid', guest_uuid)
    .maybeSingle();

  if (guestErr || !guest) {
    console.error('[upload] 400: unknown guest', { guest_uuid, guestErr });
    return res.status(400).json({ error: 'Unknown guest', guest_uuid });
  }

  // ── Thumbnail 600px (da versione web) ────────────────────────
  let thumbnailBuffer;
  try {
    thumbnailBuffer = await sharp(webBuffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Could not process image' });
  }

  // ── Upload versione web + thumbnail su bucket photos ─────────
  const timestamp   = Date.now();
  const uid         = guest_uuid.slice(0, 8);
  const webFilename  = `${timestamp}_${uid}_web.jpg`;
  const thumbFilename = `thumb_${timestamp}_${uid}.jpg`;

  let drivePhoto, driveThumb;
  try {
    [drivePhoto, driveThumb] = await Promise.all([
      uploadToDrive({ buffer: webBuffer,       filename: webFilename,   mimeType: 'image/jpeg' }),
      uploadToDrive({ buffer: thumbnailBuffer, filename: thumbFilename, mimeType: 'image/jpeg' }),
    ]);
  } catch (err) {
    console.error('[upload] web storage upload error:', err.message);
    return res.status(502).json({ error: 'Storage upload failed', detail: err.message });
  }

  // ── Upload versione archive su bucket archive (non bloccante) ─
  // Se fallisce, logghiamo e continuiamo — l'esperienza ospite ha priorità.
  let archivePath = null;
  if (archiveB64) {
    try {
      const archiveBuffer  = Buffer.from(
        archiveB64.replace(/^data:image\/\w+;base64,/, ''),
        'base64',
      );
      const archiveFilename = `${timestamp}_${uid}_archive.jpg`;
      const result = await uploadToArchive({ buffer: archiveBuffer, filename: archiveFilename, mimeType: 'image/jpeg' });
      archivePath = result.archive_path;
    } catch (err) {
      console.error('[upload] archive upload failed (non-fatal):', err.message);
      // archivePath rimane null — la foto sarà visibile in app ma non scaricabile dall'admin
    }
  } else {
    console.log('[upload] no archive blob provided (legacy format or single-version upload)');
  }

  // ── Posizione polaroid casuale ───────────────────────────────
  const rotation  = (Math.random() * 16 - 8).toFixed(2);
  const positionX = (Math.random() * 80 + 10).toFixed(2);
  const positionY = (Math.random() * 80 + 10).toFixed(2);

  // ── INSERT in photos ─────────────────────────────────────────
  // Nota: le colonne si chiamano ancora drive_file_id / drive_url finché
  // migration 004 non viene eseguita. archive_path è già il nome finale.
  const { data: photo, error: photoErr } = await supabase
    .from('photos')
    .insert({
      guest_uuid,
      drive_file_id:  drivePhoto.drive_file_id,
      drive_url:      drivePhoto.drive_url,
      thumbnail_url:  driveThumb.drive_url,
      archive_path:   archivePath,
      dedication:     dedication?.slice(0, 280) || null,
      mission_id:     mission_id || null,
      filter_used:    filterUsed,
      rotation_deg:   parseFloat(rotation),
      position_x:     parseFloat(positionX),
      position_y:     parseFloat(positionY),
    })
    .select('id')
    .single();

  if (photoErr) {
    console.error('[upload] Supabase insert error:', photoErr);
    return res.status(500).json({ error: 'Database error' });
  }

  await Promise.resolve(supabase.rpc('increment_guest_photos', { p_uuid: guest_uuid })).catch(() => {});

  return res.status(200).json({
    photo_id:      photo.id,
    drive_url:     drivePhoto.drive_url,
    thumbnail_url: driveThumb.drive_url,
    archive_saved: archivePath !== null,
  });
}

function detectMime(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer.slice(4, 8).toString('ascii') === 'ftyp')  return 'image/heic';
  return null;
}
