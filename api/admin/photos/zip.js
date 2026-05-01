import archiver from 'archiver';
import { getSupabaseAdmin } from '../../_lib/supabase-admin.js';
import { requireAuth } from '../_lib/auth.js';

const MAX_PHOTOS = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (ids.length > MAX_PHOTOS) {
    return res.status(400).json({ error: `Max ${MAX_PHOTOS} photos per ZIP` });
  }

  const supabase = getSupabaseAdmin();
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
  archive.on('error', (err) => {
    // Headers already sent; log only
    console.error('[admin/zip] archiver error:', err.message);
  });
  archive.pipe(res);

  for (const photo of photos) {
    // Prefer full-res archive; fall back to web version in photos bucket
    const useArchive = !!photo.archive_path;
    const bucket     = useArchive ? 'archive' : 'photos';
    const path       = useArchive ? photo.archive_path : photo.drive_file_id;

    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !blob) {
      console.warn(`[admin/zip] skip ${photo.id}: ${dlErr?.message}`);
      continue;
    }

    const ext = (path.split('.').pop() ?? 'jpg').toLowerCase();
    archive.append(Buffer.from(await blob.arrayBuffer()), { name: `${photo.id}.${ext}` });
  }

  await archive.finalize();
}
