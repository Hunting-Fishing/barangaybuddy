-- Phase 4 safety corrections applied immediately after route-variant creation.
-- 1) Allow the route.path -> default variant sync trigger to update canonical path.
-- 2) Do not require future route-stop position values to be globally unique; a
--    stable ordering index is sufficient and is more tolerant of legacy editors.

CREATE OR REPLACE FUNCTION private.jeepney_guard_route_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  canonical_path jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default THEN
      RAISE EXCEPTION 'The default route variant cannot be deleted'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.route_id IS DISTINCT FROM OLD.route_id THEN
    RAISE EXCEPTION 'A route variant cannot be moved to another route'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.is_default AND NEW.is_default IS FALSE THEN
    RAISE EXCEPTION 'The canonical default route variant cannot be unset'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.is_default AND NEW.path IS DISTINCT FROM OLD.path THEN
    SELECT r.path INTO canonical_path
    FROM public.jeepney_routes r
    WHERE r.id = NEW.route_id;

    -- The only permitted default-path update is the value already committed to
    -- jeepney_routes.path by the existing route editor/sync trigger.
    IF NEW.path IS DISTINCT FROM canonical_path THEN
      RAISE EXCEPTION 'Edit the default geometry through the route editor'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jeepney_guard_route_variant() FROM PUBLIC;

DO $$
DECLARE
  unique_constraint_name text;
BEGIN
  SELECT con.conname
  INTO unique_constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.jeepney_route_variant_stops'::regclass
    AND con.contype = 'u'
    AND con.conkey = ARRAY[
      (SELECT attnum FROM pg_attribute
       WHERE attrelid = 'public.jeepney_route_variant_stops'::regclass
         AND attname = 'variant_id' AND NOT attisdropped),
      (SELECT attnum FROM pg_attribute
       WHERE attrelid = 'public.jeepney_route_variant_stops'::regclass
         AND attname = 'position' AND NOT attisdropped)
    ]::smallint[]
  LIMIT 1;

  IF unique_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.jeepney_route_variant_stops DROP CONSTRAINT %I',
      unique_constraint_name
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS jeepney_route_variant_stops_order_idx
  ON public.jeepney_route_variant_stops (variant_id, position, stop_id);
