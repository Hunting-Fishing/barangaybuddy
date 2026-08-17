-- Barangay Buddy Jeepney Mobility Platform
-- External telematics gateway post-migration verification (READ ONLY).
-- Run after 20260817231500 + 20260817231600 + 20260817231700.
-- Every *_violations query should return zero rows/count = 0.

-- 1. No active operator-scoped gateway mapping may cross cooperative ownership.
SELECT
  'gateway_mapping_operator_violations' AS check_name,
  mapping.id AS mapping_id,
  gateway.id AS gateway_id,
  gateway.operator_id AS gateway_operator,
  mapping.vehicle_id,
  vehicle.operator_id AS vehicle_operator
FROM public.jeepney_external_vehicle_mappings mapping
JOIN public.jeepney_telematics_gateways gateway ON gateway.id = mapping.gateway_id
JOIN public.jeepney_vehicles vehicle ON vehicle.id = mapping.vehicle_id
WHERE mapping.active
  AND gateway.operator_id IS NOT NULL
  AND gateway.operator_id IS DISTINCT FROM vehicle.operator_id;

-- 2. Retired gateways must not retain active mappings.
SELECT
  'retired_gateway_active_mapping_violations' AS check_name,
  gateway.id AS gateway_id,
  gateway.public_id,
  mapping.id AS mapping_id,
  mapping.external_vehicle_id
FROM public.jeepney_telematics_gateways gateway
JOIN public.jeepney_external_vehicle_mappings mapping ON mapping.gateway_id = gateway.id
WHERE gateway.status = 'retired'
  AND mapping.active;

-- 3. Unique active identity/mapping counts (constraints should already enforce this).
SELECT
  'duplicate_gateway_external_id_violations' AS check_name,
  gateway_id,
  external_vehicle_id,
  count(*) AS mappings
FROM public.jeepney_external_vehicle_mappings
GROUP BY gateway_id, external_vehicle_id
HAVING count(*) > 1;

SELECT
  'duplicate_gateway_vehicle_violations' AS check_name,
  gateway_id,
  vehicle_id,
  count(*) AS mappings
FROM public.jeepney_external_vehicle_mappings
GROUP BY gateway_id, vehicle_id
HAVING count(*) > 1;

-- 4. Sequence idempotency must be unique per gateway + external vehicle.
SELECT
  'duplicate_gateway_sequence_violations' AS check_name,
  gateway_id,
  external_vehicle_id,
  sequence_key,
  count(*) AS receipts
FROM public.jeepney_gateway_ingest_receipts
WHERE sequence_key IS NOT NULL
GROUP BY gateway_id, external_vehicle_id, sequence_key
HAVING count(*) > 1;

-- 5. Every completed atomic gateway receipt must reference its public position.
SELECT
  'gateway_receipt_missing_position_violations' AS check_name,
  receipt.id AS receipt_id,
  receipt.gateway_id,
  receipt.external_vehicle_id,
  receipt.sequence_key
FROM public.jeepney_gateway_ingest_receipts receipt
WHERE receipt.position_id IS NULL;

-- 6. Receipt and public position identity must agree.
SELECT
  'gateway_receipt_position_identity_violations' AS check_name,
  receipt.id AS receipt_id,
  receipt.position_id,
  receipt.vehicle_id AS receipt_vehicle,
  position.vehicle_id AS position_vehicle,
  receipt.trip_id AS receipt_trip,
  position.trip_id AS position_trip,
  receipt.route_id AS receipt_route,
  position.route_id AS position_route,
  receipt.route_variant_id AS receipt_variant,
  position.route_variant_id AS position_variant
FROM public.jeepney_gateway_ingest_receipts receipt
JOIN public.jeepney_positions position ON position.id = receipt.position_id
WHERE receipt.vehicle_id IS DISTINCT FROM position.vehicle_id
   OR receipt.trip_id IS DISTINCT FROM position.trip_id
   OR receipt.route_id IS DISTINCT FROM position.route_id
   OR receipt.route_variant_id IS DISTINCT FROM position.route_variant_id;

-- 7. Receipt trip identity must agree with authoritative trip history.
SELECT
  'gateway_receipt_trip_identity_violations' AS check_name,
  receipt.id AS receipt_id,
  receipt.trip_id,
  receipt.vehicle_id AS receipt_vehicle,
  trip.vehicle_id AS trip_vehicle,
  receipt.route_id AS receipt_route,
  trip.route_id AS trip_route,
  receipt.route_variant_id AS receipt_variant,
  trip.route_variant_id AS trip_variant
FROM public.jeepney_gateway_ingest_receipts receipt
JOIN public.jeepney_trips trip ON trip.id = receipt.trip_id
WHERE receipt.trip_id IS NOT NULL
  AND (
    receipt.vehicle_id IS DISTINCT FROM trip.vehicle_id
    OR receipt.route_id IS DISTINCT FROM trip.route_id
    OR receipt.route_variant_id IS DISTINCT FROM trip.route_variant_id
  );

-- 8. Mapping vehicle IDs must still resolve to real fleet vehicles.
SELECT
  'gateway_orphan_vehicle_mapping_violations' AS check_name,
  mapping.id AS mapping_id,
  mapping.gateway_id,
  mapping.external_vehicle_id,
  mapping.vehicle_id
FROM public.jeepney_external_vehicle_mappings mapping
LEFT JOIN public.jeepney_vehicles vehicle ON vehicle.id = mapping.vehicle_id
WHERE vehicle.id IS NULL;

-- 9. Gateway credentials are represented only by hash fields; informational
-- metadata should never contain a raw secret accidentally copied by admin tooling.
SELECT
  'gateway_raw_secret_metadata_suspicions' AS check_name,
  receipt.id AS receipt_id,
  receipt.gateway_id,
  receipt.external_vehicle_id
FROM public.jeepney_gateway_ingest_receipts receipt
WHERE receipt.raw_metadata ? 'gateway_secret'
   OR receipt.raw_metadata ? 'secret'
   OR receipt.raw_metadata ? 'token';

-- 10. Informational gateway health/coverage summary.
SELECT
  'gateway_health_summary' AS check_name,
  gateway.id,
  gateway.public_id,
  gateway.name,
  gateway.provider,
  gateway.status,
  gateway.last_seen_at,
  count(mapping.id) FILTER (WHERE mapping.active) AS active_mappings,
  max(receipt.server_received_at) AS last_receipt_at,
  count(receipt.id) FILTER (WHERE receipt.server_received_at >= now() - interval '24 hours') AS receipts_24h
FROM public.jeepney_telematics_gateways gateway
LEFT JOIN public.jeepney_external_vehicle_mappings mapping ON mapping.gateway_id = gateway.id
LEFT JOIN public.jeepney_gateway_ingest_receipts receipt ON receipt.gateway_id = gateway.id
GROUP BY gateway.id, gateway.public_id, gateway.name, gateway.provider, gateway.status, gateway.last_seen_at
ORDER BY gateway.name;
