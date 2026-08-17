-- External telematics mapping safety.
-- Gateway/external identity is historical integration identity. Do not silently
-- move an existing mapping to another gateway/external ID, and do not remap the
-- physical vehicle while either the old or new vehicle has an open trip.
-- Emergency telemetry shutdown remains possible by setting active=false or
-- suspending/retiring the gateway.

CREATE OR REPLACE FUNCTION private.jeepney_guard_external_vehicle_mapping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  gateway_operator uuid;
  vehicle_operator uuid;
  old_vehicle_open_trip boolean := false;
  new_vehicle_open_trip boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.gateway_id IS DISTINCT FROM OLD.gateway_id
       OR NEW.external_vehicle_id IS DISTINCT FROM OLD.external_vehicle_id THEN
      RAISE EXCEPTION 'Gateway and external vehicle identity are immutable; create a new mapping instead'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
      SELECT EXISTS (
        SELECT 1 FROM public.jeepney_trips t
        WHERE t.vehicle_id = OLD.vehicle_id
          AND t.ended_at IS NULL
      ) INTO old_vehicle_open_trip;

      SELECT EXISTS (
        SELECT 1 FROM public.jeepney_trips t
        WHERE t.vehicle_id = NEW.vehicle_id
          AND t.ended_at IS NULL
      ) INTO new_vehicle_open_trip;

      IF old_vehicle_open_trip OR new_vehicle_open_trip THEN
        RAISE EXCEPTION 'End active trips before remapping an external telematics vehicle identity'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  SELECT g.operator_id INTO gateway_operator
  FROM public.jeepney_telematics_gateways g
  WHERE g.id = NEW.gateway_id;

  SELECT v.operator_id INTO vehicle_operator
  FROM public.jeepney_vehicles v
  WHERE v.id = NEW.vehicle_id;

  IF vehicle_operator IS NULL THEN
    RAISE EXCEPTION 'Mapped fleet vehicle has no owning operator'
      USING ERRCODE = '23514';
  END IF;

  IF gateway_operator IS NOT NULL AND gateway_operator <> vehicle_operator THEN
    RAISE EXCEPTION 'Operator-scoped telematics gateway cannot map another operator vehicle'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jeepney_guard_external_vehicle_mapping() FROM PUBLIC;

DROP TRIGGER IF EXISTS jeepney_external_vehicle_mappings_guard ON public.jeepney_external_vehicle_mappings;
CREATE TRIGGER jeepney_external_vehicle_mappings_guard
BEFORE INSERT OR UPDATE OF gateway_id, external_vehicle_id, vehicle_id
ON public.jeepney_external_vehicle_mappings
FOR EACH ROW EXECUTE FUNCTION private.jeepney_guard_external_vehicle_mapping();
