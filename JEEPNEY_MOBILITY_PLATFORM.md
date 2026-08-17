# Barangay Buddy Jeepney Mobility Platform

**Status:** Active build — multi-vehicle rider tracking + hardware foundation implemented in code  
**Working branch:** `feature/jeepney-planner-live-route-ui`  
**Open PR:** #3 → `main`  
**Last updated:** 2026-08-17

---

## 1. Product goal

Build Barangay Buddy into a **device-agnostic Philippine public-transport telemetry platform** combining:

- free commuter route discovery and live jeepney tracking;
- multiple simultaneous vehicles per route;
- pickup ETAs, stops, service hours and alerts;
- driver-phone GPS fallback;
- Barangay Buddy branded hardwired GPS hardware;
- existing cooperative/vendor GPS integrations;
- operator/cooperative fleet management;
- controlled LGU/LTFRB/partner dashboards and APIs;
- route/trip/device/vehicle audit history;
- future GTFS / GTFS-Realtime output.

> **Platform principle:** Hardware is replaceable. Barangay Buddy should own the normalized transport-data layer, rider experience, operational history, fleet software and integrations.

---

## 2. Current code status

### Existing foundation

- [x] Public `/jeepney` route directory and map
- [x] `/jeepney/$slug` route detail
- [x] Route and stop management
- [x] Operator accounts
- [x] Vehicle table
- [x] GPS position history
- [x] Supabase Realtime position feed
- [x] Driver-phone GPS broadcasting (~15 sec)
- [x] Trips and trip analytics
- [x] Segment speed / congestion analytics
- [x] Breakdown and repaired alerts
- [x] Rider route follows
- [x] Route claims/admin review
- [x] OpenStreetMap route import

### Multi-vehicle rider tracking — implemented

- [x] Replaced route-keyed live state with stable broadcaster/vehicle-keyed live state
- [x] Preserve latest live GPS report independently for each `vehicle_id`
- [x] Keep one compatibility stream per route for legacy phone reports without `vehicle_id`
- [x] Render every current vehicle marker on overview map
- [x] Render every current vehicle marker on route-detail map
- [x] Route cards show number of live GPS units
- [x] Route detail shows number of live units
- [x] Independent per-unit speed and last-seen display
- [x] Five-minute stale rule remains enforced
- [x] Realtime INSERT updates merge into the correct vehicle stream
- [x] Polling fallback rebuilds latest position per vehicle
- [x] Route detail ranks approaching vehicles by ETA
- [x] Rider geolocation ranks vehicles against the nearest mapped stop

Implementation files:

- `src/lib/jeepney-live.ts`
- `src/components/jeepney-map.tsx`
- `src/components/jeepney-live-vehicle-list.tsx`
- `src/routes/jeepney.index.tsx`
- `src/routes/jeepney.$slug.tsx`

### Multi-vehicle limitations still to solve

- [ ] Use actual fleet body/unit label rather than shortened vehicle UUID in public UI
- [ ] Detect outbound vs inbound/return direction
- [ ] Add route variants/directions
- [ ] Improve path projection beyond nearest route node
- [ ] Model stop dwell time
- [ ] Add headway/bunching to ETA confidence
- [ ] Add automated rider smoke tests with several vehicles on one route

---

## 3. Telemetry architecture

```text
GPS SOURCES
  |
  +-- Driver phone / PWA
  +-- Barangay Buddy 4G GNSS tracker
  +-- Cooperative vendor API/webhook
  +-- TOPFLYtech
  +-- Jimi / Concox
  +-- Teltonika
  +-- Queclink
  +-- OEM telematics
  |
  v
BARANGAY BUDDY TELEMETRY GATEWAY
  - device authentication
  - protocol decoding/adapters
  - timestamp + coordinate validation
  - duplicate/replay controls
  - device health
  - normalization
  |
  v
TRANSPORT CORE
  operator/cooperative
       |
     vehicle ---- installed device
       |
      trip
       |
  route / route variant
       |
  positions + ETA + analytics
  |
  +----------+-----------+------------+
  |          |           |            |
 Rider    Operator   Cooperative   Partner/LGU
```

---

## 4. Hardware foundation — implemented

Migration:

- `supabase/migrations/20260817215000_jeepney_hardware_foundation.sql`

Tables:

- [x] `jeepney_gps_devices`
- [x] `jeepney_device_assignments`
- [x] `jeepney_device_ingest_receipts`

Device record supports:

- operator ownership;
- public device ID;
- IMEI;
- manufacturer/model;
- firmware version;
- hashed device credential;
- SIM ICCID;
- lifecycle status;
- last seen;
- coordinates/speed/heading/accuracy;
- ignition;
- external voltage;
- backup battery percentage;
- signal strength;
- latest event type;
- private metadata.

Public `jeepney_positions` does **not** expose raw tracker credentials or detailed hardware identity. Restricted ingest receipts map accepted positions to physical devices for audit purposes.

---

## 5. Hardware APIs — implemented

### `POST /api/telematics/v1/provision`

Admin-only provisioning flow:

1. Authenticate user.
2. Require admin role.
3. Generate 256-bit random device secret.
4. Store only SHA-256 hash.
5. Return original secret once.
6. Optionally install device onto a vehicle.

### `POST /api/telematics/v1/ingest`

Tracker flow:

1. Send `x-bb-device-id`.
2. Send `x-bb-device-secret`.
3. Validate hashed credential server-side.
4. Validate telemetry payload/timestamp.
5. Reject suspended/retired tracker.
6. Resolve current device-to-vehicle installation.
7. Prefer active trip for route association.
8. Temporarily fall back to legacy `jeepney_vehicles.route_id`.
9. Write `source = hardware` to `jeepney_positions`.
10. Update device health.
11. Store restricted ingest receipt.

Trackers never receive Supabase service-role credentials.

### Production hardening still required

- [ ] HMAC/signed requests where supported
- [ ] transactional replay/dedup protection
- [ ] secret rotation
- [ ] per-device rate limiting
- [ ] device revoke/suspend UI
- [ ] provisioning audit UI
- [ ] anomaly detection

---

## 6. Permanent data model target

Permanent fleet identity:

```text
cooperative/operator -> vehicle -> installed device
```

Operational assignment:

```text
vehicle -> trip -> route_variant
```

A vehicle must **not** permanently equal one route. `jeepney_vehicles.route_id` remains only as temporary compatibility while trip-based assignment becomes authoritative.

Future tables/features:

- [ ] route variants/directions
- [ ] cooperative organization model
- [ ] dedicated SIM lifecycle if needed
- [ ] installation photos / tamper seal records
- [ ] partner integrations
- [ ] scoped API clients

---

## 7. ETA roadmap

Current ETA uses route progress + speed and available segment-speed history.

Upgrade order:

1. [x] Multiple active vehicles retained independently
2. [x] Per-vehicle ETA to next/nearest mapped stop
3. [ ] Proper perpendicular projection onto route geometry
4. [ ] Direction / route-variant detection
5. [ ] Trip progress state
6. [ ] Stop dwell-time model
7. [ ] Fleet headway/bunching
8. [ ] ETA confidence interval and stale-data confidence

---

## 8. Fleet/cooperative dashboard target

Show:

- all active vehicles on map;
- active trip/route/direction;
- last GPS age;
- ignition;
- moving/stopped/offline;
- speed;
- route deviation;
- headway and bunching;
- tracker health;
- SIM/connectivity status;
- breakdowns;
- kilometers/day;
- trips completed;
- service hours;
- exports/API.

---

## 9. Government / partner view

Read-only and scope-controlled by agreement/jurisdiction:

- active units by route;
- route adherence;
- service coverage;
- headways;
- trip completion;
- offline devices;
- fleet availability;
- aggregate congestion;
- breakdown/service alerts;
- audit/export tooling;
- controlled API access.

Do not expose unnecessary driver personal data on the public rider map.

---

## 10. Hardware sourcing

Primary sample candidates:

1. **TOPFLYtech** — OEM/ODM candidate
2. **Jimi IoT / Concox** — OEM/ODM candidate
3. **Teltonika** — premium/reference integration
4. **Queclink** — premium/reference integration

Preferred primary hardware is concealed hardwired **4G GNSS**, not OBD-II as the default.

RFQ quantities:

- 5–25 engineering/sample units;
- 100-unit pilot;
- 1,000-unit production pricing;
- Barangay Buddy logo/casing/packaging MOQ.

Required vendor capabilities:

- Philippine-compatible LTE;
- direct IP/domain + port configuration;
- raw device protocol documentation;
- TCP/UDP and preferably MQTT/TLS;
- configurable 10–15 sec moving reports;
- offline buffering/resend;
- ignition/ACC;
- power-disconnect alert;
- backup battery;
- IMEI/ICCID/firmware reporting;
- OTA/configuration capability;
- documented Philippine/NTC status;
- support documents for LTFRB testing/accreditation.

**Do not order production inventory until server control, protocol access, Philippine radio compliance and exact LTFRB status are verified.**

---

## 11. Regulatory workstream

Primary agencies:

1. DOTr
2. LTFRB
3. LTO
4. NTC
5. LGUs/local transport offices
6. Cooperatives/corporations

Maintain a compliance matrix against current requirements, including:

- LTFRB MC 2015-013 GPS provider/device requirements;
- current modern-PUV technical issuances;
- current DOTr/LTFRB service-contracting rules;
- NTC type approval/type acceptance/equipment conformity;
- Republic Act No. 10173 (Data Privacy Act).

Never market a device as **LTFRB approved/compliant/accredited** without documentary evidence for the exact provider/device status.

Government positioning:

> Barangay Buddy should be presented as an open, standards-based public-transport mobility platform that can ingest existing accredited hardware as well as Barangay Buddy supplied hardware—not as a request for government to mandate one proprietary tracker.

---

## 12. Commercial model

### Rider

Free.

### Operator/cooperative revenue

- free/basic phone tracking;
- per-active-vehicle fleet subscription;
- cooperative fleet plan;
- tracker sale or lease;
- installation;
- managed SIM/connectivity;
- premium analytics;
- API/integration plans;
- LGU/government deployment/support contracts.

Current `₱100/month per route` can remain for MVP/pilot but should not define long-term telematics pricing.

---

## 13. Build phases

### Phase 0 — Branch stabilization

- [ ] Resolve PR #3 mergeability/conflicts with `main`
- [ ] Run build/lint after conflict resolution
- [ ] Verify all migrations in target Supabase project
- [ ] Verify production deployment branch
- [ ] Add smoke tests

### Phase 1 — Multi-vehicle rider tracking

- [x] Vehicle-keyed live state
- [x] Multiple map markers per route
- [x] Overview live vehicle counts
- [x] Route-detail live vehicle counts
- [x] Independent speed/last-seen
- [x] Stale pruning
- [x] Realtime merge by vehicle
- [x] Polling latest-per-vehicle
- [x] Approaching vehicle list
- [x] Nearest-stop ETA ranking
- [ ] Actual body/unit number lookup
- [ ] Direction/return-route support
- [ ] Automated multi-vehicle tests

### Phase 2 — Hardware foundation

- [x] Hardware architecture
- [x] GPS device schema
- [x] Device assignment schema
- [x] Restricted ingest receipts
- [x] Secure JSON ingest endpoint
- [x] Hashed device secrets
- [x] Device health updates
- [x] Admin provisioning endpoint
- [x] Preserve phone tracker fallback
- [ ] Admin/operator provisioning UI
- [ ] Device health UI
- [ ] Secret rotation/revoke
- [ ] Transactional dedup/rate limiting

### Phase 3 — Vehicle / route decoupling

- [ ] Permanent vehicle fleet identity
- [ ] Active trip authoritative for route assignment everywhere
- [ ] Route variants/directions
- [ ] Hardware-compatible automatic trip lifecycle

### Phase 4 — Fleet control

- [ ] Cooperative organization/fleet model
- [ ] Dispatcher dashboard
- [ ] Device-health board
- [ ] Headway/bunching detection
- [ ] Route deviation
- [ ] Offline tracker alerts
- [ ] Shift/trip reports

### Phase 5 — Hardware/vendor adapters

- [ ] Generic cooperative JSON/webhook adapter
- [ ] TOPFLYtech
- [ ] Jimi/Concox
- [ ] Teltonika
- [ ] Queclink

### Phase 6 — Compliance + pilot

- [ ] Hardware RFQs
- [ ] Sample bench testing
- [ ] NTC exact-SKU review
- [ ] LTFRB compliance matrix
- [ ] Pilot cooperative agreement
- [ ] Install 5–25 units
- [ ] Measure uptime, accuracy, coverage and data usage

### Phase 7 — Open transit / government

- [ ] GTFS static
- [ ] GTFS-Realtime VehiclePositions
- [ ] GTFS-Realtime TripUpdates
- [ ] Partner API keys/scopes
- [ ] LTFRB/LGU read-only dashboard
- [ ] Audit/export tools

---

## 14. Immediate implementation queue

1. **Resolve PR #3 merge conflict/mergeability against `main`.**
2. **Apply/verify new hardware migration in the target Supabase project.**
3. Build admin/operator GPS provisioning + device-health UI.
4. Harden route publication/status authorization.
5. Move vehicle route assignment fully to active trips.
6. Add route direction/variants and proper geometry projection.
7. Add cooperative fleet dashboard/headway monitoring.
8. Obtain sample tracker protocol documentation and begin adapters.
9. Run 5–25 vehicle pilot.

---

## 15. Implementation log

### 2026-08-17 — Architecture/audit

- Audited Jeepney Planner branch.
- Identified one-marker-per-route limitation.
- Established device-agnostic telemetry architecture.
- Established regulatory/hardware sourcing workstreams.
- Created master build document.

### 2026-08-17 — Hardware foundation

- Added `20260817215000_jeepney_hardware_foundation.sql`.
- Added secure GPS device identities and vehicle installation assignments.
- Added restricted ingest receipts.
- Added `/api/telematics/v1/ingest`.
- Added `/api/telematics/v1/provision`.
- Added active-trip-first route resolution with temporary legacy fallback.

### 2026-08-17 — Multi-vehicle rider P0

- Added `src/lib/jeepney-live.ts`.
- Live state now retains latest position per vehicle instead of per route.
- Realtime updates merge by vehicle identity.
- Polling rebuilds latest positions independently.
- Overview map renders every active unit.
- Route detail renders every active unit.
- Route cards/detail report live fleet count.
- Added per-unit speed and last-seen UI.
- Added approaching-vehicle ETA list.
- Rider location selects nearest mapped stop and sorts approaching vehicles by ETA.
- Kept legacy phone broadcasts compatible when `vehicle_id` is missing.

### Validation state

- GitHub currently reports no CI status checks for the latest branch commit.
- PR #3 is currently reported as **open, unmerged and not mergeable** against `main`; conflict resolution/branch stabilization is therefore the next gate before production merge.
- Hardware migration and production deployment still require verification in the target environment.

---

## 16. Pilot success criteria

For a 5–25 vehicle pilot:

- >99% accepted telemetry while cellular service is available;
- offline buffer/resend demonstrated;
- all simultaneous active vehicles visible independently;
- secure tracker-to-vehicle identity;
- stale/offline detection;
- accurate route/trip/direction association;
- useful rider ETA ranges;
- cooperative fleet visibility;
- daily trip/service reports;
- exact NTC/LTFRB hardware status documented;
- privacy/data-retention controls documented.

That evidence package becomes the basis for larger cooperative, LGU and government discussions.
