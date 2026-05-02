import { getSupabaseAdmin } from '../../_lib/supabase-admin.js';
import { requireAuth } from '../_lib/auth.js';

// GET /api/admin/photos           → lista foto admin
// GET /api/admin/photos?action=stats → contatori e storage
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  if (req.query.action === 'stats') {
    const supabase = getSupabaseAdmin();

    const [live, deleted, archived, picks] = await Promise.all([
      supabase.from('photos').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('photos').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('photos').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null).is('deleted_at', null),
      supabase.from('photos').select('id', { count: 'exact', head: true }).eq('is_editors_pick', true).is('deleted_at', null),
    ]);

    const [photosBytes, archiveBytes] = await Promise.all([
      getBucketSize(supabase, 'photos'),
      getBucketSize(supabase, 'archive'),
    ]);

    return res.status(200).json({
      counts: {
        live:          live.count    ?? 0,
        deleted:       deleted.count ?? 0,
        archived:      archived.count ?? 0,
        editors_picks: picks.count   ?? 0,
      },
      storage: {
        photos_bytes:  photosBytes,
        archive_bytes: archiveBytes,
        total_bytes:   photosBytes + archiveBytes,
      },
    });
  }

  const page   = Math.max(1, parseInt(req.query.page  ?? '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
  const status = req.query.status ?? 'live'; // live | deleted | all
  const offset = (page - 1) * limit;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('photos')
    .select(
      'id, guest_uuid, drive_file_id, drive_url, thumbnail_url, archive_path, ' +
      'dedication, filter_used, like_count, is_editors_pick, ' +
      'created_at, deleted_at, archived_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === 'live')    query = query.is('deleted_at', null);
  if (status === 'deleted') query = query.not('deleted_at', 'is', null);
  // 'all' → no filter

  const { data, error, count } = await query;
  if (error) {
    console.error('[admin/photos] list error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  return res.status(200).json({
    photos: data,
    total:  count,
    page,
    limit,
    pages:  Math.ceil(count / limit),
  });
}

async function getBucketSize(supabase, bucket) {
  let total   = 0;
  let offset  = 0;
  const limit = 100;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list('', {
      limit,
      offset,
      sortBy: { column: 'created_at', order: 'asc' },
    });
    if (error || !data?.length) break;
    total += data.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0);
    if (data.length < limit) break;
    offset += limit;
  }
  return total;
}
