-- Barangay Buddy Jeepney Mobility Platform
-- Atomic external-gateway ingest finalization.
--
-- The API authenticates the gateway and resolves/validates vehicle + active trip
-- first. This function owns the final idempotency reservation, public position
-- insert and private audit receipt inside ONE database transaction. If any step
-- fails, PostgreSQL rolls the whole function call back, so replay cannot create a
-- second public position merely because the receipt write failed.

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
BEGIN
  IF p_sequence_key IS NULL OR btrim(p_sequence_key) = '' THEN
    RAISE EXCEPTION 'Gateway sequence key is required'
      USING ERRCODE = '22023';
  END IF;

  -- Reserve the idempotency key first. The unique partial index on
  -- (gateway_id, external_vehicle_id, sequence_key) makes this deterministic.
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
      RAISE EXCEPTION 'Gateway idempotency conflict could not be resolved'
        USING ERRCODE = '40001';
    END IF;

    RETURN QUERY
    SELECT
      true,
      true,
      v_existing.position_id,
      v_existing.id,
      v_existing.server_received_at;
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

COMMENT ON FUNCTION public.jeepney_commit_gateway_telemetry(
  uuid, text, uuid, uuid, uuid, uuid, text, numeric, numeric, numeric,
  numeric, timestamptz, text, text, numeric, jsonb
) IS
  'Service-role-only atomic finalizer for normalized external gateway telemetry. Reserves sequence idempotency key, inserts public position and completes private receipt in one transaction.';
