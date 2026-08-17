-- Phase 4 analytics: historical segment speeds belong to an exact route geometry.
-- Keep route_id for efficient RLS/reporting, but make route_variant_id the segment
-- identity so outbound and inbound/custom paths never share incompatible indexes.

ALTER TABLE public.jeepney_segment_stats
  ADD COLUMN IF NOT EXISTS route_variant_id uuid;

UPDATE public.jeepney_segment_stats stats
SET route_variant_id = variants.id
FROM public.jeepney_route_variants variants
WHERE stats.route_variant_id IS NULL
  AND variants.route_id = stats.route_id
  AND variants.is_default = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.jeepney_segment_stats
    WHERE route_variant_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enable route-variant segment analytics: canonical variant backfill is incomplete';
  END IF;
END
$$;

ALTER TABLE public.jeepney_segment_stats
  ALTER COLUMN route_variant_id SET NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.jeepney_segment_stats'::regclass
    AND con.contype = 'u'
    AND pg_get_constraintdef(con.oid) = 'UNIQUE (route_id, segment_index, hour)'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.jeepney_segment_stats DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.jeepney_segment_stats'::regclass
      AND conname = 'jeepney_segment_stats_route_variant_fkey'
  ) THEN
    ALTER TABLE public.jeepney_segment_stats
      ADD CONSTRAINT jeepney_segment_stats_route_variant_fkey
      FOREIGN KEY (route_variant_id)
      REFERENCES public.jeepney_route_variants(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS jeepney_segment_stats_variant_segment_hour_uidx
  ON public.jeepney_segment_stats (route_variant_id, segment_index, hour);

CREATE INDEX IF NOT EXISTS jeepney_segment_stats_route_variant_hour_idx
  ON public.jeepney_segment_stats (route_id, route_variant_id, hour);

CREATE OR REPLACE FUNCTION private.jeepney_guard_segment_stat_variant()
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

REVOKE ALL ON FUNCTION private.jeepney_guard_segment_stat_variant() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_jeepney_segment_stat_variant
  ON public.jeepney_segment_stats;
CREATE TRIGGER guard_jeepney_segment_stat_variant
BEFORE INSERT OR UPDATE OF route_id, route_variant_id
ON public.jeepney_segment_stats
FOR EACH ROW
EXECUTE FUNCTION private.jeepney_guard_segment_stat_variant();
