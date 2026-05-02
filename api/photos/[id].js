import { getSupabaseAdmin } from '../_lib/supabase-admin.js';

// GET /api/photos/:id — singola foto pubblica
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('photos')
    .select(
      'id, guest_uuid, drive_url, thumbnail_url, dedication, filter_used, rotation_deg, created_at,' +
      ' guests(display_name)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[photos/:id] error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!data) return res.status(404).json({ error: 'Photo not found' });

  const { drive_url, guests, ...rest } = data;
  return res.status(200).json({
    ...rest,
    web_url:    drive_url,
    guest_name: guests?.display_name ?? null,
  });
}
