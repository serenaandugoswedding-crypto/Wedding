import crypto from 'crypto';
import { getSupabaseAdmin } from '../_lib/supabase-admin.js';
import { generateToken } from './_lib/auth.js';

const WINDOW_MS    = 15 * 60 * 1000; // 15-minute sliding window
const MAX_ATTEMPTS = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password required' });
  }

  const ip       = (req.headers['x-forwarded-for'] ?? '0.0.0.0').split(',')[0].trim();
  const supabase = getSupabaseAdmin();

  // PRD addendum: prune rows > 24h BEFORE counting, or the table grows unbounded
  await supabase
    .from('admin_login_attempts')
    .delete()
    .lt('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Count recent failed attempts from this IP in the sliding window
  const { count } = await supabase
    .from('admin_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('attempted_at', new Date(Date.now() - WINDOW_MS).toISOString());

  if (count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes.' });
  }

  // Timing-safe comparison: hash both to SHA-256 to normalise length
  const expected = process.env.ADMIN_PASSWORD ?? '';
  const hashA    = crypto.createHash('sha256').update(password).digest();
  const hashB    = crypto.createHash('sha256').update(expected).digest();
  const ok       = crypto.timingSafeEqual(hashA, hashB);

  if (!ok) {
    await supabase.from('admin_login_attempts').insert({ ip_address: ip });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.status(200).json({ token: generateToken() });
}
