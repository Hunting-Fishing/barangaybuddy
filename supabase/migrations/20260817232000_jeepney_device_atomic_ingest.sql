-- Barangay Buddy Jeepney Mobility Platform
-- Atomic direct-device ingest finalization with defense-in-depth identity checks.
--
-- The HTTP endpoint authenticates the tracker secret and resolves the current
-- installation/trip. This service-role-only function repeats the critical mobility
-- invariants and commits sequence reservation + rider position + private receipt in
-- one PostgreSQL transaction.

CREATE OR REPLACE FUNCTION public.jeepney_commit_device_telemetry(
  p_device_id uuid,
  p_vehicle_id uuid,
  p_trip_id uuid,
  p_route_id uuid,
  p_route_variant_id uuid,
  p_sequence_key text,
  p_latitude numeric,
  p_longitude numeric,
  p_speed_kph numeric DEFAULT NULL,
  p_heading numeric DEFAULT NULL,
  p_recorded_at timestamptz DEFAULT now(),
  p_event_type text DEFAULT 'position',
  p_accuracy_m numeric DEFAULT NULL,
  p_altitude_m numeric DEFAULT NULL
)
RETURNS TABLE (
  accepted boolean,
  duplicate boolean,
  position_id uuid,
  receipt_id uuid,
  server_received_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt_id uuid;
  v_position_id uuid;
  v_received_at timestamptz := now();
  v_existing public.jeepney_device_ingest_receipts%ROWTYPE;
  v_device_operator uuid;
  v_device_status text;
  v_assignment_vehicle uuid;
  v_vehicle_operator uuid;
  v_vehicle_active boolean;
  v_trip_operator uuid;
  v_trip_vehicle uuid;
  v_trip_route uuid;
  v_trip_variant uuid;
  v_trip_ended_at timestamptz;
  v_route_operator uuid;
  v_route_status public.jeepney_route_status;
  v_variant_route uuid;
  v_variant_active boolean;
BEGIN
  -- Completed replays remain idempotent even if the trip has since ended or the
  -- tracker has later been moved/retired. Sequence is optional for compatibility.
  IF p_sequence_key IS NOT NULL AND btrim(p_sequence_key) <> '' THEN
    SELECT * INTO v_existing
    FROM public.jeepney_device_ingest_receipts receipt
    WHERE receipt.device_id = p_device_id
      AND receipt.sequence_key = p_sequence_key
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
      RETURN QUERY
      SELECT true, true, v_existing.position_id, v_existing.id, v_existing.server_received_at;
      RETURN;
    END IF;
  END IF;

  IF p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Telemetry coordinates are out of range'
      USING ERRCODE = '22023';
  END IF;

  SELECT device.operator_id, device.status
  INTO v_device_operator, v_device_status
  FROM public.jeepney_gps_devices device
  WHERE device.id = p_device_id;

  IF NOT FOUND OR v_device_status NOT IN ('provisioned', 'active') THEN
    RAISE EXCEPTION 'GPS device is missing or not permitted to report'
      USING ERRCODE = '23514';
  END IF;

  SELECT assignment.vehicle_id
  INTO v_assignment_vehicle
  FROM public.jeepney_device_assignments assignment
  WHERE assignment.device_id = p_device_id
    AND assignment.removed_at IS NULL
  LIMIT 1;

  IF NOT FOUND OR v_assignment_vehicle <> p_vehicle_id THEN
    RAISE EXCEPTION 'Active tracker installation is missing or mismatched'
      USING ERRCODE = '23514';
  END IF;

  SELECT vehicle.operator_id, vehicle.active
  INTO v_vehicle_operator, v_vehicle_active
  FROM public.jeepney_vehicles vehicle
  WHERE vehicle.id = p_vehicle_id;

  IF NOT FOUND
     OR v_vehicle_active IS NOT TRUE
     OR v_vehicle_operator IS NULL
     OR v_vehicle_operator <> v_device_operator THEN
    RAISE EXCEPTION 'Tracker and physical vehicle ownership/state do not match'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    trip.operator_id,
    trip.vehicle_id,
    trip.route_id,
    trip.route_variant_id,
    trip.ended_at
  INTO
    v_trip_operator,
    v_trip_vehicle,
    v_trip_route,
    v_trip_variant,
    v_trip_ended_at
  FROM public.jeepney_trips trip
  WHERE trip.id = p_trip_id;

  IF NOT FOUND
     OR v_trip_ended_at IS NOT NULL
     OR v_trip_operator <> v_device_operator
     OR v_trip_vehicle <> p_vehicle_id
     OR v_trip_route <> p_route_id
     OR v_trip_variant <> p_route_variant_id THEN
    RAISE EXCEPTION 'Active trip identity does not match direct hardware telemetry'
      USING ERRCODE = '23514';
  END IF;

  SELECT route.operator_id, route.status
  INTO v_route_operator, v_route_status
  FROM public.jeepney_routes route
  WHERE route.id = p_route_id;

  IF NOT FOUND
     OR v_route_operator <> v_device_operator
     OR v_route_status NOT IN ('published', 'suspended') THEN
    RAISE EXCEPTION 'Trip route is missing, cross-operator or not approved for service'
      USING ERRCODE = '23514';
  END IF;

  SELECT variant.route_id, variant.active
  INTO v_variant_route, v_variant_active
  FROM public.jeepney_route_variants variant
  WHERE variant.id = p_route_variant_id;

  IF NOT FOUND OR v_variant_route <> p_route_id OR v_variant_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Trip route direction is missing, mismatched or inactive'
      USING ERRCODE = '23514';
  END IF;

  IF p_sequence_key IS NOT NULL AND btrim(p_sequence_key) <> '' THEN
    -- Reserve idempotency before publishing. The existing unique partial index on
    -- (device_id, sequence_key) resolves concurrent duplicate requests.
    INSERT INTO public.jeepney_device_ingest_receipts (
      device_id,
      position_id,
      vehicle_id,
      trip_id,
      route_id,
      route_variant_id,
      sequence_key,
      device_recorded_at,
      server_received_at,
      accuracy_m,
      altitude_m,
      event_type
    ) VALUES (
      p_device_id,
      NULL,
      p_vehicle_id,
      p_trip_id,
      p_route_id,
      p_route_variant_id,
      p_sequence_key,
      p_recorded_at,
      v_received_at,
      p_accuracy_m,
      p_altitude_m,
      p_event_type
    )
    ON CONFLICT (device_id, sequence_key)
      WHERE sequence_key IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_receipt_id;

    IF v_receipt_id IS NULL THEN
      SELECT * INTO v_existing
      FROM public.jeepney_device_ingest_receipts receipt
      WHERE receipt.device_id = p_device_id
        AND receipt.sequence_key = p_sequence_key
      LIMIT 1;

      IF v_existing.id IS NULL THEN
        RAISE EXCEPTION 'Device idempotency race could not be resolved'
          USING ERRCODE = '40001';
      END IF;

      RETURN QUERY
      SELECT true, true, v_existing.position_id, v_existing.id, v_existing.server_received_at;
      RETURN;
    END IF;
  ELSE
    -- Legacy/no-sequence reports are still committed atomically, but cannot be
    -- deterministically replay-deduplicated. Pilot/production hardware should send
    -- a stable monotonically increasing or otherwise unique sequence key.
    INSERT INTO public.jeepney_device_ingest_receipts (
      device_id,
      position_id,
      vehicle_id,
      trip_id,
      route_id,
      route_variant_id,
      sequence_key,
      device_recorded_at,
      server_received_at,
      accuracy_m,
      altitude_m,
      event_type
    ) VALUES (
      p_device_id,
      NULL,
      p_vehicle_id,
      p_trip_id,
      p_route_id,
      p_route_variant_id,
      NULL,
      p_recorded_at,
      v_received_at,
      p_accuracy_m,
      p_altitude_m,
      p_event_type
    )
    RETURNING id INTO v_receipt_id;
  END IF;

  INSERT INTO public.jeepney_positions (
    vehicle_id,
    trip_id,
    route_id,
    route_variant_id,
    latitude,
    longitude,
    speed_kph,
    heading,
    source,
    recorded_at
  ) VALUES (
    p_vehicle_id,
    p_trip_id,
    p_route_id,
    p_route_variant_id,
    p_latitude,
    p_longitude,
    p_speed_kph,
    p_heading,
    'hardware',
    p_recorded_at
  )
  RETURNING id INTO v_position_id;

  UPDATE public.jeepney_device_ingest_receipts
  SET position_id = v_position_id
  WHERE id = v_receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device ingest receipt vanished during atomic commit'
      USING ERRCODE = '40001';
  END IF;

  RETURN QUERY
  SELECT true, false, v_position_id, v_receipt_id, v_received_at;
END;
$$;

REVOKE ALL ON FUNCTION public.jeepney_commit_device_telemetry(
  uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric,
  timestamptz, text, numeric, numeric
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.jeepney_commit_device_telemetry(
  uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric,
  timestamptz, text, numeric, numeric
) TO service_role;

COMMENT ON FUNCTION public.jeepney_commit_device_telemetry(
  uuid, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric,
  timestamptz, text, numeric, numeric
) IS
  'Service-role-only atomic finalizer for direct Barangay Buddy GPS telemetry. Revalidates tracker/vehicle/trip/route/variant identity and commits receipt plus public position in one transaction.';
