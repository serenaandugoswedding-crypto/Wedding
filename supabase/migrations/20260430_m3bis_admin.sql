-- ============================================================
-- Migration 003: M3-bis — Admin Photos & Curation
-- ============================================================
-- Adds archive_path, archived_at, is_editors_pick to photos.
-- deleted_at already exists from migration 001.
-- Column rename (drive_file_id→web_path, drive_url→web_url)
-- is in migration 004, applied together with code changes.
-- ============================================================

-- ── Nuove colonne ─────────────────────────────────────────────

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS archive_path      TEXT,
  ADD COLUMN IF NOT EXISTS archived_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_editors_pick   BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Indici per query app pubblica ─────────────────────────────

-- Query gallery/slideshow/leaderboard: foto vive ordinate per data
CREATE INDEX IF NOT EXISTS idx_photos_not_deleted
  ON photos(created_at DESC)
  WHERE deleted_at IS NULL;

-- Recovery admin: trova foto soft-deleted per eventuale purge
CREATE INDEX IF NOT EXISTS idx_photos_deleted_recovery
  ON photos(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Batch ZIP admin: foto vive non ancora archiviate
CREATE INDEX IF NOT EXISTS idx_photos_pending_archive
  ON photos(created_at)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

-- ── Tabella rate limit per login admin ────────────────────────
-- Usata da api/admin/auth.js per bloccare brute force (5 tentativi / 15min)

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  TEXT         NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_attempts_ip_time
  ON admin_login_attempts(ip_address, attempted_at DESC);

-- RLS abilitata senza policy esplicite: con RLS ON e zero policy,
-- tutti i ruoli (anon, authenticated) sono bloccati by default.
-- Il service_role bypassa RLS automaticamente — nessuna policy necessaria.
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- TODO (Fase 3 — api/admin/auth.js): il handler del login DEVE eseguire
-- il seguente DELETE prima del COUNT dei tentativi recenti, altrimenti
-- la tabella cresce senza limite:
--
--   DELETE FROM admin_login_attempts
--   WHERE attempted_at < NOW() - INTERVAL '24 hours';
--
-- Questa migration crea la tabella ma non il cleanup — la responsabilità
-- è interamente in api/admin/auth.js. Senza quel DELETE, il rate limit
-- funziona ma la tabella accumula righe indefinitamente.
