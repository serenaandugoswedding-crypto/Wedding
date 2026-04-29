import sharp from 'sharp';
import { uploadToDrive } from './_lib/drive-client.js';
import { getSupabaseAdmin } from './_lib/supabase-admin.js';

const VALID_FILTERS = [
  'originale', 'bn_drama', 'sepia_editorial',
  'bloom_cipria', 'vintage_polaroid', 'inchiostro', 'notte_party',
];

const MAX_B64_BYTES = 11 * 1024 * 1024; // ~8MB decoded + base64 overhead

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { photo_base64, guest_uuid, dedication, mission_id, filter_used } = req.body ?? {};

  // ── Validate inputs ──────────────────────────────────────────
  if (!photo_base64 || typeof photo_base64 !== 'string') {
    return res.status(400).json({ error: 'photo_base64 required' });
  }
  if (!guest_uuid || typeof guest_uuid !== 'string') {
    return res.status(400).json({ error: 'guest_uuid required' });
  }
  if (photo_base64.length > MAX_B64_BYTES) {
    return res.status(400).json({ error: 'Photo too large (max 8MB)' });
  }

  const filterUsed = VALID_FILTERS.includes(filter_used) ? filter_used : 'originale';

  // Strip data URL prefix if present
  const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  // Validate MIME type via magic bytes
  const mime = detectMime(imageBuffer);
  if (!mime) return res.status(400).json({ error: 'Invalid image format' });

  const supabase = getSupabaseAdmin();

  // ── Verify guest exists ─────────────────────────────────────
  const { data: guest, error: guestErr } = await supabase
    .from('guests')
    .select('uuid')
    .eq('uuid', guest_uuid)
    .maybeSingle();

  if (guestErr || !guest) {
    return res.status(400).json({ error: 'Unknown guest' });
  }

  // ── Generate thumbnail (600px) ───────────────────────────────
  let thumbnailBuffer;
  try {
    thumbnailBuffer = await sharp(imageBuffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Could not process image' });
  }

  // ── Upload full photo to Drive ───────────────────────────────
  const timestamp = Date.now();
  const photoFilename = `${timestamp}_${guest_uuid.slice(0, 8)}.jpg`;
  const thumbFilename = `thumb_${photoFilename}`;

  let drivePhoto, driveThumb;
  try {
    [drivePhoto, driveThumb] = await Promise.all([
      uploadToDrive({ buffer: imageBuffer,     filename: photoFilename, mimeType: 'image/jpeg' }),
      uploadToDrive({ buffer: thumbnailBuffer, filename: thumbFilename, mimeType: 'image/jpeg' }),
    ]);
  } catch (err) {
    console.error('Drive upload error:', err);
    return res.status(502).json({ error: 'Drive upload failed' });
  }

  // ── Random polaroid position ─────────────────────────────────
  const rotation  = (Math.random() * 16 - 8).toFixed(2);          // ±8°
  const positionX = (Math.random() * 80 + 10).toFixed(2);         // 10–90%
  const positionY = (Math.random() * 80 + 10).toFixed(2);

  // ── Insert photo metadata in Supabase ───────────────────────
  const { data: photo, error: photoErr } = await supabase
    .from('photos')
    .insert({
      guest_uuid,
      drive_file_id:  drivePhoto.drive_file_id,
      drive_url:      drivePhoto.drive_url,
      thumbnail_url:  driveThumb.drive_url,
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
    console.error('Supabase insert error:', photoErr);
    return res.status(500).json({ error: 'Database error' });
  }

  // ── Update guest counters ────────────────────────────────────
  await supabase.rpc('increment_guest_photos', { p_uuid: guest_uuid }).catch(() => {});

  return res.status(200).json({
    photo_id:  photo.id,
    drive_url: drivePhoto.drive_url,
    thumbnail_url: driveThumb.drive_url,
  });
}

function detectMime(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  // HEIC: ftyp box at offset 4
  if (buffer.slice(4, 8).toString('ascii') === 'ftyp')  return 'image/heic';
  return null;
}
