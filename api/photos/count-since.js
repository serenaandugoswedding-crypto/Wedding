import { getSupabaseAdmin } from '../_lib/supabase-admin.js';

// GET /api/photos/count-since?ts=<ISO8601>
// Conta le foto pubblicate dopo il timestamp dato (per il badge "X nuove foto").
// Usa SELECT COUNT(*) via head:true — nessuna riga trasferita, solo il contatore.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ts } = req.query;
  if (!ts) return res.status(400).json({ error: "'ts' (ISO 8601 timestamp) is required" });

  // Validazione minima: deve essere parseable come Date
  const since = new Date(ts);
  if (isNaN(since.getTime())) {
    return res.status(400).json({ error: "'ts' must be a valid ISO 8601 timestamp" });
  }

  const supabase = getSupabaseAdmin();

  // head: true → query COUNT-only, nessuna riga trasferita
  const { count, error } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', since.toISOString())
    .is('deleted_at', null);

  if (error) {
    console.error('[photos/count-since] error:', error.message);
    return res.status(500).json({ error: 'Database error' });
  }

  res.setHeader('Cache-Control', 'public, max-age=10');
  return res.status(200).json({ count: count ?? 0 });
}
