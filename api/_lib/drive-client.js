import { getSupabaseAdmin } from './supabase-admin.js';

export async function uploadToDrive({ buffer, filename, mimeType }) {
  const supabase = getSupabaseAdmin();

  console.log('[storage] uploading', filename, 'to bucket "photos"');

  const { data, error } = await supabase.storage
    .from('photos')
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    console.error('[storage] upload error:', error.message);
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(data.path);

  console.log('[storage] upload ok, path:', data.path);
  return {
    drive_file_id: data.path,
    drive_url:     publicUrl,
  };
}
