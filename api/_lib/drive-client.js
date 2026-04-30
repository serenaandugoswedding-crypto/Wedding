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

// Upload nel bucket privato `archive` (originali full-res).
// Restituisce solo il path — nessun URL pubblico perché il bucket è privato.
export async function uploadToArchive({ buffer, filename, mimeType }) {
  const supabase = getSupabaseAdmin();

  console.log('[storage] uploading', filename, 'to bucket "archive"');

  const { data, error } = await supabase.storage
    .from('archive')
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    console.error('[storage] archive upload error:', error.message);
    throw new Error(`Archive upload failed: ${error.message}`);
  }

  console.log('[storage] archive upload ok, path:', data.path);
  return { archive_path: data.path };
}
