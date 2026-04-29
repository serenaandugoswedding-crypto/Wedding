import { getSupabaseAdmin } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
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
