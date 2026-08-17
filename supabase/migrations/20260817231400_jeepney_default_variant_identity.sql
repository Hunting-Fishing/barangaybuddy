-- Phase 4 canonical direction invariant.
-- The default route variant is the compatibility bridge to jeepney_routes.path.
-- Its route/code/direction/default/active identity must remain stable so the
-- automatic route-path synchronizer always has one canonical target.

CREATE OR REPLACE FUNCTION private.jeepney_guard_route_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  canonical_path jsonb;
  has_open_trip boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default THEN
      RAISE EXCEPTION 'The canonical default route direction cannot be deleted'
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.jeepney_trips t
      WHERE t.route_variant_id = OLD.id
        AND t.ended_at IS NULL
    ) INTO has_open_trip;
    IF has_open_trip THEN
      RAISE EXCEPTION 'End all active trips before deleting this route direction'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.route_id IS DISTINCT FROM OLD.route_id THEN
    RAISE EXCEPTION 'A route direction cannot be moved to another route'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.is_default THEN
    IF NEW.is_default IS FALSE
       OR NEW.code IS DISTINCT FROM OLD.code
       OR NEW.direction IS DISTINCT FROM OLD.direction
       OR NEW.active IS FALSE THEN
      RAISE EXCEPTION 'The canonical default route direction identity cannot be changed or disabled'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.path IS DISTINCT FROM OLD.path
     OR (OLD.active = true AND NEW.active = false) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.jeepney_trips t
      WHERE t.route_variant_id = OLD.id
        AND t.ended_at IS NULL
    ) INTO has_open_trip;
    IF has_open_trip THEN
      RAISE EXCEPTION 'End all active trips before changing this route direction'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF OLD.is_default AND NEW.path IS DISTINCT FROM OLD.path THEN
    SELECT r.path INTO canonical_path
    FROM public.jeepney_routes r
    WHERE r.id = NEW.route_id;

    IF NEW.path IS DISTINCT FROM canonical_path THEN
      RAISE EXCEPTION 'Edit the canonical geometry through the route editor'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jeepney_guard_route_variant() FROM PUBLIC;
