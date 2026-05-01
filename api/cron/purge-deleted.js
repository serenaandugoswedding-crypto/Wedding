import { getSupabaseAdmin } from '../_lib/supabase-admin.js';

const GRACE_MS = 24 * 60 * 60 * 1000; // PRD §7.3: hard-delete after 24h soft-delete

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase  = getSupabaseAdmin();
  const threshold = new Date(Date.now() - GRACE_MS).toISOString();

  const { data: photos, error: fetchErr } = await supabase
    .from('photos')
    .select('id, drive_file_id, archive_path')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', threshold);

  if (fetchErr) {
    console.error('[cron/purge] fetch error:', fetchErr.message);
    return res.status(500).json({ error: 'Database error' });
  }
  if (!photos?.length) {
    return res.status(200).json({ purged: 0 });
  }

  const webPaths = photos.map(p => p.drive_file_id).filter(Boolean);

  // Derive thumbnail path from web filename:
  // "1716500000000_a1b2c3d4_web.jpg" → "thumb_1716500000000_a1b2c3d4.jpg"
  const thumbPaths = photos
    .map(p => {
      if (!p.drive_file_id) return null;
      if (!/_web\.jpg$/.test(p.drive_file_id)) {
        // Naming convention mismatch — thumb cannot be derived; file may be orphaned in bucket
        console.warn(`[cron/purge] cannot derive thumb for drive_file_id="${p.drive_file_id}" (photo ${p.id}) — will not be deleted from storage`);
        return null;
      }
      const base = p.drive_file_id.replace(/_web\.jpg$/, '');
      return `thumb_${base}.jpg`;
    })
    .filter(Boolean);

  const archivePaths = photos.map(p => p.archive_path).filter(Boolean);

  const storageErrors = [];

  if (webPaths.length || thumbPaths.length) {
    const { error } = await supabase.storage.from('photos').remove([...webPaths, ...thumbPaths]);
    if (error) {
      console.error('[cron/purge] photos bucket remove error:', error.message);
      storageErrors.push(`photos: ${error.message}`);
    }
  }

  if (archivePaths.length) {
    const { error } = await supabase.storage.from('archive').remove(archivePaths);
    if (error) {
      console.error('[cron/purge] archive bucket remove error:', error.message);
      storageErrors.push(`archive: ${error.message}`);
    }
  }

  const ids = photos.map(p => p.id);
  const { error: delErr } = await supabase.from('photos').delete().in('id', ids);
  if (delErr) {
    console.error('[cron/purge] DB delete error:', delErr.message);
    return res.status(500).json({ error: 'DB delete failed', storage_errors: storageErrors });
  }

  console.log(`[cron/purge] purged ${ids.length} photos`);
  return res.status(200).json({ purged: ids.length, storage_errors: storageErrors });
}
