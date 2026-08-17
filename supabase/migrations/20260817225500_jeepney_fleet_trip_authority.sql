-- Barangay Buddy Jeepney Mobility Platform
-- Phase 3: fleet vehicles belong to an operator/cooperative; active trips assign
-- those vehicles to routes. jeepney_vehicles.route_id remains temporarily as a
-- nullable legacy/home-route hint so older deployments can migrate safely.

ALTER TABLE public.jeepney_vehicles
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.jeepney_operators(id) ON DELETE CASCADE;

-- Existing vehicles were owned indirectly through their route. Preserve that
-- ownership before route_id becomes optional.
UPDATE public.jeepney_vehicles v
SET operator_id = r.operator_id
FROM public.jeepney_routes r
WHERE v.operator_id IS NULL
  AND v.route_id = r.id;

ALTER TABLE public.jeepney_vehicles
  ALTER COLUMN operator_id SET NOT NULL,
  ALTER COLUMN route_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS jeepney_vehicles_operator_idx
  ON public.jeepney_vehicles (operator_id, active, created_at);

COMMENT ON COLUMN public.jeepney_vehicles.operator_id IS
  'Authoritative fleet ownership. A physical jeepney belongs to an operator/cooperative independently of the route it serves.';
COMMENT ON COLUMN public.jeepney_vehicles.route_id IS
  'Legacy/home-route hint only. Operational route assignment is authoritative on the active jeepney_trips row.';

-- jeepney_trips.vehicle_id existed before a foreign key was added. NOT VALID
-- protects rollout if historical rows contain stale IDs while enforcing the FK
-- for all new/changed rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jeepney_trips_vehicle_id_fkey'
      AND conrelid = 'public.jeepney_trips'::regclass
  ) THEN
    ALTER TABLE public.jeepney_trips
      ADD CONSTRAINT jeepney_trips_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES public.jeepney_vehicles(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

-- Hardware audit rows should record the exact operational trip that resolved the
-- route. This is private metadata and is not exposed through public positions.
ALTER TABLE public.jeepney_device_ingest_receipts
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.jeepney_trips(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jeepney_device_ingest_trip_idx
  ON public.jeepney_device_ingest_receipts (trip_id, server_received_at DESC)
  WHERE trip_id IS NOT NULL;

-- Historical browser sessions could leave more than one open trip. Keep the
-- newest as authoritative and close older duplicates before adding the guard.
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

CREATE UNIQUE INDEX IF NOT EXISTS jeepney_trips_one_active_vehicle_idx
  ON public.jeepney_trips (vehicle_id)
  WHERE vehicle_id IS NOT NULL AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS jeepney_trips_vehicle_started_idx
  ON public.jeepney_trips (vehicle_id, started_at DESC);

-- Enforce trip consistency at the database boundary. The active trip is now the
-- operational assignment of a physical fleet vehicle to a route; switching
-- routes means ending one trip and starting another.
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
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.operator_id IS DISTINCT FROM OLD.operator_id
       OR NEW.route_id IS DISTINCT FROM OLD.route_id
       OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
      RAISE EXCEPTION 'Trip operator, route and vehicle are immutable; end the trip and start a new assignment'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'A jeepney trip requires a physical vehicle_id'
      USING ERRCODE = '23502';
  END IF;

  SELECT r.operator_id
  INTO route_operator
  FROM public.jeepney_routes r
  WHERE r.id = NEW.route_id;

  IF route_operator IS NULL OR route_operator <> NEW.operator_id THEN
    RAISE EXCEPTION 'Trip route does not belong to the selected operator'
      USING ERRCODE = '23514';
  END IF;

  -- Preserve the ability to close/edit historical trips that predate vehicle
  -- identity, but every newly inserted trip above requires a vehicle.
  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT v.operator_id, v.active
    INTO vehicle_operator, vehicle_active
    FROM public.jeepney_vehicles v
    WHERE v.id = NEW.vehicle_id;

    IF vehicle_operator IS NULL OR vehicle_operator <> NEW.operator_id THEN
      RAISE EXCEPTION 'Trip vehicle does not belong to the selected operator'
        USING ERRCODE = '23514';
    END IF;

    IF vehicle_active IS FALSE THEN
      RAISE EXCEPTION 'Inactive jeepney vehicles cannot start or continue an operational trip'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.jeepney_guard_trip_assignment() FROM PUBLIC;

DROP TRIGGER IF EXISTS jeepney_trips_guard_assignment ON public.jeepney_trips;
CREATE TRIGGER jeepney_trips_guard_assignment
BEFORE INSERT OR UPDATE ON public.jeepney_trips
FOR EACH ROW EXECUTE FUNCTION private.jeepney_guard_trip_assignment();

-- Fleet ownership is no longer inferred through vehicle.route_id.
DROP POLICY IF EXISTS "Operator manages own vehicles" ON public.jeepney_vehicles;
DROP POLICY IF EXISTS "Operator manages own fleet vehicles" ON public.jeepney_vehicles;
CREATE POLICY "Operator manages own fleet vehicles"
ON public.jeepney_vehicles FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jeepney_operators o
    WHERE o.id = jeepney_vehicles.operator_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jeepney_operators o
    WHERE o.id = jeepney_vehicles.operator_id
      AND o.user_id = auth.uid()
  )
);

-- A rider may resolve the public unit/body label when the vehicle is currently
-- serving a public route. Retain legacy route visibility during migration.
DROP POLICY IF EXISTS "Vehicles of published routes are public" ON public.jeepney_vehicles;
DROP POLICY IF EXISTS "Vehicles of public routes are public" ON public.jeepney_vehicles;
DROP POLICY IF EXISTS "Active public-service vehicles are visible" ON public.jeepney_vehicles;
CREATE POLICY "Active public-service vehicles are visible"
ON public.jeepney_vehicles FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_trips t
    JOIN public.jeepney_routes r ON r.id = t.route_id
    WHERE t.vehicle_id = jeepney_vehicles.id
      AND t.ended_at IS NULL
      AND r.status IN ('published', 'suspended')
  )
  OR EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    WHERE r.id = jeepney_vehicles.route_id
      AND r.status IN ('published', 'suspended')
  )
);

-- Tighten trip self-service so an operator cannot pair their operator_id with a
-- different cooperative's route or vehicle. Historical vehicle-less trips stay
-- editable/closable, but new inserts are rejected by the trigger above.
DROP POLICY IF EXISTS "Operators manage their own trips" ON public.jeepney_trips;
DROP POLICY IF EXISTS "Operators manage consistent own trips" ON public.jeepney_trips;
CREATE POLICY "Operators manage consistent own trips"
ON public.jeepney_trips FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jeepney_operators o
    WHERE o.id = jeepney_trips.operator_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jeepney_operators o
    WHERE o.id = jeepney_trips.operator_id
      AND o.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.jeepney_routes r
    WHERE r.id = jeepney_trips.route_id
      AND r.operator_id = jeepney_trips.operator_id
  )
  AND (
    jeepney_trips.vehicle_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.jeepney_vehicles v
      WHERE v.id = jeepney_trips.vehicle_id
        AND v.operator_id = jeepney_trips.operator_id
    )
  )
);

-- Phone GPS writes now require the same active trip used by hardware. An
-- authenticated operator cannot post a fleet vehicle onto an arbitrary route.
-- Hardware writes use service_role and are independently validated by the ingest
-- gateway before reaching jeepney_positions.
DROP POLICY IF EXISTS "Operator posts own positions" ON public.jeepney_positions;
DROP POLICY IF EXISTS "Operator posts positions for own active fleet" ON public.jeepney_positions;
CREATE POLICY "Operator posts positions for own active fleet"
ON public.jeepney_positions FOR INSERT TO authenticated
WITH CHECK (
  jeepney_positions.vehicle_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    JOIN public.jeepney_operators o ON o.id = r.operator_id
    JOIN public.jeepney_vehicles v
      ON v.id = jeepney_positions.vehicle_id
     AND v.operator_id = r.operator_id
     AND v.active = true
    JOIN public.jeepney_trips t
      ON t.vehicle_id = v.id
     AND t.route_id = r.id
     AND t.operator_id = r.operator_id
     AND t.ended_at IS NULL
    WHERE r.id = jeepney_positions.route_id
      AND o.user_id = auth.uid()
  )
);
