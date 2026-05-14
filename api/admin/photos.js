// GET                              → lista foto admin (paginata)
// GET ?action=stats                → contatori + storage
// POST ?action=delete|restore|mark-archived|zip → azioni bulk

import archiver from 'archiver';
import { getSupabaseAdmin } from '../_lib/supabase-admin.js';
import { requireAuth } from './_lib/auth.js';

const MAX_PHOTOS = 50;
const PAGE_SIZE_MAX = 100;

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const { action } = req.query;

  if (req.method === 'GET')  return action === 'stats' ? handleStats(req, res) : handleList(req, res);
  if (req.method === 'POST') return handleAction(req, res, action);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req, res) {
  const page   = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit  = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
  const status = req.query.status ?? 'live';
  const offset = (page - 1) * limit;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('photos')
    .select(
      'id, guest_uuid, drive_file_id, drive_url, thumbnail_url, archive_path,' +
      ' dedication, filter_used, like_count, is_editors_pick,' +
      ' mission_id, mission_score, missions!photos_mission_id_fkey(title),' +
      ' guests!photos_guest_uuid_fkey(display_name),' +
      ' created_at, deleted_at, archived_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === 'live')    query = query.is('deleted_at', null);
  if (status === 'deleted') query = query.not('deleted_at', 'is', null);

  const { data, error, count } = await query;
  if (error) {
    console.error('[admin/photos/list] error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  const photos = (data ?? []).map(({ missions, guests, ...rest }) => ({
    ...rest,
    guest_name:   guests?.display_name ?? null,
    mission_name: missions?.title ?? null,
  }));

  return res.status(200).json({ photos, total: count, page, limit, pages: Math.ceil(count / limit) });
}

async function handleStats(req, res) {
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
    counts:  { live: live.count ?? 0, deleted: deleted.count ?? 0, archived: archived.count ?? 0, editors_picks: picks.count ?? 0 },
    storage: { photos_bytes: photosBytes, archive_bytes: archiveBytes, total_bytes: photosBytes + archiveBytes },
  });
}

async function handleAction(req, res, action) {
  const { ids, unmark = false } = req.body ?? {};
  if (!action) return res.status(400).json({ error: 'action query param required' });
  if (action !== 'zip' && (!Array.isArray(ids) || ids.length === 0)) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const supabase = getSupabaseAdmin();

  if (action === 'delete') {
    const { data, error } = await supabase.from('photos')
      .update({ deleted_at: new Date().toISOString() }).in('id', ids).is('deleted_at', null).select('id');
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ deleted: data?.length ?? 0 });
  }

  if (action === 'restore') {
    const { data, error } = await supabase.from('photos')
      .update({ deleted_at: null }).in('id', ids).not('deleted_at', 'is', null).select('id');
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ restored: data?.length ?? 0 });
  }

  if (action === 'mark-archived') {
    const archived_at = unmark ? null : new Date().toISOString();
    const { data, error } = await supabase.from('photos')
      .update({ archived_at }).in('id', ids).is('deleted_at', null).select('id');
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ updated: data?.length ?? 0, archived: !unmark });
  }

  if (action === 'zip') {
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (ids.length > MAX_PHOTOS) return res.status(400).json({ error: `Max ${MAX_PHOTOS} photos per ZIP` });

    const { data: photos, error } = await supabase.from('photos')
      .select('id, drive_file_id, archive_path, created_at').in('id', ids).is('deleted_at', null);
    if (error) return res.status(500).json({ error: 'Database error' });
    if (!photos?.length) return res.status(404).json({ error: 'No photos found' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="wedding_photos_${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', err => console.error('[admin/zip] error:', err.message));
    archive.pipe(res);

    for (const photo of photos) {
      const useArchive = !!photo.archive_path;
      const bucket = useArchive ? 'archive' : 'photos';
      const path   = useArchive ? photo.archive_path : photo.drive_file_id;
      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
      if (dlErr || !blob) { console.warn(`[admin/zip] skip ${photo.id}: ${dlErr?.message}`); continue; }
      const ext = (path.split('.').pop() ?? 'jpg').toLowerCase();
      archive.append(Buffer.from(await blob.arrayBuffer()), { name: `${photo.id}.${ext}` });
    }

    await archive.finalize();
    return;
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function getBucketSize(supabase, bucket) {
  let total = 0, offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit, offset, sortBy: { column: 'created_at', order: 'asc' } });
    if (error || !data?.length) break;
    total += data.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0);
    if (data.length < limit) break;
    offset += limit;
  }
  return total;
}
