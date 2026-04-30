import { getSupabaseAdmin } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uuid, display_name } = req.body ?? {};

  if (!uuid || typeof uuid !== 'string') {
    return res.status(400).json({ error: 'uuid required' });
  }
  if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
    return res.status(400).json({ error: 'display_name required' });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('guests')
    .upsert(
      { uuid, display_name: display_name.trim() },
      { onConflict: 'uuid', ignoreDuplicates: false }
    )
    .select('uuid, display_name, total_points, photos_count')
    .single();

  if (error) {
    console.error('[guests] upsert error:', error);
    return res.status(500).json({ error: 'Database error' });
  }

  return res.status(200).json({ guest: data });
}
