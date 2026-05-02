import archiver from 'archiver';
import { getSupabaseAdmin } from '../../_lib/supabase-admin.js';
import { requireAuth } from '../_lib/auth.js';

const MAX_PHOTOS = 50;

// POST /api/admin/photos/actions?action=delete
// POST /api/admin/photos/actions?action=restore
// POST /api/admin/photos/actions?action=mark-archived
// POST /api/admin/photos/actions?action=zip
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { action } = req.query;
  const { ids, unmark = false } = req.body ?? {};

  if (!action) return res.status(400).json({ error: 'action query param required' });
  if (action !== 'zip' && (!Array.isArray(ids) || ids.length === 0)) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const supabase = getSupabaseAdmin();

  if (action === 'delete') {
    const { data, error } = await supabase
      .from('photos')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .is('deleted_at', null)
      .select('id');
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ deleted: data?.length ?? 0 });
  }

  if (action === 'restore') {
    const { data, error } = await supabase
      .from('photos')
      .update({ deleted_at: null })
      .in('id', ids)
      .not('deleted_at', 'is', null)
      .select('id');
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ restored: data?.length ?? 0 });
  }

  if (action === 'mark-archived') {
    const archived_at = unmark ? null : new Date().toISOString();
    const { data, error } = await supabase
      .from('photos')
      .update({ archived_at })
      .in('id', ids)
      .is('deleted_at', null)
      .select('id');
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ updated: data?.length ?? 0, archived: !unmark });
  }

  if (action === 'zip') {
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (ids.length > MAX_PHOTOS) return res.status(400).json({ error: `Max ${MAX_PHOTOS} photos per ZIP` });

    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, drive_file_id, archive_path, created_at')
      .in('id', ids)
      .is('deleted_at', null);

    if (error) return res.status(500).json({ error: 'Database error' });
    if (!photos?.length) return res.status(404).json({ error: 'No photos found' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="wedding_photos_${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => console.error('[admin/zip] archiver error:', err.message));
    archive.pipe(res);

    for (const photo of photos) {
      const useArchive = !!photo.archive_path;
      const bucket = useArchive ? 'archive' : 'photos';
      const path = useArchive ? photo.archive_path : photo.drive_file_id;
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
