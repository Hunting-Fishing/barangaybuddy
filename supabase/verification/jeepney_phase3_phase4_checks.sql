-- Barangay Buddy Jeepney Mobility Platform
-- Phase 3/4 post-migration verification suite (READ ONLY).
--
-- Run after applying the Jeepney migrations to the target Supabase project.
-- Every query named *_violations should return zero rows/count = 0.
-- This file intentionally performs no writes.

-- 1. Every physical fleet vehicle must have an owning operator.
SELECT 'vehicle_owner_violations' AS check_name, count(*) AS violations
FROM public.jeepney_vehicles
WHERE operator_id IS NULL;

-- 2. Legacy route_id must be nullable and the FK must not cascade-delete vehicles.
SELECT
  'vehicle_legacy_route_fk' AS check_name,
  con.conname AS constraint_name,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
    ELSE con.confdeltype::text
  END AS on_delete
FROM pg_constraint con
JOIN pg_class child ON child.oid = con.conrelid
JOIN pg_class parent ON parent.oid = con.confrelid
WHERE con.contype = 'f'
  AND child.oid = 'public.jeepney_vehicles'::regclass
  AND parent.oid = 'public.jeepney_routes'::regclass;

-- 3. At most one open trip may exist per physical jeepney.
SELECT 'duplicate_open_trip_violations' AS check_name, vehicle_id, count(*) AS open_trips
FROM public.jeepney_trips
WHERE ended_at IS NULL
GROUP BY vehicle_id
HAVING count(*) > 1;

-- 4. Every trip must have one route variant after Phase 4.
SELECT 'trip_variant_null_violations' AS check_name, count(*) AS violations
FROM public.jeepney_trips
WHERE route_variant_id IS NULL;

-- 5. Trip operator, route and fleet vehicle ownership must agree.
SELECT
  'trip_ownership_violations' AS check_name,
  t.id AS trip_id,
  t.operator_id AS trip_operator,
  r.operator_id AS route_operator,
  v.operator_id AS vehicle_operator
FROM public.jeepney_trips t
JOIN public.jeepney_routes r ON r.id = t.route_id
JOIN public.jeepney_vehicles v ON v.id = t.vehicle_id
WHERE t.operator_id IS DISTINCT FROM r.operator_id
   OR t.operator_id IS DISTINCT FROM v.operator_id;

-- 6. Each route must have exactly one canonical/default variant.
SELECT
  'default_variant_count_violations' AS check_name,
  r.id AS route_id,
  r.name AS route_name,
  count(v.id) FILTER (WHERE v.is_default) AS default_variants
FROM public.jeepney_routes r
LEFT JOIN public.jeepney_route_variants v ON v.route_id = r.id
GROUP BY r.id, r.name
HAVING count(v.id) FILTER (WHERE v.is_default) <> 1;

-- 7. Canonical/default identity is expected to remain outbound + active.
SELECT
  'default_variant_identity_violations' AS check_name,
  id AS variant_id,
  route_id,
  code,
  direction,
  active
FROM public.jeepney_route_variants
WHERE is_default
  AND (code <> 'outbound' OR direction <> 'outbound' OR active IS NOT TRUE);

-- 8. Canonical route.path and default variant.path must remain synchronized.
SELECT
  'default_path_sync_violations' AS check_name,
  r.id AS route_id,
  r.name AS route_name,
  v.id AS variant_id
FROM public.jeepney_routes r
JOIN public.jeepney_route_variants v
  ON v.route_id = r.id
 AND v.is_default
WHERE r.path IS DISTINCT FROM v.path;

-- 9. A trip's variant must belong to that same route.
SELECT
  'trip_variant_route_violations' AS check_name,
  t.id AS trip_id,
  t.route_id AS trip_route_id,
  t.route_variant_id,
  v.route_id AS variant_route_id
FROM public.jeepney_trips t
JOIN public.jeepney_route_variants v ON v.id = t.route_variant_id
WHERE t.route_id IS DISTINCT FROM v.route_id;

-- 10. No open trip may use an inactive vehicle or inactive route direction.
SELECT
  'inactive_open_trip_violations' AS check_name,
  t.id AS trip_id,
  t.vehicle_id,
  t.route_variant_id,
  vehicle.active AS vehicle_active,
  variant.active AS variant_active
FROM public.jeepney_trips t
JOIN public.jeepney_vehicles vehicle ON vehicle.id = t.vehicle_id
JOIN public.jeepney_route_variants variant ON variant.id = t.route_variant_id
WHERE t.ended_at IS NULL
  AND (vehicle.active IS NOT TRUE OR variant.active IS NOT TRUE);

-- 11. New direction-aware positions must not contradict their referenced trip.
SELECT
  'position_trip_identity_violations' AS check_name,
  p.id AS position_id,
  p.trip_id,
  p.vehicle_id AS position_vehicle,
  t.vehicle_id AS trip_vehicle,
  p.route_id AS position_route,
  t.route_id AS trip_route,
  p.route_variant_id AS position_variant,
  t.route_variant_id AS trip_variant
FROM public.jeepney_positions p
JOIN public.jeepney_trips t ON t.id = p.trip_id
WHERE p.trip_id IS NOT NULL
  AND (
    p.vehicle_id IS DISTINCT FROM t.vehicle_id
    OR p.route_id IS DISTINCT FROM t.route_id
    OR p.route_variant_id IS DISTINCT FROM t.route_variant_id
  );

-- 12. Tracker installation and fleet vehicle must belong to the same operator.
SELECT
  'tracker_vehicle_operator_violations' AS check_name,
  d.id AS device_id,
  d.operator_id AS tracker_operator,
  a.vehicle_id,
  v.operator_id AS vehicle_operator
FROM public.jeepney_device_assignments a
JOIN public.jeepney_gps_devices d ON d.id = a.device_id
JOIN public.jeepney_vehicles v ON v.id = a.vehicle_id
WHERE a.removed_at IS NULL
  AND d.operator_id IS DISTINCT FROM v.operator_id;

-- 13. A physical vehicle may have at most one active tracker installation.
SELECT
  'duplicate_active_tracker_violations' AS check_name,
  vehicle_id,
  count(*) AS active_trackers
FROM public.jeepney_device_assignments
WHERE removed_at IS NULL
GROUP BY vehicle_id
HAVING count(*) > 1;

-- 14. A physical tracker may have at most one active installation record.
SELECT
  'duplicate_active_device_assignment_violations' AS check_name,
  device_id,
  count(*) AS active_assignments
FROM public.jeepney_device_assignments
WHERE removed_at IS NULL
GROUP BY device_id
HAVING count(*) > 1;

-- 15. Hardware ingest receipts with a trip must agree with that trip identity.
SELECT
  'ingest_receipt_trip_identity_violations' AS check_name,
  receipt.id AS receipt_id,
  receipt.trip_id,
  receipt.vehicle_id AS receipt_vehicle,
  t.vehicle_id AS trip_vehicle,
  receipt.route_id AS receipt_route,
  t.route_id AS trip_route,
  receipt.route_variant_id AS receipt_variant,
  t.route_variant_id AS trip_variant
FROM public.jeepney_device_ingest_receipts receipt
JOIN public.jeepney_trips t ON t.id = receipt.trip_id
WHERE receipt.trip_id IS NOT NULL
  AND (
    receipt.vehicle_id IS DISTINCT FROM t.vehicle_id
    OR receipt.route_id IS DISTINCT FROM t.route_id
    OR receipt.route_variant_id IS DISTINCT FROM t.route_variant_id
  );

-- 16. Trip assignment-source distribution (informational, not pass/fail).
SELECT
  'trip_assignment_source_distribution' AS check_name,
  assignment_source,
  count(*) AS trips,
  count(*) FILTER (WHERE ended_at IS NULL) AS open_trips
FROM public.jeepney_trips
GROUP BY assignment_source
ORDER BY assignment_source;

-- 17. Direction coverage by route (informational).
SELECT
  'route_direction_coverage' AS check_name,
  r.id AS route_id,
  r.name AS route_name,
  count(v.id) FILTER (WHERE v.active) AS active_directions,
  string_agg(v.direction || ':' || v.code, ', ' ORDER BY v.is_default DESC, v.created_at) AS directions
FROM public.jeepney_routes r
LEFT JOIN public.jeepney_route_variants v ON v.route_id = r.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- 18. Variant congestion rows must point to a variant on the same parent route.
SELECT
  'variant_segment_route_violations' AS check_name,
  stats.id AS stat_id,
  stats.route_id AS stat_route_id,
  stats.route_variant_id,
  variant.route_id AS variant_route_id
FROM public.jeepney_variant_segment_stats stats
JOIN public.jeepney_route_variants variant ON variant.id = stats.route_variant_id
WHERE stats.route_id IS DISTINCT FROM variant.route_id;

-- 19. Exact-direction traffic coverage (informational).
SELECT
  'variant_segment_coverage' AS check_name,
  route.id AS route_id,
  route.name AS route_name,
  variant.id AS route_variant_id,
  variant.direction,
  variant.code,
  count(stats.id) AS segment_hour_buckets,
  sum(stats.sample_count) AS speed_samples
FROM public.jeepney_routes route
JOIN public.jeepney_route_variants variant ON variant.route_id = route.id
LEFT JOIN public.jeepney_variant_segment_stats stats ON stats.route_variant_id = variant.id
GROUP BY route.id, route.name, variant.id, variant.direction, variant.code
ORDER BY route.name, variant.is_default DESC, variant.created_at;

-- 20. Atomic direct-device receipts must always finish with a public position.
SELECT
  'device_receipt_missing_position_violations' AS check_name,
  receipt.id AS receipt_id,
  receipt.device_id,
  receipt.sequence_key,
  receipt.server_received_at
FROM public.jeepney_device_ingest_receipts receipt
WHERE receipt.position_id IS NULL;

-- 21. Direct-device receipt and public position identity must agree.
SELECT
  'device_receipt_position_identity_violations' AS check_name,
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
FROM public.jeepney_device_ingest_receipts receipt
JOIN public.jeepney_positions position ON position.id = receipt.position_id
WHERE receipt.vehicle_id IS DISTINCT FROM position.vehicle_id
   OR receipt.trip_id IS DISTINCT FROM position.trip_id
   OR receipt.route_id IS DISTINCT FROM position.route_id
   OR receipt.route_variant_id IS DISTINCT FROM position.route_variant_id;
