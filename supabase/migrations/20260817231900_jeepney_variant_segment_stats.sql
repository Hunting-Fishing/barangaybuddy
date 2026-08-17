-- Phase 4 analytics: historical segment speeds belong to an exact route geometry.
-- Preserve public.jeepney_segment_stats as the canonical/default-route compatibility
-- table and add a separate variant-aware table for outbound/inbound/custom history.

CREATE TABLE IF NOT EXISTS public.jeepney_variant_segment_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  route_variant_id uuid NOT NULL REFERENCES public.jeepney_route_variants(id) ON DELETE CASCADE,
  segment_index integer NOT NULL CHECK (segment_index >= 0),
  hour smallint NOT NULL CHECK (hour >= 0 AND hour <= 23),
  avg_speed_kph numeric,
  sample_count integer NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_variant_id, segment_index, hour)
);

CREATE INDEX IF NOT EXISTS jeepney_variant_segment_stats_route_hour_idx
  ON public.jeepney_variant_segment_stats (route_id, hour);
CREATE INDEX IF NOT EXISTS jeepney_variant_segment_stats_variant_hour_idx
  ON public.jeepney_variant_segment_stats (route_variant_id, hour);

GRANT SELECT ON public.jeepney_variant_segment_stats TO anon;
GRANT SELECT ON public.jeepney_variant_segment_stats TO authenticated;
GRANT ALL ON public.jeepney_variant_segment_stats TO service_role;

ALTER TABLE public.jeepney_variant_segment_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read variant segment speeds for live routes"
  ON public.jeepney_variant_segment_stats;
CREATE POLICY "Anyone can read variant segment speeds for live routes"
ON public.jeepney_variant_segment_stats FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_routes route
    WHERE route.id = jeepney_variant_segment_stats.route_id
      AND route.status IN ('published', 'suspended')
  )
);

DROP POLICY IF EXISTS "Operators read their own variant segment speeds"
  ON public.jeepney_variant_segment_stats;
CREATE POLICY "Operators read their own variant segment speeds"
ON public.jeepney_variant_segment_stats FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_routes route
    JOIN public.jeepney_operators operator ON operator.id = route.operator_id
    WHERE route.id = jeepney_variant_segment_stats.route_id
      AND operator.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION private.jeepney_guard_variant_segment_stat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  variant_route_id uuid;
BEGIN
  SELECT route_id INTO variant_route_id
  FROM public.jeepney_route_variants
  WHERE id = NEW.route_variant_id;

  IF variant_route_id IS NULL THEN
    RAISE EXCEPTION 'Unknown Jeepney route variant for segment statistic'
      USING ERRCODE = '23503';
  END IF;

  IF variant_route_id <> NEW.route_id THEN
    RAISE EXCEPTION 'Segment statistic route and route variant do not match'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.jeepney_guard_variant_segment_stat() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_jeepney_variant_segment_stat
  ON public.jeepney_variant_segment_stats;
CREATE TRIGGER guard_jeepney_variant_segment_stat
BEFORE INSERT OR UPDATE OF route_id, route_variant_id
ON public.jeepney_variant_segment_stats
FOR EACH ROW
EXECUTE FUNCTION private.jeepney_guard_variant_segment_stat();

-- Seed the new direction-aware table from existing canonical traffic history so
-- the default direction retains historical data immediately after deployment.
INSERT INTO public.jeepney_variant_segment_stats (
  route_id,
  route_variant_id,
  segment_index,
  hour,
  avg_speed_kph,
  sample_count,
  updated_at
)
SELECT
  stats.route_id,
  variant.id,
  stats.segment_index,
  stats.hour,
  stats.avg_speed_kph,
  stats.sample_count,
  stats.updated_at
FROM public.jeepney_segment_stats stats
JOIN public.jeepney_route_variants variant
  ON variant.route_id = stats.route_id
 AND variant.is_default = true
ON CONFLICT (route_variant_id, segment_index, hour)
DO UPDATE SET
  avg_speed_kph = EXCLUDED.avg_speed_kph,
  sample_count = EXCLUDED.sample_count,
  updated_at = EXCLUDED.updated_at;
