# Barangay Buddy Jeepney Mobility Platform

**Status:** Source architecture implemented through telemetry reliability; production validation/deployment still blocked  
**Working branch:** `feature/jeepney-planner-live-route-ui`  
**Open PR:** #3 → `main`  
**Last updated:** 2026-08-18

---

## 1. Product goal

Build Barangay Buddy into a **device-agnostic Philippine public-transport mobility platform** combining:

- free commuter route discovery;
- multiple live jeepneys per route;
- exact outbound/inbound/custom travel directions;
- direction-aware pickup ETA;
- stops, fares, schedules and service alerts;
- driver-phone GPS fallback;
- Barangay Buddy hardwired GPS hardware;
- existing cooperative/vendor/OEM GPS integration;
- cooperative fleet dispatch and live operations;
- controlled partner/LGU/government dashboards and APIs;
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

A physical jeepney does **not** permanently equal one route. `jeepney_vehicles.route_id` is legacy/home-route compatibility metadata only. The open trip is authoritative for current service.

External GPS systems also do not choose the public route. Their upstream vehicle identity maps to the physical Barangay Buddy vehicle; Fleet Dispatch determines the active trip, route and direction.

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
  - distributed authenticated burst control
  - sequence / replay idempotency
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

- [x] Latest position retained independently per physical vehicle
- [x] Realtime/polling merge by vehicle rather than route
- [x] Multiple simultaneous markers on `/jeepney` and `/jeepney/$slug`
- [x] Live vehicle counts by route
- [x] Five-minute stale pruning
- [x] Real fleet/body labels where available

Primary code:

- `src/lib/jeepney-live.ts`
- `src/components/jeepney-map.tsx`
- `src/routes/jeepney.index.tsx`
- `src/routes/jeepney.$slug.tsx`

---

## 5. Fleet ownership and dispatch — implemented in source

- [x] `jeepney_vehicles.operator_id` is authoritative fleet ownership
- [x] Legacy `route_id` is nullable/home-route metadata
- [x] Route deletion cannot cascade-delete the physical vehicle
- [x] One open trip maximum per physical vehicle
- [x] Trip operator/vehicle/route ownership guarded in PostgreSQL
- [x] Existing trip identity cannot be reassigned underneath live telemetry
- [x] Fleet Dispatch adds units and starts/ends exact route-direction trips
- [x] Same physical vehicle can switch routes/directions trip-to-trip
- [x] Route claim approval creates operator-owned fleet inventory

Operator component: `src/components/jeepney-fleet-dispatch.tsx`

---

## 6. Route variants / directions — implemented in source

Supported operational geometries:

- outbound;
- inbound / return;
- loop;
- custom direction.

Database:

- `jeepney_route_variants`
- `jeepney_route_variant_stops`

Behavior:

- [x] Every legacy route receives a canonical/default outbound variant
- [x] Canonical route path stays synchronized with the default variant
- [x] Default identity cannot be disabled/re-coded/re-purposed
- [x] `route_variant_id` stamped on trips and normalized telemetry
- [x] Active direction geometry cannot change/deactivate/delete while an open trip depends on it
- [x] Operator can create an inactive return-direction draft
- [x] Reversed outbound path is only an explicit starter, never assumed correct
- [x] Return route can be manually corrected or GPS-recorded
- [x] Direction requires explicit activation before dispatch
- [x] Variant-specific stop membership/order supported

---

## 7. Direction-aware ETA and stops — implemented in source

- [x] `/jeepney/$slug` uses `JeepneyArrivalSummary`
- [x] Old route-wide outbound `bestEta` removed
- [x] Detailed live-unit cards use exact direction geometry
- [x] GPS progress projects onto the nearest point of a polyline segment
- [x] Passed stops are excluded from approaching ETA
- [x] `jeepney_route_variant_stops` controls eligible stop subset/order when configured
- [x] Legacy/unconfigured direction uses geometric stop-order fallback
- [x] Outbound-only stops can be excluded from inbound ETA
- [x] Direction-specific traffic history is consumed when available
- [x] Missing exact-direction history safely falls back to live/default speed

Core:

- `src/lib/jeepney-variants.ts`
- `src/components/jeepney-arrival-summary.tsx`
- `src/components/jeepney-live-vehicle-list.tsx`

---

## 8. Direction-specific congestion analytics — implemented in source

The existing `jeepney_segment_stats` table remains canonical/default-route compatibility data.

New table:

`jeepney_variant_segment_stats`

Identity:

```text
route_variant_id + segment_index + hour
```

- [x] Existing canonical traffic history seeds the default variant
- [x] Rollup projects each ping against its exact variant geometry
- [x] Pre-variant pings contribute only to canonical/default direction
- [x] Outbound/inbound/custom segment indexes never share one bucket
- [x] Canonical table continues feeding existing route-map behavior
- [x] Rider ETA reads exact-direction speed history
- [x] Verification checks route/variant consistency

Rollup: `src/lib/jeepney-analytics.server.ts`  
Migration: `20260817231900_jeepney_variant_segment_stats.sql`

---

## 9. Phone GPS — implemented in source

`src/components/jeepney-live-toggle.tsx`

- [x] Select/create physical fleet unit before tracking
- [x] Position carries real `vehicle_id`, `trip_id`, `route_id`, `route_variant_id`
- [x] Phone-created shift records `assignment_source = phone`
- [x] Reopened phone-owned shift remains endable by phone
- [x] Phone may join dispatcher-owned trip without owning it
- [x] Stopping phone GPS does not terminate dispatcher/hardware trip

Phone GPS remains the low-cost fallback and pilot onboarding path.

---

## 10. Direct Barangay Buddy GPS hardware — implemented in source

Core tables:

- `jeepney_gps_devices`
- `jeepney_device_assignments`
- `jeepney_device_ingest_receipts`

APIs:

- `POST /api/telematics/v1/provision`
- `POST /api/telematics/v1/ingest`
- `GET/PATCH /api/telematics/v1/devices`

Security/reliability:

- [x] One-time 256-bit device secret; only SHA-256 hash persists
- [x] Device lifecycle and active installation validation
- [x] Active trip determines route + direction
- [x] `jeepney_commit_device_telemetry(...)` revalidates tracker → installation → vehicle → open trip → route → variant inside PostgreSQL
- [x] Sequence reservation + rider position + private receipt commit atomically
- [x] Concurrent sequence replay returns original immutable position/trip/direction identity
- [x] Incomplete historical receipts fail closed
- [x] Sequence-less compatibility reports remain atomic but are not considered replay-deduplicated
- [x] `scripts/jeepney-hardware-smoke.mjs` verifies replay behavior
- [x] Direct-device verification detects incomplete or identity-drifting receipts

Pilot/production hardware should always supply a stable sequence key.

---

## 11. External cooperative/vendor/OEM gateways — implemented in source

Tables:

- `jeepney_telematics_gateways`
- `jeepney_external_vehicle_mappings`
- `jeepney_gateway_ingest_receipts`

Admin UI: `/jeepney/admin/gateways`

Supported vendor ingest:

`POST /api/telematics/v1/gateway-ingest-v2`

The older non-atomic gateway endpoint has been deleted.

- [x] One-time gateway credential; hash persisted
- [x] External vehicle ID maps to a physical Barangay Buddy vehicle
- [x] Operator-scoped gateways cannot cross-map fleets
- [x] Unsafe remapping blocked while active trips exist
- [x] Vendor cannot override current route/direction
- [x] Replay key = gateway + external vehicle ID + sequence
- [x] PostgreSQL atomically reserves sequence + inserts rider position + audit receipt
- [x] Database transaction revalidates gateway → mapping → vehicle → trip → route → variant
- [x] Incomplete historical receipts fail closed
- [x] Suspend/reactivate/retire/rotate lifecycle

Contract: `JEEPNEY_TELEMATICS_GATEWAY.md`  
Smoke client: `scripts/jeepney-gateway-smoke.mjs`

---

## 12. Authenticated telemetry burst protection — implemented in source

Migration: `20260817232100_jeepney_telematics_rate_limit.sql`

Shared server helper: `src/lib/jeepney-telematics-rate.server.ts`

Default policy:

```text
300 authenticated requests / minute / physical source
```

This is about 5 requests/sec—far above normal 10–15 second reporting—to permit buffered reconnect bursts while containing runaway firmware or an adapter loop.

- [x] Fixed-minute counters live in PostgreSQL and are shared across app instances
- [x] Direct tracker key: `device:<device UUID>`
- [x] Gateway vehicle key: `gateway:<gateway UUID>:<mapped external vehicle ID>`
- [x] Rate slot is consumed only after valid credentials
- [x] Gateway per-vehicle bucket is created only after a valid mapping resolves
- [x] Duplicate/replay requests count against the ceiling
- [x] Over-limit response is HTTP 429 + `Retry-After`
- [x] Old windows are opportunistically cleaned without a scheduler

Pilot buffered-reconnect tests must validate whether 300/minute is appropriate for the selected hardware/provider; the limit is intentionally configurable in code/RPC rather than embedded in a tracker protocol.

---

## 13. Fleet operations — implemented in source

Authenticated route: `/jeepney/operator/fleet`

Current board:

- physical fleet inventory;
- active vs idle units;
- route and exact direction;
- trip source and age;
- GPS live/delayed/offline state;
- tracker presence/health;
- speed;
- off-route distance against exact variant geometry;
- same-direction spacing/bunching warning.

Current thresholds are pilot defaults and should become cooperative-configurable from field data.

---

## 14. Route publication security — implemented in source

Operator-created routes cannot self-publish through normal ownership/RLS.

Permitted operator workflow:

```text
draft -> pending
pending -> draft
published -> suspended
suspended -> published
```

Other publication transitions require admin/server authority.

---

## 15. Current migration sequence

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
18. `20260817232000_jeepney_device_atomic_ingest.sql`
19. `20260817232100_jeepney_telematics_rate_limit.sql`

Apply only in timestamp order after confirming the intended database and recovery path.

---

## 16. Verification and runbooks

Read-only verification:

- `supabase/verification/jeepney_phase3_phase4_checks.sql`
- `supabase/verification/jeepney_gateway_checks.sql`

Operational runbooks:

- `JEEPNEY_DEPLOYMENT_CHECKLIST.md`
- `JEEPNEY_PREMERGE_GATES.md`

---

## 17. Current CI / merge state

Workflow: `.github/workflows/jeepney-ci.yml`

Required validation:

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm run build
```

As last verified on 2026-08-18:

- PR #3 is open and unmerged;
- GitHub reports it mergeable;
- fresh Jeepney CI jobs still had zero execution steps;
- GitHub annotation stated the account is locked due to a billing issue;
- runner did not reach checkout;
- therefore there is still no actual lint/build result.

`src/routeTree.gen.ts` is generated code and must **not** be hand-edited. A successful real build must regenerate/validate new file routes.

**Do not production-merge until CI executes successfully or an equivalent local frozen install + lint + build succeeds.**

---

## 18. Current Supabase deployment state

Connected Supabase access was rechecked on 2026-08-18.

The connected account exposes one unrelated project (`SWGOH Command Center`). The intended Barangay Buddy project reference is not visible, and direct lookup returns:

```text
You do not have permission to perform this action
```

Therefore:

- [x] migrations committed to GitHub;
- [x] verification/runbooks committed;
- [ ] intended Barangay Buddy Supabase project accessible through connector;
- [ ] migrations applied through this session;
- [ ] verification SQL executed against target database.

No migration was redirected to the unrelated visible project.

---

## 19. Hardware sourcing

Primary candidates:

1. **TOPFLYtech** — OEM/ODM candidate
2. **Jimi IoT / Concox** — OEM/ODM candidate
3. **Teltonika** — premium/reference integration
4. **Queclink** — premium/reference integration

Preferred primary hardware: concealed hardwired **4G GNSS**, not OBD-II as default.

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
- stable sequence/message identity;
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

## 20. Regulatory workstream

Primary agencies/stakeholders:

1. DOTr
2. LTFRB
3. LTO
4. NTC
5. LGUs/local transport offices
6. Transport cooperatives/corporations

Maintain a current compliance matrix including LTFRB GPS-provider/device requirements, current modern-PUV technical issuances, current service-contracting rules, NTC approval/conformity requirements, and the Data Privacy Act.

Never market a tracker as **LTFRB approved/compliant/accredited** without documentary evidence for the exact provider/device/SKU status.

Government positioning:

> Barangay Buddy is an open, standards-based public-transport mobility platform that can ingest existing approved/accredited hardware as well as Barangay Buddy supplied hardware; it is not dependent on government mandating one proprietary tracker.

---

## 21. Commercial model

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

The existing `₱100/month per route` may remain as an MVP/pilot artifact but should not define long-term telematics pricing. Infrastructure value/cost scale primarily by active vehicles and integrations.

---

## 22. Remaining engineering queue

### P0 — external validation/deployment

1. Clear GitHub Actions billing lock or run equivalent local frozen install + lint + build.
2. Restore authorized access to the intended Barangay Buddy Supabase project.
3. Apply migrations in order and run both verification suites.
4. Run direct-device, gateway and rate-limit smoke tests in the deployed test environment.

### P1 — pilot operations

5. Run real outbound/inbound direction and stop-subset tests.
6. Run variant congestion rollup and compare ETA with actual road travel.
7. Test cellular loss, offline buffering, reconnect and duplicate replay.
8. Validate/tune the 300/min buffered-replay ceiling using real device behavior.
9. Make fleet off-route/headway thresholds cooperative-configurable.
10. Add production operational alerting for stale/offline hardware, ingest failures and rate-limit events.

### P2 — ecosystem

11. Build first real vendor protocol adapter after receiving TOPFLYtech/Jimi/cooperative docs.
12. Add scoped partner/API clients.
13. Add GTFS static + GTFS-Realtime VehiclePositions/TripUpdates.
14. Add government/LGU read-only service-coverage/headway dashboard.
15. Add audit/export/report package for cooperative/regulatory pilots.

---

## 23. Pilot success criteria

For an initial 5–25 vehicle deployment:

- >99% accepted telemetry while cellular service is available;
- offline buffer/resend demonstrated;
- multiple active vehicles visible independently;
- secure physical unit/tracker/vendor identity;
- accurate trip + route + direction association;
- direct and gateway replay idempotency demonstrated;
- normal and buffered traffic remain below/tolerate configured rate ceiling;
- inbound/outbound stop subsets verified;
- stale/offline detection verified;
- outbound/inbound congestion history kept separate;
- ETA compared with actual travel;
- cooperative live fleet visibility;
- exact NTC/LTFRB hardware/provider status documented;
- privacy/data-retention controls documented.

That evidence package becomes the basis for a larger cooperative rollout and controlled LGU/LTFRB/government discussion.
