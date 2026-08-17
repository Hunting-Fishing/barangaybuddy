# Barangay Buddy Jeepney Mobility Platform

**Status:** Active build — source architecture substantially implemented; production validation/deployment still blocked  
**Working branch:** `feature/jeepney-planner-live-route-ui`  
**Open PR:** #3 → `main`  
**Last updated:** 2026-08-18

---

## 1. Product goal

Build Barangay Buddy into a **device-agnostic Philippine public-transport mobility platform** that combines:

- free commuter route discovery;
- multiple live jeepneys per route;
- exact outbound/inbound/custom travel directions;
- direction-aware pickup ETA;
- stops, fares, schedules and service alerts;
- driver-phone GPS fallback;
- Barangay Buddy hardwired GPS hardware;
- existing cooperative/vendor/OEM GPS integration;
- cooperative fleet dispatch and operations;
- controlled government/LGU/partner dashboards and APIs;
- route/trip/device/vehicle audit history;
- future GTFS and GTFS-Realtime output.

> **Platform principle:** Hardware is replaceable. Barangay Buddy owns the normalized transport-data layer, fleet identity, trip assignment, rider experience, operational history and integration contract.

---

## 2. Authoritative mobility identity

Permanent identity:

```text
operator / cooperative
        |
physical vehicle
        |
tracker installation OR external vendor mapping
```

Operational identity:

```text
physical vehicle
      |
active trip
      |
route + exact route variant/direction
      |
normalized telemetry
```

A jeepney **does not permanently equal one route**. `jeepney_vehicles.route_id` is legacy/home-route compatibility metadata only. The open trip is authoritative for current service.

External GPS systems also do not choose the live route. Their upstream vehicle identity maps to the physical Barangay Buddy vehicle; Fleet Dispatch determines the active trip, route and direction.

---

## 3. Telemetry architecture

```text
GPS / TELEMATICS SOURCES
  |
  +-- Driver phone / PWA
  +-- Barangay Buddy 4G GNSS tracker
  +-- Cooperative existing GPS platform
  +-- TOPFLYtech adapter
  +-- Jimi / Concox adapter
  +-- Teltonika adapter
  +-- Queclink adapter
  +-- OEM telematics
  |
  v
BARANGAY BUDDY NORMALIZATION LAYER
  - source authentication
  - external vehicle mapping
  - timestamp / coordinate validation
  - sequence / replay controls
  - device / gateway health
  - active-trip resolution
  - route + direction identity
  |
  v
TRANSPORT CORE
  operator/cooperative -> physical vehicle -> active trip -> route variant
  |
  +-------------+----------------+----------------+
  |             |                |                |
Rider app   Fleet ops       Admin/device      Partner/LGU
```

---

## 4. Multi-vehicle rider tracking — implemented in source

The original route-keyed live state collapsed multiple jeepneys into one marker. That architecture has been replaced.

- [x] Latest position retained independently per physical vehicle
- [x] Realtime INSERT merges into the correct vehicle stream
- [x] Polling rebuilds latest-per-vehicle state
- [x] Multiple simultaneous markers on `/jeepney`
- [x] Multiple simultaneous markers on `/jeepney/$slug`
- [x] Live vehicle counts by route
- [x] Five-minute stale pruning
- [x] Real fleet/body labels where available
- [x] UUID fragment only as fallback identity

Primary code:

- `src/lib/jeepney-live.ts`
- `src/components/jeepney-map.tsx`
- `src/routes/jeepney.index.tsx`
- `src/routes/jeepney.$slug.tsx`

---

## 5. Fleet ownership and dispatch — implemented in source

Phase 3 decouples the physical vehicle from permanent route ownership.

- [x] `jeepney_vehicles.operator_id` is authoritative fleet ownership
- [x] Legacy `route_id` is nullable/home-route metadata
- [x] Deleting a route cannot cascade-delete the physical vehicle
- [x] One open trip maximum per physical vehicle
- [x] Trip operator, vehicle and route ownership guarded in the database
- [x] Existing trip identity cannot be reassigned underneath live telemetry
- [x] Fleet Dispatch can add physical units
- [x] Fleet Dispatch starts exact route-direction trips
- [x] Fleet Dispatch ends trips so the same unit can switch route/direction
- [x] Route claim approval creates operator-owned fleet inventory

Operator component:

`src/components/jeepney-fleet-dispatch.tsx`

---

## 6. Route variants / directions — implemented in source

A public route may have multiple operational geometries:

- outbound;
- inbound / return;
- loop;
- custom direction.

Database:

- `jeepney_route_variants`
- `jeepney_route_variant_stops`

Behavior:

- [x] Every legacy route receives one canonical/default outbound variant
- [x] Canonical route path stays synchronized with the default variant
- [x] Default identity cannot be disabled/re-coded/re-purposed
- [x] `route_variant_id` stamped on trips and normalized telemetry
- [x] Direction geometry cannot change/deactivate/delete while an open trip depends on it
- [x] Operator can create an inactive return-direction draft
- [x] Reversed outbound path is only an explicit starter, never silently assumed correct
- [x] Return route can be manually corrected or GPS-recorded
- [x] Direction requires explicit activation before dispatch
- [x] Variant-specific stop membership/order supported

---

## 7. Direction-aware ETA — implemented in source

Rider ETA now follows the actual assigned route direction rather than applying one outbound path to every unit.

- [x] `/jeepney/$slug` uses `JeepneyArrivalSummary`
- [x] Old route-wide `bestEta` calculation removed
- [x] Detailed live-unit cards use exact direction geometry
- [x] GPS progress projects onto the nearest point of a polyline segment
- [x] Passed stops are excluded from approaching ETA
- [x] `jeepney_route_variant_stops` controls eligible stop subset/order when configured
- [x] Legacy/unconfigured direction falls back to geometric stop order
- [x] Outbound-only stops can be excluded from inbound ETA
- [x] Direction-specific traffic history is consumed when available
- [x] Missing exact-direction history safely falls back to live/default speed

Core helpers:

- `src/lib/jeepney-variants.ts`
- `src/components/jeepney-arrival-summary.tsx`
- `src/components/jeepney-live-vehicle-list.tsx`

---

## 8. Direction-specific congestion analytics — implemented in source

The original `jeepney_segment_stats` table remains canonical/default-route compatibility data.

New table:

`jeepney_variant_segment_stats`

Identity:

```text
route_variant_id + segment_index + hour
```

Design:

- [x] Existing canonical traffic history seeds the default variant
- [x] Rollup projects each ping against its exact variant geometry
- [x] Pre-variant historical pings contribute only to the canonical/default direction
- [x] Outbound and inbound segment indexes never share one bucket
- [x] Canonical `jeepney_segment_stats` continues feeding older/current route map behavior
- [x] Rider ETA reads `jeepney_variant_segment_stats`
- [x] Verification checks route/variant consistency

Rollup:

`src/lib/jeepney-analytics.server.ts`

Migration:

`supabase/migrations/20260817231900_jeepney_variant_segment_stats.sql`

---

## 9. Phone GPS — implemented in source

`src/components/jeepney-live-toggle.tsx`

- [x] Select/create the physical fleet unit before tracking
- [x] Phone position carries real `vehicle_id`
- [x] Position carries `trip_id`, `route_id` and `route_variant_id`
- [x] Phone-created shift records `assignment_source = phone`
- [x] Reopened phone-owned shift remains endable by the phone
- [x] Phone may join dispatcher-owned trip without owning it
- [x] Stopping phone GPS does not terminate dispatcher/hardware trip

Phone GPS remains the low-cost fallback and pilot onboarding path.

---

## 10. Direct Barangay Buddy GPS hardware — implemented in source

Foundation migration:

`supabase/migrations/20260817215000_jeepney_hardware_foundation.sql`

Tables:

- `jeepney_gps_devices`
- `jeepney_device_assignments`
- `jeepney_device_ingest_receipts`

Device model includes:

- operator ownership;
- public device ID;
- IMEI / ICCID;
- manufacturer/model/firmware;
- hashed device credential;
- lifecycle state;
- last-seen / position / speed / heading / accuracy;
- ignition;
- external voltage;
- backup battery;
- signal strength;
- event type;
- private metadata.

### APIs

`POST /api/telematics/v1/provision`

- admin-only provisioning;
- generates 256-bit random secret;
- persists only SHA-256 hash;
- original secret returned once;
- optional immediate installation on an operator-owned vehicle.

`POST /api/telematics/v1/ingest`

- tracker ID + tracker secret authentication;
- timestamp / coordinate validation;
- lifecycle enforcement;
- device installation resolution;
- active-trip route/direction resolution;
- normalized public position;
- private receipt / device health.

`GET/PATCH /api/telematics/v1/devices`

- health view;
- suspend/reactivate/retire;
- rotate secret;
- assign/reassign/unassign installation.

**Remaining direct-hardware hardening:** make position + receipt + sequence finalization fully transactional, matching the external gateway v2 pattern, and add rate/replay-window controls before large-scale deployment.

---

## 11. External cooperative/vendor/OEM gateways — implemented in source

The platform can ingest an existing GPS provider without replacing its hardware.

Tables:

- `jeepney_telematics_gateways`
- `jeepney_external_vehicle_mappings`
- `jeepney_gateway_ingest_receipts`

Admin UI:

`/jeepney/admin/gateways`

Supported vendor ingest:

`POST /api/telematics/v1/gateway-ingest-v2`

The older non-atomic gateway endpoint has been deleted.

Gateway security/identity:

- [x] One-time gateway credential; hash persisted
- [x] External vehicle ID maps to a physical Barangay Buddy vehicle
- [x] Operator-scoped gateways cannot cross-map fleets
- [x] Unsafe remapping is blocked while active trips exist
- [x] Vendor cannot supply/override the current route
- [x] Active trip determines route + direction
- [x] Replay key = gateway + external vehicle ID + sequence
- [x] PostgreSQL atomically reserves sequence + inserts rider position + audit receipt
- [x] Database transaction independently revalidates gateway → mapping → vehicle → trip → route → variant
- [x] Suspend/reactivate/retire/rotate lifecycle

Integration contract:

`JEEPNEY_TELEMATICS_GATEWAY.md`

Smoke client:

`scripts/jeepney-gateway-smoke.mjs`

---

## 12. Fleet operations — implemented in source

Authenticated operator route:

`/jeepney/operator/fleet`

Current operational board:

- physical fleet inventory;
- active vs idle units;
- route and exact direction;
- trip source and trip age;
- GPS live/delayed/offline state;
- tracker presence/health;
- vehicle speed;
- off-route distance against exact variant geometry;
- same-direction spacing/bunching warning.

Current off-route and bunching thresholds are pilot defaults and should become cooperative-configurable from field data.

---

## 13. Route publication security — implemented in source

Operator-created routes cannot self-publish through normal RLS ownership.

Permitted operator workflow:

```text
draft -> pending
pending -> draft
published -> suspended
suspended -> published
```

Other publication transitions require admin/server authority. Suspended route data remains publicly readable so riders retain a service/outage page.

Migration:

`20260817222500_jeepney_route_status_security.sql`

---

## 14. Database migration sequence

Current Jeepney extension sequence for this branch:

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

Apply only in timestamp order after confirming the intended database and recovery path.

---

## 15. Verification and deployment runbooks

Read-only verification:

- `supabase/verification/jeepney_phase3_phase4_checks.sql`
- `supabase/verification/jeepney_gateway_checks.sql`

Operational runbooks:

- `JEEPNEY_DEPLOYMENT_CHECKLIST.md`
- `JEEPNEY_PREMERGE_GATES.md`

The verification suites cover fleet ownership, duplicate open trips, canonical direction identity, route/variant consistency, tracker assignment, telemetry/trip identity, variant congestion integrity, external gateway mapping and replay receipts.

---

## 16. Current CI / merge state

Workflow:

`.github/workflows/jeepney-ci.yml`

Required validation:

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm run build
```

Current state as verified on 2026-08-18:

- PR #3 is open and unmerged;
- GitHub reports the branch as mergeable;
- fresh Jeepney CI jobs still contain zero execution steps;
- GitHub annotation states the account is locked due to a billing issue;
- the runner does not reach checkout;
- therefore there is still no actual lint/build result.

`src/routeTree.gen.ts` is generated code and must **not** be hand-edited. A real successful build must regenerate/validate the new file routes.

**Do not production-merge until CI executes successfully or an equivalent local frozen install + lint + build succeeds.**

---

## 17. Current Supabase deployment state

Connected Supabase access was re-checked on 2026-08-18.

The connected account lists one unrelated project (`SWGOH Command Center`). The previously identified Barangay Buddy project reference is not visible in the connected project list, and a direct lookup returns:

```text
You do not have permission to perform this action
```

Therefore:

- [x] migrations committed to GitHub;
- [x] verification/runbook files committed;
- [ ] intended Barangay Buddy Supabase project accessible through the connector;
- [ ] migrations applied through this session;
- [ ] verification SQL executed against the target database.

No migration has been redirected to the unrelated visible project and no production database mutation was attempted after permission denial.

---

## 18. Hardware sourcing

Primary candidates:

1. **TOPFLYtech** — OEM/ODM candidate
2. **Jimi IoT / Concox** — OEM/ODM candidate
3. **Teltonika** — premium/reference integration
4. **Queclink** — premium/reference integration

Preferred primary hardware: concealed hardwired **4G GNSS**, not OBD-II as the default.

RFQ quantities:

- 5–25 engineering/sample units;
- 100-unit pilot;
- 1,000-unit production pricing;
- Barangay Buddy logo/casing/packaging MOQ.

Required capabilities:

- Philippine-compatible LTE;
- direct server domain/IP + port configuration;
- raw protocol documentation;
- TCP/UDP and preferably MQTT/TLS;
- configurable 10–15 sec moving reports;
- offline buffering/resend;
- ignition/ACC;
- power-disconnect/tamper alert;
- backup battery;
- IMEI/ICCID/firmware reporting;
- OTA/configuration capability;
- documented Philippine/NTC status;
- support documentation for LTFRB testing/accreditation.

**Do not order production inventory until server control, protocol access, Philippine radio compliance and exact LTFRB/provider status are verified.**

---

## 19. Regulatory workstream

Primary agencies/stakeholders:

1. DOTr
2. LTFRB
3. LTO
4. NTC
5. LGUs/local transport offices
6. Transport cooperatives/corporations

Maintain a current compliance matrix including:

- LTFRB MC 2015-013 GPS provider/device requirements;
- current modern-PUV technical issuances;
- current service-contracting rules;
- NTC type approval/type acceptance/equipment conformity;
- Republic Act No. 10173 (Data Privacy Act).

Never market a tracker as **LTFRB approved/compliant/accredited** without documentary evidence for the exact provider/device/SKU status.

Government positioning:

> Barangay Buddy is an open, standards-based public-transport mobility platform that can ingest existing approved/accredited hardware as well as Barangay Buddy supplied hardware; it is not dependent on government mandating one proprietary tracker.

---

## 20. Commercial model

### Rider

Free.

### Operator / cooperative

Potential revenue:

- free/basic phone tracking;
- per-active-vehicle fleet subscription;
- cooperative fleet plan;
- tracker sale or lease;
- installation;
- managed SIM/connectivity;
- premium analytics;
- API/integration plan;
- LGU/government deployment/support contract.

The existing `₱100/month per route` can remain as an MVP/pilot artifact but should not define long-term telematics pricing. Operational value and infrastructure cost scale primarily by active fleet vehicles/integrations.

---

## 21. Remaining engineering queue

### P0 — validation / direct hardware reliability

1. Clear GitHub Actions billing lock or run equivalent local frozen install + lint + build.
2. Restore authorized access to the intended Barangay Buddy Supabase project.
3. Apply migrations in order and run both verification suites.
4. Make direct `/api/telematics/v1/ingest` sequence + position + receipt finalization transactional.
5. Add direct device/gateway rate limits and replay-window controls appropriate for expected 10–15 second telemetry.

### P1 — pilot operations

6. Run real outbound/inbound direction and stop-subset smoke tests.
7. Run variant congestion rollup and compare actual ETA with road travel.
8. Test cellular loss, offline buffering, reconnect and duplicate replay.
9. Make fleet off-route/headway thresholds cooperative-configurable.
10. Add operational alerting for stale/offline hardware and ingest failures.

### P2 — ecosystem

11. Build first real vendor adapter after receiving protocol/API docs (TOPFLYtech or Jimi/cooperative feed).
12. Add scoped partner/API clients.
13. Add GTFS static + GTFS-Realtime VehiclePositions/TripUpdates.
14. Add government/LGU read-only service-coverage/headway dashboard.
15. Add audit/export/report package for cooperative/regulatory pilot discussions.

---

## 22. Pilot success criteria

For an initial 5–25 vehicle deployment:

- >99% accepted telemetry while cellular service is available;
- offline buffer/resend demonstrated;
- multiple active vehicles visible independently;
- real physical unit identity shown to rider/dispatcher;
- secure tracker/vendor-to-vehicle identity;
- accurate trip + route + direction association;
- inbound/outbound stop subsets verified;
- stale/offline detection verified;
- outbound/inbound congestion history kept separate;
- useful ETA ranges compared with actual travel;
- cooperative live fleet visibility;
- direct tracker and external gateway replay protection verified;
- exact NTC/LTFRB hardware/provider status documented;
- privacy/data-retention controls documented.

That evidence package becomes the basis for a larger cooperative rollout and controlled LGU/LTFRB/government discussion.
