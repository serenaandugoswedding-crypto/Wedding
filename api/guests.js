import { getSupabaseAdmin } from './_lib/supabase-admin.js';

export default async function handler(req, res) {
  console.log('[guests] called —', req.method, JSON.stringify(req.body ?? {}));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uuid, display_name } = req.body ?? {};

  if (!uuid || typeof uuid !== 'string') {
    console.error('[guests] 400: uuid missing');
    return res.status(400).json({ error: 'uuid required' });
  }
  if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
    console.error('[guests] 400: display_name missing');
    return res.status(400).json({ error: 'display_name required' });
  }

  const supabase = getSupabaseAdmin();
  const trimmedName = display_name.trim();
  console.log('[guests] upserting uuid:', uuid, 'name:', trimmedName);

  // Check case-insensitive name uniqueness (exclude same uuid for returning guests)
  const { data: nameTaken } = await supabase
    .from('guests')
    .select('uuid')
    .ilike('display_name', trimmedName)
    .neq('uuid', uuid)
    .maybeSingle();

  if (nameTaken) {
    return res.status(409).json({
      error: 'name_taken',
      message: `Un ${trimmedName} è già registrato. Aggiungi iniziale cognome o usa nome diverso.`,
    });
  }

  const { data, error } = await supabase
    .from('guests')
    .upsert(
      { uuid, display_name: trimmedName },
      { onConflict: 'uuid', ignoreDuplicates: false }
    )
    .select('uuid, display_name, total_points, photos_count')
    .single();

  if (error) {
    console.error('[guests] supabase upsert error:', JSON.stringify(error));
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }

  console.log('[guests] upsert ok, uuid:', data.uuid);
  return res.status(200).json({ guest: data });
}
