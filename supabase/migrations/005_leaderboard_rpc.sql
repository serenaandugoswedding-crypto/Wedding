CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  guest_uuid    UUID,
  display_name  TEXT,
  photo_count   BIGINT,
  total_likes   BIGINT,
  mission_bonus BIGINT,
  score         BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    g.guest_uuid,
    g.display_name,
    COUNT(p.id)                          AS photo_count,
    COALESCE(SUM(p.like_count), 0)       AS total_likes,
    COALESCE(SUM(m.bonus_points), 0)     AS mission_bonus,
    COUNT(p.id) * 10
      + COALESCE(SUM(p.like_count), 0) * 2
      + COALESCE(SUM(m.bonus_points), 0) AS score
  FROM guests g
  LEFT JOIN photos p
    ON p.guest_uuid = g.guest_uuid
    AND p.deleted_at IS NULL
  LEFT JOIN missions m
    ON m.id = p.mission_id
    AND m.active = true
  GROUP BY g.guest_uuid, g.display_name
  ORDER BY score DESC
  LIMIT 50;
$$;
