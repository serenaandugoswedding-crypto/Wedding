-- Aggiunge mission_score a photos
ALTER TABLE photos ADD COLUMN IF NOT EXISTS mission_score INTEGER DEFAULT NULL;

-- Aggiorna RPC get_leaderboard con nuova formula
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
    g.uuid,
    g.display_name,
    COUNT(p.id)                                                        AS photo_count,
    COALESCE(SUM(p.like_count), 0)                                     AS total_likes,
    COALESCE(SUM(
      CASE
        WHEN p.mission_id IS NULL THEN 0
        WHEN p.mission_score IS NOT NULL THEN p.mission_score
        ELSE CEIL(m.bonus_points * 0.25)
      END
    ), 0)                                                              AS mission_bonus,
    COUNT(p.id) * 10
      + COALESCE(SUM(p.like_count), 0) * 2
      + COALESCE(SUM(
          CASE
            WHEN p.mission_id IS NULL THEN 0
            WHEN p.mission_score IS NOT NULL THEN p.mission_score
            ELSE CEIL(m.bonus_points * 0.25)
          END
        ), 0)                                                          AS score
  FROM guests g
  LEFT JOIN photos p
    ON p.guest_uuid = g.uuid
    AND p.deleted_at IS NULL
  LEFT JOIN missions m
    ON m.id = p.mission_id
  GROUP BY g.uuid, g.display_name
  ORDER BY score DESC
  LIMIT 50;
$$;
