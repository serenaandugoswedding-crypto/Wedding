-- ============================================================
-- Migration 004: M3-bis — Rename drive_* columns to web_*
-- ============================================================
-- ⚠️  ATTENZIONE: eseguire SOLO dopo aver deployato il codice
--    aggiornato (Phase 2) che usa web_path / web_url.
--    Se eseguita prima, l'upload rompe in produzione.
-- ============================================================

ALTER TABLE photos
  RENAME COLUMN drive_file_id TO web_path;

ALTER TABLE photos
  RENAME COLUMN drive_url TO web_url;

-- Aggiorna il NOT NULL constraint: web_path rimane NOT NULL
-- (già implicitamente portato dal rename, nessuna azione extra)
