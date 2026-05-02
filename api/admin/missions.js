import { getSupabaseAdmin } from '../_lib/supabase-admin.js';
import { requireAuth } from './_lib/auth.js';

// GET  /api/admin/missions                    → lista tutte le missioni
// POST /api/admin/missions?action=create      → crea missione
// POST /api/admin/missions?action=update      → aggiorna missione
// POST /api/admin/missions?action=toggle      → attiva/disattiva
// POST /api/admin/missions?action=delete      → elimina
// POST /api/admin/missions?action=validate    → assegna mission_score a foto
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const supabase = getSupabaseAdmin();
  const { action } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('missions')
      .select('id, title, description, bonus_points, active, created_at')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ missions: data });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!action) return res.status(400).json({ error: 'action required' });

  if (action === 'create') {
    const { title, description, bonus_points } = req.body ?? {};
    if (!title || !bonus_points) return res.status(400).json({ error: 'title e bonus_points richiesti' });
    const { data, error } = await supabase
      .from('missions')
      .insert({ title, description, bonus_points: parseInt(bonus_points), active: true })
      .select().single();
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(201).json({ mission: data });
  }

  if (action === 'update') {
    const { id, title, description, bonus_points } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id richiesto' });
    const { data, error } = await supabase
      .from('missions')
      .update({ title, description, bonus_points: parseInt(bonus_points) })
      .eq('id', id)
      .select().single();
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ mission: data });
  }

  if (action === 'toggle') {
    const { id, active } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id richiesto' });
    const { data, error } = await supabase
      .from('missions')
      .update({ active: !!active })
      .eq('id', id)
      .select().single();
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ mission: data });
  }

  if (action === 'delete') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id richiesto' });
    await supabase.from('photos').update({ mission_id: null, mission_score: null }).eq('mission_id', id);
    const { error } = await supabase.from('missions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ deleted: true });
  }

  if (action === 'validate') {
    const { photo_id, percent } = req.body ?? {};
    if (!photo_id || ![25, 50, 75, 100].includes(percent)) {
      return res.status(400).json({ error: 'photo_id e percent (25/50/75/100) richiesti' });
    }
    const { data: photo, error: pErr } = await supabase
      .from('photos')
      .select('mission_id, missions(bonus_points)')
      .eq('id', photo_id)
      .single();
    if (pErr || !photo?.mission_id) return res.status(404).json({ error: 'Foto o missione non trovata' });

    const bonus = photo.missions?.bonus_points ?? 0;
    const mission_score = Math.ceil(bonus * percent / 100);

    const { error } = await supabase
      .from('photos')
      .update({ mission_score })
      .eq('id', photo_id);
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ mission_score, percent });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
