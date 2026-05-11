-- Unique guest display names, case-insensitive
CREATE UNIQUE INDEX idx_guests_name_lower ON guests (LOWER(display_name));
