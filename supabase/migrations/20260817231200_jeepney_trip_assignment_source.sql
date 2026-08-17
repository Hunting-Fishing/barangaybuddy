-- Phase 3/4 operational safety.
-- Track who created an operational assignment so a phone may stop/reclaim its own
-- trip without ever ending a dispatcher-created trip that a hardwired GPS depends on.

ALTER TABLE public.jeepney_trips
  ADD COLUMN IF NOT EXISTS assignment_source text NOT NULL DEFAULT 'legacy'
  CHECK (assignment_source IN ('legacy', 'phone', 'dispatch', 'api', 'import'));

CREATE INDEX IF NOT EXISTS jeepney_trips_assignment_source_idx
  ON public.jeepney_trips (assignment_source, started_at DESC);

-- Best-effort identification of historical phone trips. This does not guess
-- dispatcher ownership: only trips with matching phone telemetry are relabeled.
UPDATE public.jeepney_trips t
SET assignment_source = 'phone'
WHERE t.assignment_source = 'legacy'
  AND EXISTS (
    SELECT 1
    FROM public.jeepney_positions p
    WHERE p.vehicle_id = t.vehicle_id
      AND p.route_id = t.route_id
      AND p.source = 'phone'
      AND p.recorded_at >= t.started_at
      AND (t.ended_at IS NULL OR p.recorded_at <= t.ended_at + interval '5 minutes')
  );

CREATE OR REPLACE FUNCTION private.jeepney_guard_trip_assignment_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignment_source IS DISTINCT FROM OLD.assignment_source THEN
    RAISE EXCEPTION 'Trip assignment source is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jeepney_trips_guard_assignment_source ON public.jeepney_trips;
CREATE TRIGGER jeepney_trips_guard_assignment_source
BEFORE UPDATE OF assignment_source ON public.jeepney_trips
FOR EACH ROW EXECUTE FUNCTION private.jeepney_guard_trip_assignment_source();
