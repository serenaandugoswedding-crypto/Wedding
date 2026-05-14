import sharp from 'sharp';
import { getSupabaseAdmin } from '../_lib/supabase-admin.js';

const VALID_FILTERS = [
  'originale', 'bn_drama', 'sepia_editorial',
  'bloom_cipria', 'vintage_polaroid', 'inchiostro', 'notte_party',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    guest_uuid,
    web_path,
    archive_path,
    thumbnail_base64,
    filter_used,
    dedication,
    mission_id,
  } = req.body ?? {};

  if (!guest_uuid || !web_path || !thumbnail_base64) {
    return res.status(400).json({ error: 'guest_uuid, web_path, thumbnail_base64 required' });
  }

  const supabase = getSupabaseAdmin();

  const { data: guest, error: guestErr } = await supabase
    .from('guests')
    .select('uuid')
    .eq('uuid', guest_uuid)
    .maybeSingle();

  if (guestErr || !guest) {
    return res.status(400).json({ error: 'Unknown guest' });
  }

  // Thumbnail: client sends 200px base64, sharp re-encodes for storage
  let thumbBuffer;
  try {
    const raw = Buffer.from(
      thumbnail_base64.replace(/^data:image\/\w+;base64,/, ''),
      'base64',
    );
    thumbBuffer = await sharp(raw).jpeg({ quality: 82 }).toBuffer();
  } catch (err) {
    console.error('[confirm] thumb processing error:', err.message);
    return res.status(400).json({ error: 'Invalid thumbnail' });
  }

  // Derive thumb filename from web_path pattern: {timestamp}_{uid8}_web.jpg
  const [timestamp, uid8] = web_path.split('_');
  const thumbFilename = `thumb_${timestamp}_${uid8}.jpg`;

  const { error: thumbUploadErr } = await supabase.storage
    .from('photos')
    .upload(thumbFilename, thumbBuffer, { contentType: 'image/jpeg', upsert: false });

  if (thumbUploadErr) {
    console.error('[confirm] thumb upload error:', thumbUploadErr.message);
    return res.status(502).json({ error: 'Thumbnail upload failed' });
  }

  const { data: { publicUrl: drive_url } }     = supabase.storage.from('photos').getPublicUrl(web_path);
  const { data: { publicUrl: thumbnail_url } } = supabase.storage.from('photos').getPublicUrl(thumbFilename);

  const rotation  = (Math.random() * 16 - 8).toFixed(2);
  const positionX = (Math.random() * 80 + 10).toFixed(2);
  const positionY = (Math.random() * 80 + 10).toFixed(2);
  const filterUsed = VALID_FILTERS.includes(filter_used) ? filter_used : 'originale';

  const { data: photo, error: photoErr } = await supabase
    .from('photos')
    .insert({
      guest_uuid,
      drive_file_id:  web_path,
      drive_url,
      thumbnail_url,
      archive_path:   archive_path || null,
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
    console.error('[confirm] Supabase insert error:', photoErr);
    return res.status(500).json({ error: 'Database error' });
  }

  await Promise.resolve(
    supabase.rpc('increment_guest_photos', { p_uuid: guest_uuid }),
  ).catch(() => {});

  return res.status(200).json({
    id:            photo.id,
    drive_url,
    thumbnail_url,
    archive_saved: !!archive_path,
  });
}
