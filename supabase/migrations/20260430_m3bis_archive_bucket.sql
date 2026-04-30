-- ============================================================
-- Bucket `archive` — originali full-res (temporanei)
-- ============================================================
-- Eseguire dalla Supabase Dashboard → SQL Editor
-- ============================================================

-- Crea bucket privato (public = false → no URL diretti)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'archive',
  'archive',
  false,
  10485760,  -- 10 MB max per file (originali full-res)
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Upload: solo service role (nessun accesso pubblico in insert)
CREATE POLICY "archive: service_role upload only"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'archive'
    AND auth.role() = 'service_role'
  );

-- Download: solo service role (admin genera signed URL on-demand)
-- Gli ospiti non possono mai leggere direttamente gli originali
CREATE POLICY "archive: service_role read only"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'archive'
    AND auth.role() = 'service_role'
  );

-- Delete: solo service role (per cron purge e cleanup post-curation)
CREATE POLICY "archive: service_role delete only"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'archive'
    AND auth.role() = 'service_role'
  );
