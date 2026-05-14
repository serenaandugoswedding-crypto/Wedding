// POST (no action)          → legacy flow, offline IndexedDB queue compat
// POST ?action=signed-url  → generate Supabase Storage signed upload URL
// POST ?action=confirm      → confirm direct upload, insert DB row

import sharp from 'sharp';
import { uploadToDrive, uploadToArchive } from './_lib/drive-client.js';
import { getSupabaseAdmin } from './_lib/supabase-admin.js';

const VALID_FILTERS = [
  'originale', 'bn_drama', 'sepia_editorial',
  'bloom_cipria', 'vintage_polaroid', 'inchiostro', 'notte_party',
];
const MAX_WEB_B64     = 4  * 1024 * 1024;
const MAX_ARCHIVE_B64 = 15 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action } = req.query;
  if (action === 'signed-url') return handleSignedUrl(req, res);
  if (action === 'confirm')    return handleConfirm(req, res);
  return handleLegacy(req, res);
}

// ── signed-url ────────────────────────────────────────────────────
async function handleSignedUrl(req, res) {
  const { guest_uuid, fileType } = req.body ?? {};
  if (!guest_uuid || !fileType || !['web', 'archive'].includes(fileType)) {
    return res.status(400).json({ error: 'guest_uuid and fileType (web|archive) required' });
  }

  const supabase = getSupabaseAdmin();
  const { data: guest, error: guestErr } = await supabase
    .from('guests').select('uuid').eq('uuid', guest_uuid).maybeSingle();
  if (guestErr || !guest) return res.status(400).json({ error: 'Unknown guest' });

  const timestamp = Date.now();
  const uid8      = guest_uuid.slice(0, 8);
  const bucket    = fileType === 'archive' ? 'archive' : 'photos';
  const path      = `${timestamp}_${uid8}_${fileType}.jpg`;

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) {
    console.error('[upload/signed-url] error:', error.message);
    return res.status(500).json({ error: 'Could not generate signed URL' });
  }

  return res.status(200).json({
    signedUrl: data.signedUrl,
    path:      data.path || path,
    token:     data.token,
    bucket,
  });
}

// ── confirm ───────────────────────────────────────────────────────
async function handleConfirm(req, res) {
  const { guest_uuid, web_path, archive_path, thumbnail_base64, filter_used, dedication, mission_id } = req.body ?? {};
  if (!guest_uuid || !web_path || !thumbnail_base64) {
    return res.status(400).json({ error: 'guest_uuid, web_path, thumbnail_base64 required' });
  }

  const supabase = getSupabaseAdmin();
  const { data: guest, error: guestErr } = await supabase
    .from('guests').select('uuid').eq('uuid', guest_uuid).maybeSingle();
  if (guestErr || !guest) return res.status(400).json({ error: 'Unknown guest' });

  let thumbBuffer;
  try {
    const raw = Buffer.from(thumbnail_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    thumbBuffer = await sharp(raw).jpeg({ quality: 82 }).toBuffer();
  } catch (err) {
    console.error('[upload/confirm] thumb error:', err.message);
    return res.status(400).json({ error: 'Invalid thumbnail' });
  }

  const [timestamp, uid8] = web_path.split('_');
  const thumbFilename = `thumb_${timestamp}_${uid8}.jpg`;

  const { error: thumbErr } = await supabase.storage
    .from('photos')
    .upload(thumbFilename, thumbBuffer, { contentType: 'image/jpeg', upsert: false });
  if (thumbErr) {
    console.error('[upload/confirm] thumb upload error:', thumbErr.message);
    return res.status(502).json({ error: 'Thumbnail upload failed' });
  }

  const { data: { publicUrl: drive_url } }     = supabase.storage.from('photos').getPublicUrl(web_path);
  const { data: { publicUrl: thumbnail_url } } = supabase.storage.from('photos').getPublicUrl(thumbFilename);
  const filterUsed = VALID_FILTERS.includes(filter_used) ? filter_used : 'originale';

  const { data: photo, error: photoErr } = await supabase.from('photos').insert({
    guest_uuid,
    drive_file_id:  web_path,
    drive_url,
    thumbnail_url,
    archive_path:   archive_path || null,
    dedication:     dedication?.slice(0, 280) || null,
    mission_id:     mission_id || null,
    filter_used:    filterUsed,
    rotation_deg:   parseFloat((Math.random() * 16 - 8).toFixed(2)),
    position_x:     parseFloat((Math.random() * 80 + 10).toFixed(2)),
    position_y:     parseFloat((Math.random() * 80 + 10).toFixed(2)),
  }).select('id').single();

  if (photoErr) {
    console.error('[upload/confirm] insert error:', photoErr);
    return res.status(500).json({ error: 'Database error' });
  }

  await Promise.resolve(supabase.rpc('increment_guest_photos', { p_uuid: guest_uuid })).catch(() => {});
  return res.status(200).json({ id: photo.id, drive_url, thumbnail_url, archive_saved: !!archive_path });
}

// ── legacy (offline queue compat, deprecated for new uploads) ─────
async function handleLegacy(req, res) {
  const { photo_web_base64, photo_archive_base64, photo_base64, guest_uuid, dedication, mission_id, filter_used } = req.body ?? {};

  const webB64     = photo_web_base64 || photo_base64 || null;
  const archiveB64 = photo_archive_base64 || null;
  const isLegacy   = !photo_web_base64 && !!photo_base64;

  console.log('[upload/legacy]', { format: isLegacy ? 'legacy' : 'dual', web_len: webB64?.length ?? null, archive_len: archiveB64?.length ?? null, guest_uuid });

  if (!webB64 || typeof webB64 !== 'string') return res.status(400).json({ error: 'photo_web_base64 required' });
  if (!guest_uuid || typeof guest_uuid !== 'string') return res.status(400).json({ error: 'guest_uuid required' });
  if (webB64.length > MAX_WEB_B64) return res.status(400).json({ error: 'Web photo too large (max ~3MB)' });
  if (archiveB64 && archiveB64.length > MAX_ARCHIVE_B64) return res.status(400).json({ error: 'Archive photo too large (max ~11MB)' });

  const filterUsed  = VALID_FILTERS.includes(filter_used) ? filter_used : 'originale';
  const webBuffer   = Buffer.from(webB64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const mime        = detectMime(webBuffer);
  if (!mime) return res.status(400).json({ error: 'Invalid image format' });

  const supabase = getSupabaseAdmin();
  const { data: guest, error: guestErr } = await supabase
    .from('guests').select('uuid').eq('uuid', guest_uuid).maybeSingle();
  if (guestErr || !guest) return res.status(400).json({ error: 'Unknown guest' });

  let thumbnailBuffer;
  try {
    thumbnailBuffer = await sharp(webBuffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Could not process image' });
  }

  const timestamp    = Date.now();
  const uid          = guest_uuid.slice(0, 8);
  const webFilename  = `${timestamp}_${uid}_web.jpg`;
  const thumbFilename = `thumb_${timestamp}_${uid}.jpg`;

  let drivePhoto, driveThumb;
  try {
    [drivePhoto, driveThumb] = await Promise.all([
      uploadToDrive({ buffer: webBuffer,       filename: webFilename,   mimeType: 'image/jpeg' }),
      uploadToDrive({ buffer: thumbnailBuffer, filename: thumbFilename, mimeType: 'image/jpeg' }),
    ]);
  } catch (err) {
    console.error('[upload/legacy] storage error:', err.message);
    return res.status(502).json({ error: 'Storage upload failed' });
  }

  let archivePath = null;
  if (archiveB64) {
    try {
      const archiveBuffer  = Buffer.from(archiveB64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const archiveFilename = `${timestamp}_${uid}_archive.jpg`;
      const result = await uploadToArchive({ buffer: archiveBuffer, filename: archiveFilename, mimeType: 'image/jpeg' });
      archivePath = result.archive_path;
    } catch (err) {
      console.error('[upload/legacy] archive failed (non-fatal):', err.message);
    }
  }

  const { data: photo, error: photoErr } = await supabase.from('photos').insert({
    guest_uuid,
    drive_file_id:  drivePhoto.drive_file_id,
    drive_url:      drivePhoto.drive_url,
    thumbnail_url:  driveThumb.drive_url,
    archive_path:   archivePath,
    dedication:     dedication?.slice(0, 280) || null,
    mission_id:     mission_id || null,
    filter_used:    filterUsed,
    rotation_deg:   parseFloat((Math.random() * 16 - 8).toFixed(2)),
    position_x:     parseFloat((Math.random() * 80 + 10).toFixed(2)),
    position_y:     parseFloat((Math.random() * 80 + 10).toFixed(2)),
  }).select('id').single();

  if (photoErr) {
    console.error('[upload/legacy] insert error:', photoErr);
    return res.status(500).json({ error: 'Database error' });
  }

  await Promise.resolve(supabase.rpc('increment_guest_photos', { p_uuid: guest_uuid })).catch(() => {});
  return res.status(200).json({ photo_id: photo.id, drive_url: drivePhoto.drive_url, thumbnail_url: driveThumb.drive_url, archive_saved: archivePath !== null });
}

function detectMime(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer.slice(4, 8).toString('ascii') === 'ftyp')  return 'image/heic';
  return null;
}
