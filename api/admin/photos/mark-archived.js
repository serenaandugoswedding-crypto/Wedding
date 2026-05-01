import { getSupabaseAdmin } from '../../_lib/supabase-admin.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { ids, unmark = false } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const supabase    = getSupabaseAdmin();
  const archived_at = unmark ? null : new Date().toISOString();

  const { data, error } = await supabase
    .from('photos')
    .update({ archived_at })
    .in('id', ids)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    console.error('[admin/photos/mark-archived] error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  return res.status(200).json({ updated: data?.length ?? 0, archived: !unmark });
}
