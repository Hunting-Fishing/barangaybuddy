-- Phase 3 safety correction.
-- An inactive fleet vehicle must not start or continue operational service, but
-- an already-open historical/operational trip must always be closable.

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

  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT v.operator_id, v.active
    INTO vehicle_operator, vehicle_active
    FROM public.jeepney_vehicles v
    WHERE v.id = NEW.vehicle_id;

    IF vehicle_operator IS NULL OR vehicle_operator <> NEW.operator_id THEN
      RAISE EXCEPTION 'Trip vehicle does not belong to the selected operator'
        USING ERRCODE = '23514';
    END IF;

    -- Closing a trip is always allowed even if the fleet vehicle was disabled
    -- first. Starting or keeping an open trip on an inactive vehicle is blocked.
    IF vehicle_active IS FALSE
       AND (TG_OP = 'INSERT' OR NEW.ended_at IS NULL) THEN
      RAISE EXCEPTION 'Inactive jeepney vehicles cannot start or continue an operational trip'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.jeepney_guard_trip_assignment() FROM PUBLIC;
