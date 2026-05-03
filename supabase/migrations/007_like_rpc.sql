CREATE OR REPLACE FUNCTION increment_like(photo_id UUID)
RETURNS INTEGER
LANGUAGE sql
AS $$
  UPDATE photos
  SET like_count = like_count + 1
  WHERE id = photo_id
    AND deleted_at IS NULL
  RETURNING like_count;
$$;
