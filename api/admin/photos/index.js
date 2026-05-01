import { getSupabaseAdmin } from '../../_lib/supabase-admin.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

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
