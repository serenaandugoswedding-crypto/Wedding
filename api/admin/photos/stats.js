import { getSupabaseAdmin } from '../../_lib/supabase-admin.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

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

async function getBucketSize(supabase, bucket) {
  let total    = 0;
  let offset   = 0;
  const limit  = 100;

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
