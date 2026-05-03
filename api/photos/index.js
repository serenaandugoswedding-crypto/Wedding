import { getSupabaseAdmin } from '../_lib/supabase-admin.js';

// GET /api/photos              → lista foto pubbliche
// GET /api/photos?action=count-since&ts=<ISO> → contatore nuove foto
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'count-since') {
    const { ts } = req.query;
    if (!ts) return res.status(400).json({ error: "'ts' (ISO 8601 timestamp) is required" });
    const since = new Date(ts);
    if (isNaN(since.getTime())) return res.status(400).json({ error: "'ts' must be a valid ISO 8601 timestamp" });

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

  const page   = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
  const offset = (page - 1) * limit;

  const supabase = getSupabaseAdmin();

  // Nota: drive_url = web_url dopo migration 004 (non ancora applicata).
  // Rinominato in output a web_url per uniformità con il frontend.
  // rotation_deg già presente: generato casualmente all'upload, deterministica per foto.
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
    console.error('[photos] list error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  // Normalizza: drive_url → web_url, appiattisce guest_name e mission_name
  const photos = (data ?? []).map(({ drive_url, guests, missions, ...rest }) => ({
    ...rest,
    web_url:      drive_url,
    guest_name:   guests?.display_name ?? null,
    mission_name: missions?.title ?? null,
  }));

  const total = count ?? 0;

  res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
  return res.status(200).json({
    photos,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
