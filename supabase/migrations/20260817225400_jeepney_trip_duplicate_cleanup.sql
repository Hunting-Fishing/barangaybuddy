-- Phase 3 preflight cleanup.
-- This runs immediately before 20260817225500 so historical duplicate open trips
-- are closed before the new jeepney_trips.vehicle_id FK is introduced. That order
-- matters because a NOT VALID FK still checks rows touched by later UPDATEs.

WITH ranked_open_trips AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY vehicle_id
      ORDER BY started_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.jeepney_trips
  WHERE vehicle_id IS NOT NULL
    AND ended_at IS NULL
)
UPDATE public.jeepney_trips t
SET ended_at = now(), updated_at = now()
FROM ranked_open_trips ranked
WHERE t.id = ranked.id
  AND ranked.rn > 1;
