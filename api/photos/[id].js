// v2 — POST like enabled
import { getSupabaseAdmin } from '../_lib/supabase-admin.js';

// GET  /api/photos/:id — singola foto pubblica
// POST /api/photos/:id — incrementa like_count
export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });

  const supabase = getSupabaseAdmin();

  if (req.method === 'POST') {
    const { data, error } = await supabase.rpc('increment_like', { photo_id: id });
    console.log('[like] rpc result:', JSON.stringify(data), 'error:', error?.message);
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ like_count: Array.isArray(data) ? data[0] : data });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabase
    .from('photos')
    .select(
      'id, guest_uuid, drive_url, thumbnail_url, dedication, filter_used, rotation_deg, created_at,' +
      ' mission_id, mission_score, missions!photos_mission_id_fkey(title),' +
      ' guests!photos_guest_uuid_fkey(display_name)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[photos/:id] error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!data) return res.status(404).json({ error: 'Photo not found' });

  const { drive_url, guests, missions, ...rest } = data;
  return res.status(200).json({
    ...rest,
    web_url:      drive_url,
    guest_name:   guests?.display_name ?? null,
    mission_name: missions?.title ?? null,
  });
}
