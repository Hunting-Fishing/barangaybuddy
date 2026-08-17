-- Phase 4 preflight.
-- Legacy jeepney_stops does not enforce unique `position` per route. The initial
-- route-variant backfill uses (variant_id, position) uniqueness, so normalize only
-- duplicate/ambiguous ordering before that table is created. Existing relative
-- order is preserved by current position, creation time, then ID.

WITH ranked AS (
  SELECT
    s.id,
    row_number() OVER (
      PARTITION BY s.route_id
      ORDER BY s.position ASC, s.created_at ASC, s.id ASC
    ) - 1 AS normalized_position
  FROM public.jeepney_stops s
), routes_with_ambiguous_positions AS (
  SELECT route_id
  FROM public.jeepney_stops
  GROUP BY route_id, position
  HAVING count(*) > 1
)
UPDATE public.jeepney_stops s
SET position = ranked.normalized_position
FROM ranked
WHERE s.id = ranked.id
  AND EXISTS (
    SELECT 1
    FROM routes_with_ambiguous_positions ambiguous
    WHERE ambiguous.route_id = s.route_id
  );
