import { getSupabaseAdmin } from './_lib/supabase-admin.js';

// GET /api/missions              → lista missioni attive
// GET /api/missions?action=leaderboard → classifica (M4, da implementare)
export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    if (req.query.action === 'leaderboard') {
      return res.status(501).json({ error: 'Not implemented yet' });
    }

    const { data, error } = await supabase
      .from('missions')
      .select('id, title, description, bonus_points')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ missions: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
