// GET                            → lista foto pubbliche paginata
// GET ?action=count-since&ts=    → count nuove foto per polling badge
// GET ?id={uuid}                 → singola foto
// POST ?id={uuid}                → incrementa like_count

import { getSupabaseAdmin } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  const { id, action } = req.query;

  if (req.method === 'POST' && id) return handleLike(req, res, id);
  if (req.method !== 'GET')        return res.status(405).json({ error: 'Method not allowed' });
  if (id)                          return handleSingle(req, res, id);
  if (action === 'count-since')    return handleCountSince(req, res);
  return handleList(req, res);
}

async function handleSingle(req, res, id) {
  if (typeof id !== 'string') return res.status(400).json({ error: 'id required' });
  const supabase = getSupabaseAdmin();
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
    console.error('[photos/single] error:', error.message);
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

async function handleLike(req, res, id) {
  if (typeof id !== 'string') return res.status(400).json({ error: 'id required' });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('increment_like', { photo_id: id });
  console.log('[photos/like] rpc result:', JSON.stringify(data), 'error:', error?.message);
  if (error) return res.status(500).json({ error: 'Database error' });
  return res.status(200).json({ like_count: Array.isArray(data) ? data[0] : data });
}

async function handleCountSince(req, res) {
  const { ts } = req.query;
  if (!ts) return res.status(400).json({ error: "'ts' (ISO 8601) required" });
  const since = new Date(ts);
  if (isNaN(since.getTime())) return res.status(400).json({ error: "'ts' must be valid ISO 8601" });

  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', since.toISOString())
    .is('deleted_at', null);

  if (error) return res.status(500).json({ error: 'Database error' });
  res.setHeader('Cache-Control', 'public, max-age=10');
  return res.status(200).json({ count: count ?? 0 });
}

async function handleList(req, res) {
  const page   = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
  const offset = (page - 1) * limit;

  const supabase = getSupabaseAdmin();
  const { data, error, count } = await supabase
    .from('photos')
    .select(
      'id, guest_uuid, drive_url, thumbnail_url, dedication, filter_used, rotation_deg, like_count, created_at,' +
      ' mission_id, missions!photos_mission_id_fkey(title),' +
      ' guests!photos_guest_uuid_fkey(display_name)',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[photos/list] error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  const photos = (data ?? []).map(({ drive_url, guests, missions, ...rest }) => ({
    ...rest,
    web_url:      drive_url,
    guest_name:   guests?.display_name ?? null,
    mission_name: missions?.title ?? null,
  }));

  const total = count ?? 0;
  res.setHeader('Cache-Control', 'public, max-age=0');
  return res.status(200).json({ photos, total, page, limit, pages: Math.ceil(total / limit) });
}
