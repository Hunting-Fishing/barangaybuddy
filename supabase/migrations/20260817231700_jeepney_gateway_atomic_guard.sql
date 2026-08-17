-- Barangay Buddy Jeepney Mobility Platform
-- Defense-in-depth for atomic external gateway ingest.
--
-- The HTTP endpoint already validates gateway -> external mapping -> vehicle ->
-- active trip -> route -> route variant. Repeat those invariants inside the
-- service-role-only database finalizer so another server-side caller cannot bypass
-- the mobility model by calling the RPC with arbitrary IDs.

CREATE OR REPLACE FUNCTION public.jeepney_commit_gateway_telemetry(
  p_gateway_id uuid,
  p_external_vehicle_id text,
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
  p_source text DEFAULT 'gateway',
  p_event_type text DEFAULT 'position',
  p_accuracy_m numeric DEFAULT NULL,
  p_raw_metadata jsonb DEFAULT '{}'::jsonb
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
  v_existing public.jeepney_gateway_ingest_receipts%ROWTYPE;
  v_gateway_operator uuid;
  v_gateway_status text;
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
  v_mapping_vehicle uuid;
  v_mapping_active boolean;
BEGIN
  IF p_sequence_key IS NULL OR btrim(p_sequence_key) = '' THEN
    RAISE EXCEPTION 'Gateway sequence key is required'
      USING ERRCODE = '22023';
  END IF;

  -- A completed replay must remain idempotent even after its original trip has
  -- ended or a mapping has later changed. Return the immutable prior receipt first.
  SELECT * INTO v_existing
  FROM public.jeepney_gateway_ingest_receipts receipt
  WHERE receipt.gateway_id = p_gateway_id
    AND receipt.external_vehicle_id = p_external_vehicle_id
    AND receipt.sequence_key = p_sequence_key
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY
    SELECT true, true, v_existing.position_id, v_existing.id, v_existing.server_received_at;
    RETURN;
  END IF;

  IF p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Telemetry coordinates are out of range'
      USING ERRCODE = '22023';
  END IF;

  SELECT g.operator_id, g.status
  INTO v_gateway_operator, v_gateway_status
  FROM public.jeepney_telematics_gateways g
  WHERE g.id = p_gateway_id;

  IF NOT FOUND OR v_gateway_status <> 'active' THEN
    RAISE EXCEPTION 'Telematics gateway is missing or inactive'
      USING ERRCODE = '23514';
  END IF;

  SELECT mapping.vehicle_id, mapping.active
  INTO v_mapping_vehicle, v_mapping_active
  FROM public.jeepney_external_vehicle_mappings mapping
  WHERE mapping.gateway_id = p_gateway_id
    AND mapping.external_vehicle_id = p_external_vehicle_id
  LIMIT 1;

  IF NOT FOUND OR v_mapping_active IS NOT TRUE OR v_mapping_vehicle <> p_vehicle_id THEN
    RAISE EXCEPTION 'External vehicle mapping is missing, inactive or mismatched'
      USING ERRCODE = '23514';
  END IF;

  SELECT vehicle.operator_id, vehicle.active
  INTO v_vehicle_operator, v_vehicle_active
  FROM public.jeepney_vehicles vehicle
  WHERE vehicle.id = p_vehicle_id;

  IF NOT FOUND OR v_vehicle_operator IS NULL OR v_vehicle_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Mapped physical vehicle is missing, unowned or inactive'
      USING ERRCODE = '23514';
  END IF;

  IF v_gateway_operator IS NOT NULL AND v_gateway_operator <> v_vehicle_operator THEN
    RAISE EXCEPTION 'Gateway operator does not match mapped vehicle operator'
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
     OR v_trip_vehicle <> p_vehicle_id
     OR v_trip_route <> p_route_id
     OR v_trip_variant <> p_route_variant_id
     OR v_trip_operator <> v_vehicle_operator THEN
    RAISE EXCEPTION 'Active trip identity does not match gateway telemetry assignment'
      USING ERRCODE = '23514';
  END IF;

  SELECT route.operator_id, route.status
  INTO v_route_operator, v_route_status
  FROM public.jeepney_routes route
  WHERE route.id = p_route_id;

  IF NOT FOUND
     OR v_route_operator <> v_vehicle_operator
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

  -- Reserve the idempotency key. A concurrent caller may have inserted the same
  -- sequence after the early duplicate read; ON CONFLICT resolves that race.
  INSERT INTO public.jeepney_gateway_ingest_receipts (
    gateway_id,
    external_vehicle_id,
    vehicle_id,
    trip_id,
    route_id,
    route_variant_id,
    position_id,
    sequence_key,
    device_recorded_at,
    server_received_at,
    event_type,
    accuracy_m,
    raw_metadata
  ) VALUES (
    p_gateway_id,
    p_external_vehicle_id,
    p_vehicle_id,
    p_trip_id,
    p_route_id,
    p_route_variant_id,
    NULL,
    p_sequence_key,
    p_recorded_at,
    v_received_at,
    p_event_type,
    p_accuracy_m,
    COALESCE(p_raw_metadata, '{}'::jsonb)
  )
  ON CONFLICT (gateway_id, external_vehicle_id, sequence_key)
    WHERE sequence_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_receipt_id;

  IF v_receipt_id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.jeepney_gateway_ingest_receipts receipt
    WHERE receipt.gateway_id = p_gateway_id
      AND receipt.external_vehicle_id = p_external_vehicle_id
      AND receipt.sequence_key = p_sequence_key
    LIMIT 1;

    IF v_existing.id IS NULL THEN
      RAISE EXCEPTION 'Gateway idempotency race could not be resolved'
        USING ERRCODE = '40001';
    END IF;

    RETURN QUERY
    SELECT true, true, v_existing.position_id, v_existing.id, v_existing.server_received_at;
    RETURN;
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
    p_source,
    p_recorded_at
  )
  RETURNING id INTO v_position_id;

  UPDATE public.jeepney_gateway_ingest_receipts
  SET position_id = v_position_id
  WHERE id = v_receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gateway ingest receipt vanished during atomic commit'
      USING ERRCODE = '40001';
  END IF;

  RETURN QUERY
  SELECT true, false, v_position_id, v_receipt_id, v_received_at;
END;
$$;

REVOKE ALL ON FUNCTION public.jeepney_commit_gateway_telemetry(
  uuid, text, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric,
  numeric, timestamptz, text, text, numeric, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.jeepney_commit_gateway_telemetry(
  uuid, text, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric,
  numeric, timestamptz, text, text, numeric, jsonb
) TO service_role;
