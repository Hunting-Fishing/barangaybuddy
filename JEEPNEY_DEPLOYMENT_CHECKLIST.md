# Barangay Buddy Jeepney Mobility — Deployment Checklist

**Scope:** Multi-vehicle tracking, fleet ownership, active-trip dispatch, GPS hardware, external telematics gateways, route directions/variants, direction-aware congestion history, and rider ETA.

**Current status:** Code is committed on `feature/jeepney-planner-live-route-ui`. This checklist does **not** mean the migrations are deployed or the branch is production validated. A real install/lint/build and authorized database deployment are still required.

---

## 1. Pre-deployment gates

Do not deploy the new Jeepney database layer until all of the following are true:

- [ ] GitHub Actions can run, or an equivalent local `pnpm install --frozen-lockfile && pnpm run lint && pnpm run build` succeeds.
- [ ] Target database/project is positively confirmed before migration.
- [ ] A database backup / recovery option is confirmed.
- [ ] Migration-management permission is available.
- [ ] No operator is actively editing Jeepney routes while migrations are being applied.
- [ ] Existing Jeepney vehicle, trip, position and GPS tables are present as expected.

---

## 2. Migration order

Apply repository migrations in timestamp order. The Phase 3/4, gateway and analytics sequence must remain ordered:

1. `20260817215000_jeepney_hardware_foundation.sql`
2. `20260817222500_jeepney_route_status_security.sql`
3. `20260817225400_jeepney_trip_duplicate_cleanup.sql`
4. `20260817225500_jeepney_fleet_trip_authority.sql`
5. `20260817225800_jeepney_trip_close_safety.sql`
6. `20260817230200_jeepney_legacy_route_fk_safety.sql`
7. `20260817230900_jeepney_stop_position_preflight.sql`
8. `20260817231000_jeepney_route_variants.sql`
9. `20260817231100_jeepney_variant_sync_safety.sql`
10. `20260817231200_jeepney_trip_assignment_source.sql`
11. `20260817231300_jeepney_trip_source_default.sql`
12. `20260817231400_jeepney_default_variant_identity.sql`
13. `20260817231500_jeepney_telematics_gateways.sql`
14. `20260817231600_jeepney_gateway_atomic_ingest.sql`
15. `20260817231700_jeepney_gateway_atomic_guard.sql`
16. `20260817231800_jeepney_gateway_mapping_safety.sql`
17. `20260817231900_jeepney_variant_segment_stats.sql`

The variant analytics migration **does not replace or change the meaning of** `jeepney_segment_stats`. That original table remains canonical/default-direction compatibility data. The new `jeepney_variant_segment_stats` table stores exact-direction history.

Do not cherry-pick only the base route-variant or gateway migration. Adjacent safety migrations deliberately tighten the final invariants.

---

## 3. Immediate post-migration verification

Run:

- `supabase/verification/jeepney_phase3_phase4_checks.sql`
- `supabase/verification/jeepney_gateway_checks.sql`

Expected result: every violation query returns zero rows/counts, including ownership, duplicate open trip, default variant, route/variant, tracker assignment, route-variant congestion, gateway mapping, gateway receipt and telemetry identity checks.

---

## 4. Operator smoke test

### Fleet

- [ ] Open `/jeepney/operator`.
- [ ] Existing routes still load.
- [ ] Add a physical fleet unit.
- [ ] Verify it exists independently of a permanent route.
- [ ] Verify legacy route deletion/change cannot delete the physical vehicle.

### Route directions

- [ ] Every existing route has the canonical outbound/default direction.
- [ ] Create an inbound return direction for a test route.
- [ ] Confirm it starts inactive.
- [ ] Review/correct or GPS-record the actual return geometry.
- [ ] Configure direction-specific stop membership when inbound pickup points differ.
- [ ] Activate only after review.
- [ ] Fleet Dispatch offers the approved directions.

### Dispatch

- [ ] Dispatch Unit A outbound.
- [ ] Second simultaneous open trip for Unit A is rejected.
- [ ] End the trip and dispatch the same physical unit inbound.
- [ ] Confirm the new trip has the inbound `route_variant_id`.

---

## 5. Phone GPS smoke test

- [ ] Select a physical fleet unit and travel direction.
- [ ] Start phone GPS.
- [ ] Confirm phone-created trip uses `assignment_source = 'phone'`.
- [ ] Position rows contain `vehicle_id`, `trip_id`, `route_id`, `route_variant_id`, and `source='phone'`.
- [ ] Ending a phone-owned shift closes its trip.
- [ ] A phone joining a dispatcher-owned trip does not own/close that trip when phone GPS stops.

---

## 6. Direct hardwired GPS smoke test

Provision a test tracker through `/jeepney/admin`.

- [ ] Device secret is displayed only once and only its hash persists server-side.
- [ ] Assign tracker to a physical fleet vehicle.
- [ ] Telemetry with no active trip is rejected and publishes no rider position.
- [ ] Start outbound dispatch and send hardware telemetry.
- [ ] Accepted position has exact vehicle/trip/route/variant identity.
- [ ] End trip, dispatch same physical unit inbound, send telemetry again.
- [ ] Same tracker now publishes against the inbound trip without hardware reassignment.
- [ ] Duplicate sequence replay does not create a second position.
- [ ] Suspended tracker is rejected; reactivation restores service.

---

## 7. External vendor/cooperative gateway smoke test

Provision and map through `/jeepney/admin/gateways`.

Supported ingest endpoint:

`POST /api/telematics/v1/gateway-ingest-v2`

The earlier non-atomic gateway endpoint has been removed from source.

- [ ] Gateway secret is displayed only once and only its hash persists.
- [ ] Map one upstream vehicle ID/IMEI to one Barangay Buddy physical unit.
- [ ] Mapping a scoped gateway across operators is rejected.
- [ ] Unmapped vehicle ID is rejected.
- [ ] Mapped vehicle with no active trip is rejected.
- [ ] Active outbound trip accepts normalized telemetry.
- [ ] Same vehicle can later run inbound without changing the external mapping.
- [ ] Replaying the same gateway + external vehicle + sequence returns the original result/position rather than duplicating it.
- [ ] Suspended/retired gateway is rejected.
- [ ] Run `scripts/jeepney-gateway-smoke.mjs` against the deployed test environment.

---

## 8. Rider smoke test

### Map

- [ ] `/jeepney` shows multiple live vehicles on the same route independently.
- [ ] Fleet/body labels are shown where available.
- [ ] Default geometry is solid and additional active direction geometry is distinguishable.
- [ ] Live marker popup includes assigned direction.
- [ ] Canonical map congestion remains sourced only from the original canonical `jeepney_segment_stats` table.

### Route detail

- [ ] `/jeepney/$slug` keeps fares, schedules, rental, photos, alerts and service calendar intact.
- [ ] Top Arrival card uses `JeepneyArrivalSummary`, not the old route-wide ETA calculation.
- [ ] Detailed live list labels each vehicle outbound/inbound.
- [ ] Both Arrival summary and detailed ETA use the vehicle's exact variant geometry.
- [ ] GPS progress is projected to the nearest route segment rather than snapped only to stored nodes.
- [ ] A passed stop is not presented as approaching.
- [ ] Configured `jeepney_route_variant_stops` membership/order is respected.
- [ ] An inbound direction that omits an outbound-only stop never offers that stop as an inbound ETA target.
- [ ] After analytics rollup, outbound and inbound ETA read different `jeepney_variant_segment_stats` buckets when their measured speeds differ.
- [ ] When no exact-direction history exists, ETA falls back safely to live/default speed rather than borrowing another direction's segment indexes.

---

## 9. Direction-specific congestion rollup

Run the existing Jeepney analytics rollup only after migration `20260817231900` is applied.

- [ ] Existing canonical segment rows were seeded into the default variant history.
- [ ] Pre-variant positions without `route_variant_id` contribute only to the canonical/default direction.
- [ ] New outbound positions update outbound variant buckets.
- [ ] New inbound positions update inbound variant buckets.
- [ ] `jeepney_segment_stats` remains canonical/default-only compatibility data.
- [ ] `jeepney_variant_segment_stats` contains exact direction + segment + hour history.
- [ ] `variant_segment_route_violations` returns zero rows.

---

## 10. Fleet operations smoke test

Open `/jeepney/operator/fleet`.

- [ ] Active trip, route and direction match Fleet Dispatch.
- [ ] GPS freshness transitions live → delayed → offline correctly.
- [ ] Off-route distance is calculated against the exact assigned variant.
- [ ] Bunching/headway spacing groups vehicles by the same route variant/direction.
- [ ] Idle units are shown separately from dispatched units.

Current off-route/bunching thresholds are pilot defaults and should become operator-configurable after field data is collected.

---

## 11. Data integrity rejection tests

Confirm the database rejects:

- [ ] cross-operator vehicle/route assignment
- [ ] cross-operator tracker/vehicle assignment
- [ ] two open trips for one physical vehicle
- [ ] mutation of route/vehicle/variant identity on an open trip
- [ ] deactivating/changing/deleting a direction while an open trip uses it
- [ ] disabling or changing canonical default direction identity
- [ ] route-variant congestion rows whose `route_id` conflicts with the referenced variant
- [ ] telemetry referencing a conflicting trip/variant identity
- [ ] cross-operator gateway mapping
- [ ] gateway vehicle remap while active trips make the remap unsafe
- [ ] operator self-publication of an unapproved route

---

## 12. Pilot acceptance criteria

Do not call the platform pilot-ready until:

- [ ] install/lint/build passes
- [ ] all migrations apply successfully to the intended target
- [ ] verification SQL returns zero violations
- [ ] at least two physical jeepneys run simultaneously on one route
- [ ] one physical jeepney switches outbound → inbound through separate trips
- [ ] phone, direct tracker and external gateway telemetry produce the same normalized identity model
- [ ] direction-specific stop subset is verified on a real inbound route
- [ ] outbound/inbound congestion history is confirmed to remain separated
- [ ] tracker/vendor reconnect and buffered telemetry are tested
- [ ] rider stale-GPS behavior is verified
- [ ] live ETA is checked against actual outbound and inbound road travel
- [ ] production monitoring/logging exists for ingest errors, stale devices and replay rates

---

## 13. Generated routes and rollback

`src/routeTree.gen.ts` is generated. Do not hand-edit it to add the new file routes. The real build must regenerate/validate the route tree.

If database verification fails after migration:

1. stop new dispatch/telemetry writes;
2. preserve telemetry and migration logs;
3. identify the violated invariant using the verification suites;
4. correct with a forward migration rather than deleting production history;
5. rerun verification before reopening service.

Never restore the old assumption that `jeepney_vehicles.route_id` determines live service. The operational model is:

**operator/cooperative → physical vehicle → tracker/external mapping → active trip → route + direction variant → telemetry → rider/cooperative view**.
