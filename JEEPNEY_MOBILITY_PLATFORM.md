# Barangay Buddy Jeepney Mobility Platform

**Status:** Active build — multi-vehicle rider tracking, phone fleet identity, GPS hardware, secure ingest, admin health and tracker lifecycle controls implemented in code  
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

## 2. Product foundation already present

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

---

## 3. Multi-vehicle rider tracking — implemented

The original app collapsed every live jeepney on a route into one `Record<routeId, position>` entry. That architecture has been replaced.

- [x] Live state retains one latest position per vehicle
- [x] Realtime INSERTs merge into the correct vehicle stream
- [x] Polling fallback rebuilds latest position per vehicle
- [x] Every active vehicle renders independently on overview map
- [x] Every active vehicle renders independently on route-detail map
- [x] Route cards/details report live vehicle count
- [x] Five-minute stale rule remains enforced
- [x] Live ETA list ranks approaching vehicles
- [x] Rider location selects nearest mapped stop for ETA ranking
- [x] Actual fleet unit/body labels resolve on map and ETA list
- [x] UUID fragment remains only as fallback when label lookup is unavailable

Implementation:

- `src/lib/jeepney-live.ts`
- `src/components/jeepney-map.tsx`
- `src/components/jeepney-live-vehicle-list.tsx`
- `src/routes/jeepney.index.tsx`
- `src/routes/jeepney.$slug.tsx`

---

## 4. Phone GPS fleet identity — implemented

`src/components/jeepney-live-toggle.tsx`

- [x] Operator selects the actual jeepney unit before going live
- [x] Operator can create a body/unit record if none exists
- [x] Optional plate number can be recorded
- [x] Vehicle identity is locked for the duration of the shift
- [x] `jeepney_trips.vehicle_id` is populated
- [x] Every phone GPS position includes `vehicle_id`
- [x] Multiple driver phones can coexist on the same route without collapsing into one route-level GPS stream

Legacy `vehicle_id = null` positions remain readable for compatibility, but normal new operator shifts now use a real fleet identity.

---

## 5. Telemetry architecture

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

## 6. GPS hardware foundation — implemented in code

Migration:

`supabase/migrations/20260817215000_jeepney_hardware_foundation.sql`

Tables:

- [x] `jeepney_gps_devices`
- [x] `jeepney_device_assignments`
- [x] `jeepney_device_ingest_receipts`

Device model supports:

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

Public rider positions do **not** contain tracker secrets or detailed authentication data.

---

## 7. Hardware APIs — implemented

### `POST /api/telematics/v1/provision`

Admin-only provisioning:

1. Authenticate user.
2. Require admin role.
3. Generate 256-bit random tracker secret.
4. Store only SHA-256 hash.
5. Return original secret once.
6. Optionally install tracker on a vehicle.

### `POST /api/telematics/v1/ingest`

Hardware ingest:

1. Authenticate `x-bb-device-id` + secret.
2. Validate telemetry payload and device timestamp.
3. Reject suspended/retired tracker.
4. Deduplicate by optional device sequence.
5. Resolve tracker-to-vehicle installation.
6. Prefer active trip for route association.
7. Temporarily fall back to legacy `jeepney_vehicles.route_id`.
8. Write normalized `source = hardware` position.
9. Update tracker health.
10. Store restricted ingest receipt.

Trackers never receive Supabase service-role credentials.

### `GET /api/telematics/v1/devices`

Admin-only fleet-health endpoint:

- [x] validates access token;
- [x] requires admin role;
- [x] performs private hardware reads server-side;
- [x] returns device/assignment/operator/vehicle/route context;
- [x] does not relax hardware-table public RLS.

### `PATCH /api/telematics/v1/devices`

Admin-only lifecycle management:

- [x] suspend tracker;
- [x] reactivate tracker;
- [x] retire tracker;
- [x] rotate tracker secret;
- [x] return replacement secret once;
- [x] unassign tracker from vehicle;
- [x] assign/reassign tracker to a vehicle owned by the same operator;
- [x] prevent assignment of retired devices;
- [x] prevent assigning a second active tracker to an already-tracked vehicle.

---

## 8. GPS admin console — implemented

Integrated into `/jeepney/admin`.

### Provisioning / health

`src/components/jeepney-gps-admin.tsx`

Admins can:

- provision tracker;
- choose operator/cooperative;
- optionally install tracker immediately;
- enter IMEI, ICCID, manufacturer, model and firmware;
- receive/copy one-time secret;
- see tracker counts by online/delayed/offline state;
- view last seen, speed, ignition, external voltage, backup battery, signal and GPS accuracy;
- view current installation identity.

### Lifecycle / installation

`src/components/jeepney-gps-lifecycle-admin.tsx`

Admins can:

- [x] assign/reassign tracker;
- [x] unassign tracker;
- [x] suspend compromised/offline hardware;
- [x] reactivate hardware;
- [x] rotate secret and copy replacement credential;
- [x] retire hardware and close its active installation.

---

## 9. Route publication/status security — implemented in code

Migration:

`supabase/migrations/20260817222500_jeepney_route_status_security.sql`

The original ownership RLS did not constrain the route `status` field, so an operator could attempt to self-publish.

New database trigger permits operator-created routes only as:

```text
draft
pending
```

Allowed operator transitions:

```text
draft -> pending
pending -> draft
published -> suspended
suspended -> published
```

The production transitions preserve the existing breakdown/repaired workflow for already-approved routes. Other transitions require admin/server authority.

Public read policies now allow both `published` and `suspended` route data so a rider outage page remains readable.

---

## 10. Permanent data model target

Permanent fleet identity:

```text
cooperative/operator -> vehicle -> installed device
```

Operational assignment:

```text
vehicle -> trip -> route_variant
```

A vehicle must **not** permanently equal one route. `jeepney_vehicles.route_id` remains a compatibility field while active trips become authoritative.

Future additions:

- [ ] cooperative organization model
- [ ] route variants/directions
- [ ] dedicated SIM lifecycle if needed
- [ ] installation photos/tamper-seal records
- [ ] partner integrations
- [ ] scoped API clients

---

## 11. ETA / routing roadmap

Current implementation supports per-vehicle ETA using route progress, live speed and available segment-speed history.

1. [x] Multiple active vehicles retained independently
2. [x] Per-vehicle ETA to next/nearest mapped stop
3. [ ] Proper perpendicular projection onto route geometry
4. [ ] Direction / route-variant detection
5. [ ] Trip progress state
6. [ ] Stop dwell-time model
7. [ ] Fleet headway/bunching
8. [ ] ETA confidence interval and stale-data confidence

---

## 12. Fleet/cooperative dashboard target

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

The current GPS admin pages are the device-management foundation. A cooperative dispatcher experience remains separate work.

---

## 13. Government / partner view

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

## 14. Hardware sourcing

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

## 15. Regulatory workstream

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

## 16. Commercial model

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

## 17. CI / merge state

Workflow added:

`.github/workflows/jeepney-ci.yml`

Intended validation:

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm run build
```

Current verified GitHub state:

- [x] current `main` history explicitly merged into feature history;
- [x] newer `main` Jeepney features preserved;
- [x] raw GitHub PR API reports `mergeable: true`;
- [x] raw GitHub PR API reports `mergeable_state: unstable`;
- [x] `main` is not branch-protected;
- [x] no required status checks are configured on `main`;
- [ ] CI has actually executed application steps.

Why CI is red:

> GitHub annotation: **“The job was not started because your account is locked due to a billing issue.”**

Therefore there is currently **no recorded lint/build failure**. The runner never reached checkout.

The session container also cannot resolve `github.com`, so a local public-repo clone/build cannot substitute for Actions here.

**Do not merge to production until CI actually executes successfully or an equivalent local lint/build is completed.**

---

## 18. Supabase deployment state

The repo identifies the existing Barangay Buddy Supabase project, but the connected Supabase tool currently returns:

```text
You do not have permission to perform this action
```

when attempting to enumerate migrations.

Therefore:

- [x] migrations are committed to GitHub;
- [ ] hardware migration confirmed in production DB;
- [ ] route-status security migration confirmed in production DB;
- [ ] migrations applied through this session.

No production database mutation was attempted after permission denial.

---

## 19. Build phases

### Phase 0 — Branch/deployment stabilization

- [x] Merge current `main` into feature history safely
- [x] Preserve fares, schedules, rentals, photos and service calendar
- [x] Confirm PR has no current GitHub merge conflict (`mergeable: true`)
- [x] Add lint/build CI workflow
- [ ] Resolve GitHub Actions billing lock
- [ ] Run CI successfully
- [ ] Apply/verify migrations in target Supabase project
- [ ] Verify production deployment branch
- [ ] Add automated smoke tests

### Phase 1 — Multi-vehicle rider tracking

- [x] Vehicle-keyed live state
- [x] Multiple markers per route
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
- [x] Admin provisioning API/UI
- [x] Admin health API/UI
- [x] Suspend/reactivate/retire
- [x] Secret rotation
- [x] Assign/reassign/unassign UI
- [x] Preserve phone tracker fallback
- [ ] Transactional dedup/rate limiting
- [ ] Vendor protocol adapters

### Phase 3 — Vehicle / route decoupling

- [x] Begin treating vehicle as real fleet identity in phone tracking
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

## 20. Immediate implementation queue

1. **Resolve GitHub account billing lock and rerun `Jeepney CI`.**
2. **Grant/restore Supabase migration-management access and apply/verify the two 2026-08-17 migrations.**
3. Make active trip the authoritative route assignment everywhere.
4. Add route direction/variants and proper geometry projection.
5. Add cooperative dispatcher/headway monitoring.
6. Add transactional telemetry dedup/rate limiting.
7. Obtain sample tracker protocol documentation and begin vendor adapters.
8. Run 5–25 vehicle pilot.

---

## 21. Implementation log — 2026-08-17

### Architecture/audit

- Audited Jeepney Planner branch.
- Identified one-marker-per-route limitation.
- Established device-agnostic telemetry architecture.
- Created master build document.

### Hardware foundation

- Added hardware foundation migration.
- Added secure GPS device identities/installations/receipts.
- Added hardware ingest and provisioning APIs.

### Multi-vehicle rider tracking

- Added vehicle-keyed live-state helpers.
- Added multiple simultaneous route markers.
- Added rider nearest-stop ETA ranking.
- Added real fleet unit/body labels.

### Branch stabilization

- Safely merged current `main` into feature history.
- Preserved newer fares, schedules, rentals, photos and service-calendar code.
- Raw PR state now confirms `mergeable: true`.

### GPS administration

- Added private fleet-health endpoint.
- Added provisioning/health UI.
- Added suspend/reactivate/retire/credential rotation.
- Added assignment/reassignment/unassignment controls.

### Route security

- Closed operator self-publication loophole in database migration.
- Preserved approved-route breakdown/recovery transitions.
- Kept suspended route data publicly readable.

### Phone fleet identity

- Added actual unit selection/creation before phone GPS shift.
- Phone trips/positions now carry real `vehicle_id`.

### Validation infrastructure

- Added `Jeepney CI` workflow.
- GitHub generated push + PR runs.
- Runs failed before checkout because the GitHub account is billing-locked.
- Confirmed no branch-protection requirement is causing the failure.

### Production migration verification

- Identified target Supabase project from repo configuration.
- Supabase connector denied migration-management permission.
- Production database left unchanged.

---

## 22. Pilot success criteria

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
