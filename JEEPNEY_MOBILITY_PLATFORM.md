# Barangay Buddy Jeepney Mobility Platform

**Status:** Active build — multi-vehicle rider tracking, phone fleet identity, GPS hardware foundation and admin controls implemented in code  
**Working branch:** `feature/jeepney-planner-live-route-ui`  
**Open PR:** #3 → `main`  
**Last updated:** 2026-08-17

---

## 1. Product goal

Build Barangay Buddy into a **device-agnostic Philippine public-transport telemetry platform** combining:

- free commuter route discovery and live jeepney tracking;
- multiple simultaneous vehicles per route;
- pickup ETAs, stops, fares, schedules and service alerts;
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

### Existing product foundation

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
- [x] Fare lines
- [x] Day schedules
- [x] Rental support
- [x] Service calendar
- [x] Stop photos

### Multi-vehicle rider tracking — implemented

- [x] Live state retains one latest position per vehicle instead of one per route
- [x] Realtime INSERTs merge into the correct vehicle stream
- [x] Polling fallback rebuilds latest position per vehicle
- [x] Every active vehicle renders independently on overview and route-detail maps
- [x] Route cards/details report live vehicle count
- [x] Five-minute stale rule remains enforced
- [x] Live ETA list ranks approaching vehicles
- [x] Rider location selects nearest mapped stop for ETA ranking
- [x] Actual fleet unit/body labels resolve on map and live ETA list
- [x] UUID fragment remains only as fallback when no label can be resolved

Implementation:

- `src/lib/jeepney-live.ts`
- `src/components/jeepney-map.tsx`
- `src/components/jeepney-live-vehicle-list.tsx`
- `src/routes/jeepney.index.tsx`
- `src/routes/jeepney.$slug.tsx`

### Phone GPS fleet identity — implemented

`src/components/jeepney-live-toggle.tsx`

- [x] Operator selects the actual jeepney unit before going live
- [x] Operator can create a body/unit record if none exists
- [x] Optional plate number can be recorded
- [x] Vehicle identity is locked for the duration of the shift
- [x] `jeepney_trips.vehicle_id` is populated
- [x] Every phone GPS position includes `vehicle_id`
- [x] Multiple driver phones can therefore coexist on the same route without collapsing into a single route-level stream

Legacy `vehicle_id = null` reports remain readable as compatibility data, but new operator phone shifts should use a real fleet vehicle.

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

## 4. GPS hardware foundation — implemented

Migration:

`supabase/migrations/20260817215000_jeepney_hardware_foundation.sql`

Tables:

- [x] `jeepney_gps_devices`
- [x] `jeepney_device_assignments`
- [x] `jeepney_device_ingest_receipts`

Device data supports:

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

Public rider positions do **not** contain tracker secrets or detailed device authentication data.

---

## 5. Hardware APIs — implemented

### `POST /api/telematics/v1/provision`

Admin-only provisioning:

1. Authenticate user.
2. Require admin role.
3. Generate 256-bit random tracker secret.
4. Store only SHA-256 hash.
5. Return original secret once.
6. Optionally install tracker on a vehicle.

### `POST /api/telematics/v1/ingest`

Tracker ingest:

1. Authenticate `x-bb-device-id` + secret.
2. Validate telemetry payload and device timestamp.
3. Reject suspended/retired tracker.
4. Deduplicate by optional device sequence.
5. Resolve current tracker-to-vehicle installation.
6. Prefer active trip for route association.
7. Temporarily fall back to legacy `jeepney_vehicles.route_id`.
8. Write normalized `source = hardware` position.
9. Update tracker health.
10. Store restricted ingest receipt.

Trackers never receive Supabase service-role credentials.

### `GET /api/telematics/v1/devices`

Admin-only fleet-health API:

- [x] validates Supabase access token;
- [x] requires `user_roles.role = admin`;
- [x] reads sensitive device health only server-side;
- [x] returns device/assignment/operator/vehicle/route data needed by the admin console;
- [x] does not relax public RLS on hardware tables.

---

## 6. GPS admin console — implemented

`src/components/jeepney-gps-admin.tsx`  
Integrated into `src/routes/jeepney.admin.tsx`.

Admins can:

- [x] provision a tracker;
- [x] assign it to an operator/cooperative;
- [x] optionally install it to a vehicle immediately;
- [x] enter IMEI, ICCID, manufacturer, model and firmware;
- [x] receive/copy the one-time device secret;
- [x] see total/online/delayed/offline tracker counts;
- [x] view last-seen time;
- [x] view speed;
- [x] view ignition state;
- [x] view external voltage;
- [x] view backup battery;
- [x] view cellular signal;
- [x] view GPS accuracy;
- [x] view last coordinates/event and installation identity.

The console refreshes device health every 30 seconds.

---

## 7. Route publication/status security — implemented in migration

Migration:

`supabase/migrations/20260817222500_jeepney_route_status_security.sql`

The original route RLS checked operator ownership but did not constrain the `status` column. An operator could therefore attempt to self-promote a route to `published`.

New database trigger enforces:

### Operator-created routes

Allowed initial states:

- `draft`
- `pending`

Operators cannot directly create `published` routes.

### Operator status transitions

Allowed:

```text
draft -> pending
pending -> draft
published -> suspended
suspended -> published
```

The production transitions preserve the existing breakdown/repaired workflow for already-approved routes.

Other transitions require admin/server authority.

### Suspended-route public access

Public read policies now allow both:

```text
published
suspended
```

for routes and their associated public stops, vehicles and positions. This keeps an outage page accessible to riders instead of making the route disappear solely because service was suspended.

---

## 8. Permanent data model target

Permanent fleet identity:

```text
cooperative/operator -> vehicle -> installed device
```

Operational assignment:

```text
vehicle -> trip -> route_variant
```

A vehicle must **not** permanently equal one route. `jeepney_vehicles.route_id` remains a compatibility field while active trips become authoritative.

Future core additions:

- [ ] cooperative organization model
- [ ] route variants / directions
- [ ] dedicated SIM lifecycle if needed
- [ ] installation photos/tamper-seal records
- [ ] partner integrations
- [ ] scoped API clients

---

## 9. ETA / routing roadmap

Current implementation already supports per-vehicle ETA using route progress, live speed and available segment-speed history.

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

## 10. Fleet/cooperative dashboard target

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

The current GPS admin console is the first device-health foundation; a cooperative dispatcher experience remains separate work.

---

## 11. Government / partner view

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

## 12. Hardware sourcing

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

Required capabilities:

- Philippine-compatible LTE;
- direct IP/domain + port configuration;
- raw protocol documentation;
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

## 13. Regulatory workstream

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

## 14. Commercial model

### Rider

Free.

### Operator/cooperative

Potential revenue:

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

## 15. Build phases

### Phase 0 — Branch/deployment stabilization

- [x] Merge current `main` history into the feature branch without overwriting newer Jeepney work
- [x] Preserve newer main features: fares, schedules, rentals, stop photos and service calendar
- [ ] Resolve why GitHub PR #3 still reports `mergeable: false` even though current `main` is contained in feature history
- [ ] Run build/type/lint in a functioning CI/local environment
- [ ] Apply/verify migrations in target Supabase project
- [ ] Verify production deployment branch
- [ ] Add automated smoke tests

### Phase 1 — Multi-vehicle rider tracking

- [x] Vehicle-keyed live state
- [x] Multiple map markers per route
- [x] Live fleet counts
- [x] Independent speed/last-seen
- [x] Stale pruning
- [x] Realtime merge per vehicle
- [x] Polling latest-per-vehicle
- [x] Approaching vehicle list
- [x] Nearest-stop ETA ranking
- [x] Fleet body/unit labels
- [x] Phone shifts tied to fleet vehicle IDs
- [ ] Direction/return-route support
- [ ] Automated multi-vehicle tests

### Phase 2 — Hardware foundation

- [x] Device schema
- [x] Assignment schema
- [x] Restricted ingest receipts
- [x] Secure JSON ingest
- [x] Hashed device secrets
- [x] Device health updates
- [x] Admin provisioning API
- [x] Admin fleet-health API
- [x] Admin provisioning UI
- [x] Admin device-health UI
- [x] Preserve phone tracker fallback
- [ ] Secret rotation/revoke UI
- [ ] Transactional dedup/rate limiting
- [ ] Vendor protocol adapters

### Phase 3 — Vehicle / route decoupling

- [x] Begin treating vehicle as a real fleet identity in phone tracking
- [ ] Active trip authoritative for route assignment everywhere
- [ ] Remove permanent route dependence from vehicle model
- [ ] Route variants/directions
- [ ] Automatic hardware trip lifecycle

### Phase 4 — Fleet control

- [ ] Cooperative organization/fleet model
- [ ] Dispatcher dashboard
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

## 16. Immediate implementation queue

1. **Get a real build/typecheck against the current feature head.**
2. **Apply and verify the two 2026-08-17 migrations in the target Supabase project.**
3. Investigate GitHub PR #3 `mergeable: false` state after the explicit `main` merge commit.
4. Add tracker secret rotation, suspend/revoke and assignment-management actions.
5. Make active trip the authoritative route assignment everywhere.
6. Add route direction/variants and proper geometry projection.
7. Add cooperative dispatcher/headway monitoring.
8. Obtain sample tracker protocol documentation and begin vendor adapters.
9. Run 5–25 vehicle pilot.

---

## 17. Implementation log

### 2026-08-17 — Architecture/audit

- Audited existing Jeepney Planner branch.
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

### 2026-08-17 — Multi-vehicle rider tracking

- Added `src/lib/jeepney-live.ts`.
- Realtime state now retains latest position per vehicle instead of per route.
- Overview and route detail render every active unit.
- Added approaching-vehicle ETA list.
- Rider location selects nearest mapped stop and sorts approaching units by ETA.
- Live map and ETA cards resolve real body/unit labels.

### 2026-08-17 — Main-history preservation

- Feature branch had fallen substantially behind `main`.
- Created an explicit two-parent merge commit using current `main` as a parent.
- Preserved newer main Jeepney features while layering telematics/multi-vehicle code on top.
- Did not force-overwrite `main`.

### 2026-08-17 — GPS administration

- Added `/api/telematics/v1/devices` admin-only health endpoint.
- Added GPS provisioning/health console to `/jeepney/admin`.
- Added one-time secret handling and fleet health telemetry views.

### 2026-08-17 — Route status security

- Confirmed original operator RLS did not constrain the route `status` field.
- Added `20260817222500_jeepney_route_status_security.sql`.
- Prevented operator self-publication of draft/pending routes.
- Preserved approved-route breakdown/recovery transitions.
- Kept suspended routes publicly readable.

### 2026-08-17 — Phone fleet identity

- Added unit selection/creation to phone live tracking.
- Phone trips and GPS pings now carry the real `vehicle_id`.
- Vehicle identity is fixed for the shift.
- This removes the remaining normal operator-phone path that collapsed multiple jeepneys into one anonymous route stream.

### Validation state

- PR #3 remains **open and unmerged**.
- GitHub currently reports `mergeable: false`; this requires investigation rather than force-merging.
- The repository currently exposes no usable CI result for these latest changes through the connected tooling.
- The working container cannot reach GitHub directly, so a local clone/build could not be used as a substitute.
- New migrations are committed but still need confirmation/application in the target Supabase project before production use.

---

## 18. Pilot success criteria

For a 5–25 vehicle pilot:

- >99% accepted telemetry while cellular service is available;
- offline buffer/resend demonstrated;
- all simultaneous active vehicles visible independently;
- real unit/body identity shown to rider/dispatcher;
- secure tracker-to-vehicle identity;
- stale/offline detection;
- accurate route/trip/direction association;
- useful rider ETA ranges;
- cooperative fleet visibility;
- daily trip/service reports;
- exact NTC/LTFRB hardware status documented;
- privacy/data-retention controls documented.

That evidence package becomes the basis for larger cooperative, LGU and government discussions.
