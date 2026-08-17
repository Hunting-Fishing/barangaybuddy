-- Barangay Buddy Jeepney Mobility Platform
-- Phase 4: explicit route variants/directions.
--
-- A route is the public service identity (e.g. Laoag - Batac). A route variant is
-- one operational geometry/direction (outbound, inbound, loop, custom). Trips and
-- new telemetry carry the exact variant so rider ETA no longer has to infer travel
-- direction from a single route polyline.

CREATE TABLE public.jeepney_route_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound', 'loop', 'custom')),
  path jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, code)
);

CREATE UNIQUE INDEX jeepney_route_variants_one_default_idx
  ON public.jeepney_route_variants (route_id)
  WHERE is_default = true;
CREATE INDEX jeepney_route_variants_route_active_idx
  ON public.jeepney_route_variants (route_id, active, direction);

GRANT SELECT ON public.jeepney_route_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.jeepney_route_variants TO authenticated;
GRANT ALL ON public.jeepney_route_variants TO service_role;
ALTER TABLE public.jeepney_route_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public route variants are visible"
ON public.jeepney_route_variants FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jeepney_routes r
    WHERE r.id = jeepney_route_variants.route_id
      AND r.status IN ('published', 'suspended')
  )
);

CREATE POLICY "Operators manage own route variants"
ON public.jeepney_route_variants FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    JOIN public.jeepney_operators o ON o.id = r.operator_id
    WHERE r.id = jeepney_route_variants.route_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    JOIN public.jeepney_operators o ON o.id = r.operator_id
    WHERE r.id = jeepney_route_variants.route_id
      AND o.user_id = auth.uid()
  )
);

CREATE TRIGGER jeepney_route_variants_touch
BEFORE UPDATE ON public.jeepney_route_variants
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Every existing route gets a canonical primary/outbound variant that mirrors the
-- existing route.path. This keeps all current route pages and route editors valid.
INSERT INTO public.jeepney_route_variants (
  route_id, code, name, direction, path, is_default, active
)
SELECT
  r.id,
  'outbound',
  'Primary / outbound',
  'outbound',
  COALESCE(r.path, '[]'::jsonb),
  true,
  true
FROM public.jeepney_routes r
ON CONFLICT (route_id, code) DO NOTHING;

-- Ensure a route created by existing application code automatically receives its
-- default variant, and keep that default geometry synchronized when route.path is
-- edited through the existing route editor.
CREATE OR REPLACE FUNCTION private.jeepney_sync_default_route_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.jeepney_route_variants (
    route_id, code, name, direction, path, is_default, active
  ) VALUES (
    NEW.id, 'outbound', 'Primary / outbound', 'outbound', COALESCE(NEW.path, '[]'::jsonb), true, true
  )
  ON CONFLICT (route_id, code) DO UPDATE
  SET path = EXCLUDED.path,
      active = true,
      updated_at = now()
  WHERE public.jeepney_route_variants.is_default = true;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jeepney_sync_default_route_variant() FROM PUBLIC;

DROP TRIGGER IF EXISTS jeepney_routes_sync_default_variant ON public.jeepney_routes;
CREATE TRIGGER jeepney_routes_sync_default_variant
AFTER INSERT OR UPDATE OF path ON public.jeepney_routes
FOR EACH ROW EXECUTE FUNCTION private.jeepney_sync_default_route_variant();

-- Protect the compatibility contract: the default variant remains canonical and
-- its path is edited through jeepney_routes.path. Custom/inbound variants can have
-- independent geometry.
CREATE OR REPLACE FUNCTION private.jeepney_guard_route_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_default THEN
    RAISE EXCEPTION 'The default route variant cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.route_id IS DISTINCT FROM OLD.route_id THEN
      RAISE EXCEPTION 'A route variant cannot be moved to another route'
        USING ERRCODE = '23514';
    END IF;
    IF OLD.is_default AND NEW.is_default IS FALSE THEN
      RAISE EXCEPTION 'The canonical default route variant cannot be unset'
        USING ERRCODE = '23514';
    END IF;
    IF OLD.is_default AND NEW.path IS DISTINCT FROM OLD.path THEN
      RAISE EXCEPTION 'Edit the default geometry through the route editor'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS jeepney_route_variants_guard ON public.jeepney_route_variants;
CREATE TRIGGER jeepney_route_variants_guard
BEFORE UPDATE OR DELETE ON public.jeepney_route_variants
FOR EACH ROW EXECUTE FUNCTION private.jeepney_guard_route_variant();

-- Optional variant-specific stop membership/order. Existing/default behavior is
-- backfilled from jeepney_stops; an inbound/custom variant can later use a
-- different stop order or subset without duplicating the stop identity itself.
CREATE TABLE public.jeepney_route_variant_stops (
  variant_id uuid NOT NULL REFERENCES public.jeepney_route_variants(id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES public.jeepney_stops(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, stop_id),
  UNIQUE (variant_id, position)
);
CREATE INDEX jeepney_route_variant_stops_stop_idx
  ON public.jeepney_route_variant_stops (stop_id);

GRANT SELECT ON public.jeepney_route_variant_stops TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.jeepney_route_variant_stops TO authenticated;
GRANT ALL ON public.jeepney_route_variant_stops TO service_role;
ALTER TABLE public.jeepney_route_variant_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public variant stops are visible"
ON public.jeepney_route_variant_stops FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_route_variants v
    JOIN public.jeepney_routes r ON r.id = v.route_id
    WHERE v.id = jeepney_route_variant_stops.variant_id
      AND r.status IN ('published', 'suspended')
  )
);

CREATE POLICY "Operators manage own variant stops"
ON public.jeepney_route_variant_stops FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_route_variants v
    JOIN public.jeepney_routes r ON r.id = v.route_id
    JOIN public.jeepney_operators o ON o.id = r.operator_id
    WHERE v.id = jeepney_route_variant_stops.variant_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jeepney_route_variants v
    JOIN public.jeepney_routes r ON r.id = v.route_id
    JOIN public.jeepney_operators o ON o.id = r.operator_id
    WHERE v.id = jeepney_route_variant_stops.variant_id
      AND o.user_id = auth.uid()
  )
);

INSERT INTO public.jeepney_route_variant_stops (variant_id, stop_id, position)
SELECT v.id, s.id, s.position
FROM public.jeepney_route_variants v
JOIN public.jeepney_stops s ON s.route_id = v.route_id
WHERE v.is_default = true
ON CONFLICT (variant_id, stop_id) DO NOTHING;

-- Keep default variant stop membership synchronized with the existing stop editor.
CREATE OR REPLACE FUNCTION private.jeepney_sync_default_variant_stop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  default_variant_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.route_id IS DISTINCT FROM OLD.route_id THEN
    DELETE FROM public.jeepney_route_variant_stops vs
    USING public.jeepney_route_variants v
    WHERE vs.variant_id = v.id
      AND vs.stop_id = OLD.id
      AND v.is_default = true;
  END IF;

  SELECT v.id INTO default_variant_id
  FROM public.jeepney_route_variants v
  WHERE v.route_id = NEW.route_id
    AND v.is_default = true
  LIMIT 1;

  IF default_variant_id IS NOT NULL THEN
    INSERT INTO public.jeepney_route_variant_stops (variant_id, stop_id, position)
    VALUES (default_variant_id, NEW.id, NEW.position)
    ON CONFLICT (variant_id, stop_id) DO UPDATE
      SET position = EXCLUDED.position;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jeepney_sync_default_variant_stop() FROM PUBLIC;

DROP TRIGGER IF EXISTS jeepney_stops_sync_default_variant ON public.jeepney_stops;
CREATE TRIGGER jeepney_stops_sync_default_variant
AFTER INSERT OR UPDATE OF route_id, position ON public.jeepney_stops
FOR EACH ROW EXECUTE FUNCTION private.jeepney_sync_default_variant_stop();

-- Carry exact direction identity through trips and new telemetry. Historical
-- public positions stay valid; route_variant_id is backfilled to the route default
-- where possible, while trip_id remains null for old rows because it cannot be
-- reconstructed reliably from timestamps alone.
ALTER TABLE public.jeepney_trips
  ADD COLUMN IF NOT EXISTS route_variant_id uuid REFERENCES public.jeepney_route_variants(id) ON DELETE RESTRICT;
ALTER TABLE public.jeepney_positions
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.jeepney_trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS route_variant_id uuid REFERENCES public.jeepney_route_variants(id) ON DELETE SET NULL;
ALTER TABLE public.jeepney_device_ingest_receipts
  ADD COLUMN IF NOT EXISTS route_variant_id uuid REFERENCES public.jeepney_route_variants(id) ON DELETE SET NULL;

UPDATE public.jeepney_trips t
SET route_variant_id = v.id
FROM public.jeepney_route_variants v
WHERE t.route_variant_id IS NULL
  AND v.route_id = t.route_id
  AND v.is_default = true;

ALTER TABLE public.jeepney_trips
  ALTER COLUMN route_variant_id SET NOT NULL;

UPDATE public.jeepney_positions p
SET route_variant_id = v.id
FROM public.jeepney_route_variants v
WHERE p.route_variant_id IS NULL
  AND v.route_id = p.route_id
  AND v.is_default = true;

UPDATE public.jeepney_device_ingest_receipts receipt
SET route_variant_id = v.id
FROM public.jeepney_route_variants v
WHERE receipt.route_variant_id IS NULL
  AND v.route_id = receipt.route_id
  AND v.is_default = true;

CREATE INDEX jeepney_trips_variant_started_idx
  ON public.jeepney_trips (route_variant_id, started_at DESC);
CREATE INDEX jeepney_positions_variant_time_idx
  ON public.jeepney_positions (route_variant_id, recorded_at DESC);
CREATE INDEX jeepney_positions_trip_time_idx
  ON public.jeepney_positions (trip_id, recorded_at DESC)
  WHERE trip_id IS NOT NULL;

-- Replace the Phase 3 trip guard with variant-aware validation. Existing callers
-- may omit route_variant_id; the canonical default is filled automatically.
CREATE OR REPLACE FUNCTION private.jeepney_guard_trip_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  route_operator uuid;
  vehicle_operator uuid;
  vehicle_active boolean;
  variant_route uuid;
  variant_active boolean;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.route_variant_id IS NULL THEN
    SELECT v.id INTO NEW.route_variant_id
    FROM public.jeepney_route_variants v
    WHERE v.route_id = NEW.route_id
      AND v.is_default = true
      AND v.active = true
    LIMIT 1;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.operator_id IS DISTINCT FROM OLD.operator_id
       OR NEW.route_id IS DISTINCT FROM OLD.route_id
       OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
       OR NEW.route_variant_id IS DISTINCT FROM OLD.route_variant_id THEN
      RAISE EXCEPTION 'Trip operator, route, variant and vehicle are immutable; end the trip and start a new assignment'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'A jeepney trip requires a physical vehicle_id'
      USING ERRCODE = '23502';
  END IF;

  SELECT r.operator_id INTO route_operator
  FROM public.jeepney_routes r
  WHERE r.id = NEW.route_id;
  IF route_operator IS NULL OR route_operator <> NEW.operator_id THEN
    RAISE EXCEPTION 'Trip route does not belong to the selected operator'
      USING ERRCODE = '23514';
  END IF;

  SELECT v.route_id, v.active INTO variant_route, variant_active
  FROM public.jeepney_route_variants v
  WHERE v.id = NEW.route_variant_id;
  IF variant_route IS NULL OR variant_route <> NEW.route_id THEN
    RAISE EXCEPTION 'Trip route variant does not belong to the selected route'
      USING ERRCODE = '23514';
  END IF;
  IF variant_active IS FALSE AND (TG_OP = 'INSERT' OR NEW.ended_at IS NULL) THEN
    RAISE EXCEPTION 'Inactive route variants cannot start or continue an operational trip'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT v.operator_id, v.active INTO vehicle_operator, vehicle_active
    FROM public.jeepney_vehicles v
    WHERE v.id = NEW.vehicle_id;
    IF vehicle_operator IS NULL OR vehicle_operator <> NEW.operator_id THEN
      RAISE EXCEPTION 'Trip vehicle does not belong to the selected operator'
        USING ERRCODE = '23514';
    END IF;
    IF vehicle_active IS FALSE AND (TG_OP = 'INSERT' OR NEW.ended_at IS NULL) THEN
      RAISE EXCEPTION 'Inactive jeepney vehicles cannot start or continue an operational trip'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jeepney_guard_trip_assignment() FROM PUBLIC;

-- Strengthen authenticated phone writes: legacy clients may omit trip/variant IDs,
-- but whenever supplied they must exactly match the one open trip. New app code
-- supplies both, giving realtime consumers deterministic direction identity.
DROP POLICY IF EXISTS "Operator posts positions for own active fleet" ON public.jeepney_positions;
CREATE POLICY "Operator posts positions for own active fleet"
ON public.jeepney_positions FOR INSERT TO authenticated
WITH CHECK (
  jeepney_positions.vehicle_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    JOIN public.jeepney_operators o ON o.id = r.operator_id
    JOIN public.jeepney_vehicles vehicle
      ON vehicle.id = jeepney_positions.vehicle_id
     AND vehicle.operator_id = r.operator_id
     AND vehicle.active = true
    JOIN public.jeepney_trips t
      ON t.vehicle_id = vehicle.id
     AND t.route_id = r.id
     AND t.operator_id = r.operator_id
     AND t.ended_at IS NULL
    WHERE r.id = jeepney_positions.route_id
      AND o.user_id = auth.uid()
      AND (jeepney_positions.trip_id IS NULL OR jeepney_positions.trip_id = t.id)
      AND (jeepney_positions.route_variant_id IS NULL OR jeepney_positions.route_variant_id = t.route_variant_id)
  )
);
