import { getSupabaseAdmin } from './_lib/supabase-admin.js';

// GET /api/me?uuid={guest_uuid}
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { uuid } = req.query;
  if (!uuid || typeof uuid !== 'string') {
    return res.status(400).json({ error: 'uuid required' });
  }

  const supabase = getSupabaseAdmin();

  const [
    { data: guest, error: gErr },
    { data: photosRaw, error: pErr },
    { data: missionsRaw, error: mErr },
    { data: leaderboard },
  ] = await Promise.all([
    supabase.from('guests').select('uuid, display_name').eq('uuid', uuid).single(),
    supabase.from('photos')
      .select('id, drive_url, thumbnail_url, dedication, filter_used, like_count, created_at, mission_id, mission_score')
      .eq('guest_uuid', uuid)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('missions')
      .select('id, title, description, bonus_points')
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase.rpc('get_leaderboard'),
  ]);

  if (gErr || !guest) return res.status(404).json({ error: 'Guest not found' });
  if (pErr || mErr) return res.status(500).json({ error: 'Database error' });

  const photos = photosRaw ?? [];
  const missions = missionsRaw ?? [];

  // Rank
  let rank = null, score = 0, total_guests = 0;
  if (leaderboard) {
    total_guests = leaderboard.length;
    const idx = leaderboard.findIndex(e => String(e.guest_uuid) === String(uuid));
    if (idx !== -1) {
      rank = idx + 1;
      score = Number(leaderboard[idx].score);
    }
  }

  // Missions breakdown
  const attemptedIds = new Set(photos.filter(p => p.mission_id).map(p => p.mission_id));
  const completed = missions
    .filter(m => attemptedIds.has(m.id))
    .map(m => {
      const photo = photos.find(p => p.mission_id === m.id);
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        bonus_points: m.bonus_points,
        status: (photo?.mission_score ?? 0) > 0 ? 'validated' : 'submitted',
        score_obtained: photo?.mission_score ?? 0,
        photo_id: photo?.id ?? null,
      };
    });

  return res.status(200).json({
    guest: { uuid: guest.uuid, display_name: guest.display_name, score, rank, total_guests },
    stats: {
      photos_count: photos.length,
      likes_received: photos.reduce((s, p) => s + (p.like_count ?? 0), 0),
      missions_submitted: completed.length,
      missions_validated: completed.filter(m => m.status === 'validated').length,
    },
    photos,
    missions: {
      completed,
      available: missions.filter(m => !attemptedIds.has(m.id)),
    },
  });
}
