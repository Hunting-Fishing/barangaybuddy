# Barangay Buddy Jeepney Mobility — Deployment Checklist

**Scope:** Multi-vehicle tracking, fleet ownership, active-trip dispatch, GPS hardware, route directions/variants, direction-aware rider telemetry.

**Current status:** Code committed on `feature/jeepney-planner-live-route-ui`. This checklist does **not** mean the migrations are deployed. The target Supabase project still needs authorized migration access and the branch still needs a real lint/build run.

---

## 1. Pre-deployment gates

Do not deploy the new Jeepney database layer until all of the following are true:

- [ ] GitHub Actions billing/account lock is cleared **or** an equivalent local `pnpm install --frozen-lockfile && pnpm run lint && pnpm run build` succeeds.
- [ ] Target Supabase project is confirmed as `stwfpogxpfimyimdexqo`.
- [ ] A database backup / point-in-time recovery option is confirmed.
- [ ] Migration-management permission is available for the target project.
- [ ] No operator is actively editing Jeepney routes while migrations are being applied.
- [ ] Existing `jeepney_vehicles`, `jeepney_trips`, `jeepney_positions` and GPS tables are present as expected.

---

## 2. Migration order

Apply migrations in repository timestamp order. The Phase 3/4 sequence that must remain ordered is:

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

Do **not** cherry-pick only the base route-variant migration. Its adjacent preflight and safety migrations intentionally handle legacy data and tighten the final invariants.

---

## 3. Immediate post-migration verification

Run:

`supabase/verification/jeepney_phase3_phase4_checks.sql`

Expected pass criteria:

- `vehicle_owner_violations = 0`
- no duplicate open trips
- `trip_variant_null_violations = 0`
- no trip ownership mismatches
- exactly one default route variant per route
- no default-variant identity violations
- no default path-sync violations
- no trip/variant route mismatches
- no open trip on inactive vehicle/direction
- no position/trip identity mismatches
- no tracker/vehicle operator mismatches
- no duplicate active tracker assignment per device or vehicle
- no ingest receipt/trip identity mismatches

The final two result sets are informational distributions for trip source and route direction coverage.

---

## 4. Application smoke test — operator

Use a non-production/test operator first.

### Fleet

- [ ] Open `/jeepney/operator`.
- [ ] Existing routes still load.
- [ ] Add a physical fleet unit with body/unit number.
- [ ] Verify it appears in Fleet Dispatch independently of any permanent route.
- [ ] Verify a legacy route can be deleted/changed without deleting the physical vehicle.

### Route direction

- [ ] Confirm every existing route has `Primary / outbound`.
- [ ] Create `Return / inbound` for one test route.
- [ ] Confirm it begins **inactive**.
- [ ] Review the reversed starter line.
- [ ] Correct the line manually or GPS-record the actual return path.
- [ ] Save geometry.
- [ ] Activate only after the actual route is verified.
- [ ] Confirm Fleet Dispatch now offers both outbound and inbound.

### Dispatch

- [ ] Dispatch Unit A to outbound.
- [ ] Confirm a second open trip for Unit A is rejected.
- [ ] End Unit A's trip.
- [ ] Dispatch the same physical unit to inbound.
- [ ] Confirm the new trip has the inbound `route_variant_id`.

---

## 5. Application smoke test — phone GPS

- [ ] Select a physical fleet unit.
- [ ] Select the travel direction.
- [ ] Start phone GPS.
- [ ] Confirm a phone-owned trip is created with `assignment_source = 'phone'`.
- [ ] Confirm new `jeepney_positions` contain `vehicle_id`, `trip_id`, `route_id`, `route_variant_id`, and `source='phone'`.
- [ ] Stop/end the shift and confirm the phone-owned trip closes.
- [ ] Start a dispatcher-owned trip for the same vehicle.
- [ ] Join it with phone GPS.
- [ ] Stop **phone GPS only**.
- [ ] Confirm the dispatcher trip remains open.

---

## 6. Application smoke test — hardwired GPS

Provision a test tracker through `/jeepney/admin`.

- [ ] Device secret is displayed only once.
- [ ] Only the secret hash is persisted server-side.
- [ ] Install/assign the tracker to the physical fleet vehicle.
- [ ] With **no active trip**, telemetry ingest must return an operational conflict and must not publish a rider position.
- [ ] Start an outbound dispatch trip.
- [ ] Send hardware telemetry.
- [ ] Confirm accepted position contains exact vehicle/trip/route/variant identity.
- [ ] End trip and dispatch same vehicle inbound.
- [ ] Send hardware telemetry again.
- [ ] Confirm the same physical tracker now publishes against the inbound trip without hardware reassignment.
- [ ] Test duplicate `sequence` replay; second request must return `duplicate: true` rather than create another position.
- [ ] Suspend tracker; telemetry must be rejected.
- [ ] Reactivate tracker; telemetry can resume.

---

## 7. Rider smoke test

### Map

- [ ] `/jeepney` shows multiple live vehicles on the same route independently.
- [ ] Actual fleet/body labels are shown where available.
- [ ] Default/outbound route geometry is solid.
- [ ] Additional active direction geometry is shown separately (currently dashed).
- [ ] Live marker popup includes assigned direction.

### Route detail

- [ ] `/jeepney/$slug` keeps fares, schedules, rental, photos, alerts and service calendar intact.
- [ ] Detailed live-unit list labels each vehicle outbound/inbound.
- [ ] Detailed live-unit ETA uses the vehicle's variant geometry.
- [ ] GPS position is projected onto the nearest route **segment**, not merely snapped to a stored path node.
- [ ] A vehicle that already passed a stop on its assigned direction is not presented as approaching that stop.
- [ ] Variant-specific stop membership/order is respected where configured.

**Known pre-merge gate:** the old top-level route-detail hero Arrival card still uses the legacy route-wide calculation. `JeepneyArrivalSummary` is prepared as the direction-aware replacement, but the large existing route page should be changed only with a safe file-level edit so newer unrelated route features are not lost.

---

## 8. Data integrity tests

Attempt each operation and confirm the database rejects it:

- [ ] assign a vehicle owned by Operator A to Operator B's route
- [ ] assign Operator A's tracker to Operator B's vehicle
- [ ] create two open trips for the same vehicle
- [ ] mutate route/vehicle/variant identity on an already-open trip
- [ ] deactivate/change/delete a route variant while an open trip is using it
- [ ] disable/delete the canonical default route direction
- [ ] change canonical default direction code/direction identity
- [ ] phone position insert that references a trip/variant other than the vehicle's open trip
- [ ] self-publish a draft/pending route as a normal operator

---

## 9. Pilot acceptance criteria

Do not call the platform pilot-ready until:

- [ ] lint/build passes
- [ ] migrations apply successfully on target project
- [ ] verification SQL returns zero violations
- [ ] at least 2 physical jeepneys can run simultaneously on one route
- [ ] one physical jeepney successfully switches outbound → inbound through two trips
- [ ] both phone and hardware telemetry produce the same normalized identity model
- [ ] tracker reconnect/offline buffering is tested with real hardware/vendor protocol
- [ ] rider map remains correct after stale GPS (>5 min)
- [ ] live ETA behavior is manually checked against actual road travel on at least one outbound and one inbound journey
- [ ] route-detail hero Arrival card is moved to the direction-aware implementation
- [ ] production monitoring/logging is enabled for ingest 4xx/5xx, stale devices and duplicate/replay rates

---

## 10. Rollback principle

If verification fails after migration:

1. stop new operator dispatch/phone/hardware writes;
2. preserve telemetry and migration logs;
3. identify the exact violated invariant using the verification suite;
4. correct with a forward migration rather than manually deleting production history;
5. rerun all verification checks before reopening dispatch.

Do not restore the old assumption that `jeepney_vehicles.route_id` determines live service. The authoritative operational model is:

**operator/cooperative → physical vehicle → tracker installation → active trip → route + route variant/direction → telemetry → rider view**.
