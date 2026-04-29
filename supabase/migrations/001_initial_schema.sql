-- ============================================================
-- Migration 001: Initial schema for Serena & Ugo Wedding App
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE guests (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  total_points INTEGER DEFAULT 0,
  photos_count INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  bonus_points INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_uuid UUID REFERENCES guests(uuid),
  drive_file_id TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  thumbnail_url TEXT,
  dedication TEXT,
  mission_id UUID REFERENCES missions(id) NULL,
  filter_used TEXT DEFAULT 'originale' CHECK (filter_used IN (
    'originale', 'bn_drama', 'sepia_editorial',
    'bloom_cipria', 'vintage_polaroid', 'inchiostro', 'notte_party'
  )),
  rotation_deg DECIMAL DEFAULT 0,
  position_x DECIMAL DEFAULT 0,
  position_y DECIMAL DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE photo_likes (
  photo_id UUID REFERENCES photos(id),
  guest_uuid UUID REFERENCES guests(uuid),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (photo_id, guest_uuid)
);

CREATE TABLE guestbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_uuid UUID REFERENCES guests(uuid),
  message TEXT NOT NULL CHECK (length(message) <= 280),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phase TEXT DEFAULT 'pre_rito' CHECK (phase IN ('pre_rito', 'post_rito', 'archive')),
  cover_image_url TEXT,
  cover_quote TEXT,
  editors_pick_threshold INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Default event settings row ────────────────────────────────

INSERT INTO event_settings (id, phase, editors_pick_threshold)
VALUES (1, 'pre_rito', 10);

-- ── Enable RLS on all tables ──────────────────────────────────

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE guestbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- ── Public SELECT policies ────────────────────────────────────

CREATE POLICY "guests: public read"
  ON guests FOR SELECT TO anon USING (true);

CREATE POLICY "missions: public read"
  ON missions FOR SELECT TO anon USING (true);

CREATE POLICY "photos: public read (non-deleted)"
  ON photos FOR SELECT TO anon USING (deleted_at IS NULL);

CREATE POLICY "photo_likes: public read"
  ON photo_likes FOR SELECT TO anon USING (true);

CREATE POLICY "guestbook_entries: public read"
  ON guestbook_entries FOR SELECT TO anon USING (true);

CREATE POLICY "event_settings: public read"
  ON event_settings FOR SELECT TO anon USING (true);

-- ── Public INSERT policies ────────────────────────────────────
-- Rate limiting is enforced server-side by the API layer.

CREATE POLICY "guests: public insert"
  ON guests FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "photo_likes: public insert"
  ON photo_likes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "guestbook_entries: public insert"
  ON guestbook_entries FOR INSERT TO anon WITH CHECK (true);

-- ── Service-role-only policies ────────────────────────────────
-- All other write operations go through Vercel functions
-- using SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- No extra policies needed — service_role is exempt by default.
-- Explicitly block anon writes on sensitive tables:

CREATE POLICY "photos: service_role only write"
  ON photos FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "photos: service_role only update"
  ON photos FOR UPDATE TO anon USING (false);

CREATE POLICY "photos: service_role only delete"
  ON photos FOR DELETE TO anon USING (false);

CREATE POLICY "missions: service_role only write"
  ON missions FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "missions: service_role only update"
  ON missions FOR UPDATE TO anon USING (false);

CREATE POLICY "missions: service_role only delete"
  ON missions FOR DELETE TO anon USING (false);

CREATE POLICY "event_settings: service_role only write"
  ON event_settings FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "event_settings: service_role only update"
  ON event_settings FOR UPDATE TO anon USING (false);

CREATE POLICY "admin_actions: no anon access"
  ON admin_actions FOR ALL TO anon USING (false);
