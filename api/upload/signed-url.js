import { getSupabaseAdmin } from '../_lib/supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { guest_uuid, fileType } = req.query;

  if (!guest_uuid || !fileType || !['web', 'archive'].includes(fileType)) {
    return res.status(400).json({ error: 'guest_uuid and fileType (web|archive) required' });
  }

  const supabase = getSupabaseAdmin();

  const { data: guest, error: guestErr } = await supabase
    .from('guests')
    .select('uuid')
    .eq('uuid', guest_uuid)
    .maybeSingle();

  if (guestErr || !guest) {
    return res.status(400).json({ error: 'Unknown guest' });
  }

  const timestamp = Date.now();
  const uid8      = guest_uuid.slice(0, 8);
  const bucket    = fileType === 'archive' ? 'archive' : 'photos';
  const path      = `${timestamp}_${uid8}_${fileType}.jpg`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) {
    console.error('[signed-url] createSignedUploadUrl error:', error.message);
    return res.status(500).json({ error: 'Could not generate signed URL' });
  }

  return res.status(200).json({
    signedUrl: data.signedUrl,
    path:      data.path || path,
    token:     data.token,
    bucket,
  });
}
