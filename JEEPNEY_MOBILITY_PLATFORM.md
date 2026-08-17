# Barangay Buddy Jeepney Mobility Platform

**Status:** Active build plan  
**Working branch:** `feature/jeepney-planner-live-route-ui`  
**Primary product:** Barangay Buddy Jeepney Planner / Public Transport Mobility Platform  
**Last updated:** 2026-08-17

---

## 1. Product goal

Build Barangay Buddy from a commuter-facing Jeepney Planner into a **device-agnostic Philippine public-transport telemetry platform** that can:

- show multiple live jeepneys on the same route;
- calculate useful rider ETAs and route progress;
- accept GPS from driver phones, Barangay Buddy branded trackers, existing cooperative trackers, and OEM telematics;
- give operators and cooperatives a fleet-management dashboard;
- expose controlled read-only regulatory views/APIs for LTFRB, DOTr, LTO, and LGUs where appropriate;
- maintain route, trip, device, vehicle, and telemetry audit trails;
- support future GTFS / GTFS-Realtime output;
- remain open to multiple hardware vendors so Barangay Buddy controls the platform and normalized data model.

> **Product principle:** Hardware is replaceable. The normalized transport-data network, rider network, operational history, fleet software, and integrations are the moat.

---

## 2. Current implementation audit

### Existing product foundation

- [x] Public `/jeepney` route directory and map
- [x] Route detail pages
- [x] Routes and stops
- [x] Operator accounts
- [x] Vehicle table
- [x] GPS position history
- [x] Supabase Realtime for GPS positions
- [x] Phone-based live GPS broadcasting
- [x] ~15 second phone position cadence
- [x] Trip records
- [x] Distance / average speed / ping tracking
- [x] Route and segment analytics
- [x] Congestion visualization
- [x] Breakdown / repaired alerts
- [x] Rider route follows
- [x] Route claims / admin review
- [x] Device request workflow
- [x] OpenStreetMap route import workflow

### Confirmed architectural problems

- [ ] **P0: Public live state is keyed by `route_id`, so only one live marker can be shown per route.** The database already supports `vehicle_id`; the UI collapses multiple active vehicles into one route-level position.
- [x] **P0: Dedicated server-side hardware telemetry gateway now exists.** Trackers do not write directly to Supabase.
- [ ] **P0: Route publication/status authorization needs hardening.** Operator-owned route updates still include fields that should become server/admin controlled transitions.
- [ ] **P1: Vehicle identity is too tightly coupled to `route_id`.** A permanent fleet vehicle must be able to operate different routes/trips.
- [x] **P1 foundation: GPS device provisioning, identity, installation assignments and current device health are now represented in schema.**
- [ ] **P1: Fleet/cooperative dispatch and headway management are missing.**
- [ ] **P1: ETA map matching relies too heavily on route-node proximity rather than projected location along route geometry.**
- [ ] **P2: No GTFS / GTFS-Realtime export yet.**
- [ ] **P2: No government/LGU read-only operations view or partner API yet.**

---

## 3. Target architecture

```text
GPS sources
  |
  +-- Driver phone / PWA
  +-- Barangay Buddy hardwired 4G GNSS tracker
  +-- Existing cooperative GPS API / webhook
  +-- TOPFLYtech adapter
  +-- Jimi IoT / Concox adapter
  +-- Teltonika adapter
  +-- Queclink adapter
  +-- OEM telematics adapter
  |
  v
Barangay Buddy Telemetry Gateway
  - device authentication
  - protocol decoding
  - duplicate/replay controls
  - timestamp validation
  - coordinate/speed validation
  - device health ingestion
  - normalized event model
  |
  v
Transport Core
  - devices
  - vehicles
  - device assignments
  - trips
  - routes / route variants
  - positions
  - ETAs / headways
  - analytics
  |
  +----------------+-----------------+-----------------+
  |                |                 |                 |
  v                v                 v                 v
Rider Map       Operator          Cooperative       Partner / Gov
& ETAs          Dashboard         Fleet Control     Read-only/API
```

---

## 4. Tracking tiers

### Tier A — Driver phone

Keep the existing browser/PWA geolocation tracker for immediate onboarding and pilots.

- no hardware cost;
- suitable for small operators and demos;
- current cadence is approximately 15 seconds;
- tracking can stop when the browser/app is closed or restricted by the OS.

### Tier B — Existing cooperative GPS integration

Allow cooperatives to keep current hardware and connect data to Barangay Buddy through:

- HTTPS webhook;
- REST/vendor API adapter;
- TCP/UDP device protocol;
- MQTT where supported.

### Tier C — Barangay Buddy branded hardware

Primary commercial tracker should be a concealed, hardwired **4G GNSS** unit rather than depending on OBD-II.

Desired minimum capabilities:

- Philippine-compatible LTE;
- GNSS;
- TCP and/or UDP, preferably MQTT/TLS;
- configurable 10–15 second moving interval;
- offline buffering and resend;
- ignition/ACC input;
- external-power-loss detection;
- backup battery;
- IMEI and firmware identification;
- configurable I/O;
- remote configuration / OTA where possible;
- ability to point directly to Barangay Buddy servers;
- no mandatory vendor-cloud dependency.

### Tier D — OEM telematics

Support modern PUV manufacturers exposing an approved telemetry feed without requiring a second GPS box.

---

## 5. Hardware sourcing

### First vendors to sample

1. **TOPFLYtech** — OEM/ODM candidate
2. **Jimi IoT / Concox** — OEM/ODM candidate
3. **Teltonika** — premium/reference supported hardware
4. **Queclink** — premium/reference supported hardware

### RFQ quantities

Request:

- 5–25 engineering/sample units;
- 100-unit pilot pricing;
- 1,000-unit production pricing;
- Barangay Buddy logo/casing/packaging MOQ.

### Required RFQ questions

- Can the unit report directly to our host/IP and port?
- Is the raw device protocol fully documented?
- Can vendor cloud be disabled?
- Supported TCP/UDP/MQTT/TLS modes?
- Configurable reporting interval?
- Offline buffering/resend behavior?
- Ignition / ACC detection?
- External power disconnect/tamper alert?
- Backup battery?
- I/O and RS232/RS485 options?
- Philippine LTE bands?
- IMEI / ICCID / firmware reporting?
- OTA/configuration capability?
- Existing NTC certifications or Philippine deployments?
- Documentation/support for NTC type approval/type acceptance?
- Documentation/support for LTFRB device/provider testing/accreditation?
- Warranty/RMA terms?

**Do not order production inventory until raw protocol/server control, Philippine radio compliance path, and LTFRB compliance status for the exact SKU are verified.**

---

## 6. Regulatory / legal workstream

### Agency order

1. DOTr
2. LTFRB
3. LTO
4. NTC
5. LGUs / local transport offices
6. Transport cooperatives / corporations

### Working interpretation

- LTFRB is the primary PUV operating/franchise regulator for the GPS-provider/fleet-tracking proposal.
- LTO remains relevant to registration, vehicle identity, roadworthiness and potential data integration.
- NTC is relevant to radio/cellular equipment type approval/type acceptance and supplier/dealer requirements.
- Modern PUV technical rules include GNSS capability, but program-specific requirements can change; do not make blanket public claims without checking the current circular/program.

### Compliance references to maintain

- LTFRB Memorandum Circular 2015-013 — GPS device provider accreditation/specifications
- Current LTFRB modern PUV technical specification issuances
- Current DOTr/LTFRB service-contracting rules
- NTC Type Approval / Type Acceptance / Equipment Conformity requirements
- Republic Act No. 10173 — Data Privacy Act of 2012

### Compliance matrix required before government presentation

| Requirement | Source | BB platform | Candidate hardware | Evidence | Status |
|---|---|---|---|---|---|
| Position accuracy | LTFRB | Gateway validation | Vendor test | Test report | TBD |
| Reporting interval | LTFRB | Configurable | Vendor config | Protocol/config dump | TBD |
| Offline storage/resend | LTFRB | Duplicate handling | Vendor buffer | Test | TBD |
| Server routing | LTFRB | BB gateway | Configurable host | Config evidence | TBD |
| Power-loss handling | LTFRB | Event/health storage | Device alert | Test | TBD |
| Device identity | Platform | Public ID + hashed secret | IMEI | Provisioning record | BUILDING |

No hardware should be marketed as **LTFRB compliant**, **LTFRB approved**, or **LTFRB accredited** until exact approval/accreditation status is documented.

---

## 7. Data model

### Permanent identity

`operator/cooperative -> vehicle -> installed device`

A vehicle is a fleet asset. It should not permanently equal one route.

### Operational identity

`vehicle -> trip -> route / route variant`

The trip determines which route a vehicle is operating at that time.

### Implemented hardware tables

- [x] `jeepney_gps_devices`
- [x] `jeepney_device_assignments`
- [x] `jeepney_device_ingest_receipts`

### Later tables

- [ ] `jeepney_sim_cards` if SIM management needs its own lifecycle
- [ ] installation photos/tamper seal records
- [ ] `jeepney_route_variants`
- [ ] `jeepney_partner_integrations`
- [ ] `jeepney_api_clients`

### Current device record supports

- operator ownership;
- public tracker ID;
- IMEI;
- manufacturer/model;
- firmware;
- hashed device credential;
- SIM ICCID;
- device lifecycle status;
- last seen;
- last coordinates/speed/heading/accuracy;
- ignition;
- external voltage;
- backup battery percentage;
- signal strength;
- latest event type;
- private metadata.

### Public-position privacy boundary

Raw tracker identity and health are **not** added directly to the public `jeepney_positions` row. A restricted ingest-receipt table maps an accepted position back to the physical tracker for audit purposes.

---

## 8. Device security model

Never put Supabase service-role credentials into trackers.

### Implemented flow

1. Admin calls `/api/telematics/v1/provision` using authenticated admin access.
2. Server generates a 256-bit random device secret.
3. Server stores only its SHA-256 hash.
4. Original secret is returned once to the provisioning administrator.
5. Device is optionally installed onto a fleet vehicle.
6. Tracker sends telemetry to `/api/telematics/v1/ingest`.
7. Tracker authenticates with `x-bb-device-id` and `x-bb-device-secret`.
8. Server hashes and validates the supplied secret.
9. Server resolves the installed vehicle.
10. Server prefers the vehicle's active trip for route association and temporarily falls back to legacy `jeepney_vehicles.route_id` during migration.
11. Server writes a `source = hardware` position to the existing realtime pipeline.
12. Server writes a private ingest receipt and updates device health.

### Still required for production hardening

- [ ] HMAC/signed requests where tracker supports it
- [ ] stronger replay protection / transactional deduplication
- [ ] credential rotation
- [ ] per-device rate limiting
- [ ] IP/network anomaly detection
- [ ] device revocation UI
- [ ] provisioning audit UI

---

## 9. Rider experience — P0 multi-vehicle change

The UI must stop using one value per route:

```ts
Record<routeId, JeepneyPosition>
```

and move toward live vehicles such as:

```ts
Record<routeId, Record<vehicleId, JeepneyPosition>>
```

or another normalized structure indexed by route + vehicle.

Expected result:

```text
Laoag Route A
  Jeepney BB-104    2–4 min
  Jeepney BB-219    7–9 min
  Jeepney BB-087   12–15 min
```

### ETA stages

1. Current simple route-distance ETA
2. Project GPS point onto route geometry instead of nearest stored node
3. Detect route direction / trip progress
4. Incorporate segment-speed history
5. Incorporate current fleet headway
6. Add stop dwell-time model
7. Add ETA confidence interval and stale-data confidence

---

## 10. Fleet / cooperative dashboard target

Eventually show:

- all active vehicles;
- current/assigned route;
- last GPS age;
- ignition;
- moving/stopped/offline;
- speed;
- route deviation;
- headway/bunching;
- first/last trip;
- breakdowns;
- tracker health;
- SIM/connectivity health;
- kilometers/day;
- service hours;
- trips completed;
- CSV/API exports.

---

## 11. Regulatory / partner dashboard target

Read-only, scoped by organization/jurisdiction/agreement:

- active units by route;
- service coverage;
- route adherence;
- headways;
- trip completion;
- offline devices;
- fleet availability;
- aggregate speeds/congestion;
- breakdown/service alerts;
- exports/API;
- audit history where required.

Do not expose unnecessary driver personal data on the public rider map.

---

## 12. Commercial model

### Rider

Free.

### Operator/cooperative

Long-term pricing should move from route-only pricing toward **active fleet units + service level**.

Possible revenue:

- free/basic phone tracking;
- per-vehicle Fleet Basic;
- per-vehicle Fleet Pro;
- cooperative fleet plan;
- tracker sale;
- tracker lease;
- installation fee;
- managed SIM/connectivity;
- analytics subscription;
- API/integration plan;
- LGU/government deployment/support contracts.

The current `₱100/month per route` can remain during MVP/pilot but should not define the final telemetry pricing model.

---

## 13. Build phases

### Phase 0 — Stabilize current branch

- [ ] Merge/resolve active Jeepney PR cleanly when ready
- [ ] Verify migrations deployed in target Supabase project
- [ ] Verify production deployment branch
- [ ] Add rider/operator/admin smoke tests

### Phase 1 — Multi-vehicle live tracking **P0 — NEXT**

- [ ] Change live state from one-per-route to one-per-vehicle
- [ ] Render every current vehicle marker
- [ ] Preserve route filtering/focus
- [ ] Show vehicle label/body number where permitted
- [ ] Show independent last-seen time and speed
- [ ] Prevent stale vehicle markers from appearing live
- [ ] Update route detail to choose relevant approaching vehicles

### Phase 2 — Hardware foundation **P0 — STARTED**

- [x] Define hardware/device architecture
- [x] Add `jeepney_gps_devices`
- [x] Add `jeepney_device_assignments`
- [x] Add restricted ingest receipts
- [x] Add server-side `/api/telematics/v1/ingest`
- [x] Add hashed device-secret authentication
- [x] Add device heartbeat/health updates
- [x] Add admin-only `/api/telematics/v1/provision`
- [x] Preserve legacy phone tracking
- [ ] Add provisioning/admin UI
- [ ] Add secret rotation/revoke workflow
- [ ] Add transactional deduplication/rate limiting

### Phase 3 — Vehicle / route decoupling **P1**

- [ ] Treat vehicle as permanent fleet asset
- [ ] Use active trip for current route assignment everywhere
- [ ] Keep temporary compatibility with legacy `jeepney_vehicles.route_id`
- [ ] Add route direction / variants
- [ ] Add trip lifecycle suitable for hardware auto-tracking

### Phase 4 — Fleet control **P1**

- [ ] Cooperative organization/fleet structure
- [ ] Dispatcher dashboard
- [ ] Device-health board
- [ ] Headway/bunching detection
- [ ] Route deviation
- [ ] Offline tracker alerts
- [ ] Shift/trip reports

### Phase 5 — Hardware adapters **P1**

- [ ] Generic JSON/webhook adapter
- [ ] TOPFLYtech adapter
- [ ] Jimi/Concox adapter
- [ ] Teltonika adapter
- [ ] Queclink adapter
- [ ] Existing cooperative vendor connector

### Phase 6 — Compliance / pilot **P1**

- [ ] Hardware RFQs
- [ ] Sample-device bench testing
- [ ] NTC status review
- [ ] LTFRB compliance matrix
- [ ] Pilot cooperative agreement
- [ ] Install 5–25 units
- [ ] Measure uptime, accuracy, cellular coverage and data usage

### Phase 7 — Open transit / government **P2**

- [ ] GTFS static export
- [ ] GTFS-Realtime VehiclePositions
- [ ] GTFS-Realtime TripUpdates
- [ ] Partner API keys/scopes
- [ ] LTFRB/LGU read-only dashboard
- [ ] Audit/export tooling

---

## 14. Immediate implementation queue

1. **Refactor public live map to retain all active vehicle positions.**
2. Refactor route detail to show multiple approaching jeepneys.
3. Add admin/operator device provisioning UI on top of the new API.
4. Add device-health/fleet dashboard.
5. Complete vehicle-to-route decoupling around active trips.
6. Refactor route status transitions so publication/verification is server/admin controlled while breakdown reporting remains usable.
7. Start vendor adapters once sample protocol documentation is obtained.

---

## 15. Implementation log

### 2026-08-17 — Audit and architecture

- Audited current Jeepney feature branch.
- Confirmed existing phone GPS, trips, realtime positions, route claims, analytics, congestion and device-request foundations.
- Confirmed one-live-marker-per-route limitation.
- Established device-agnostic architecture.
- Established DOTr/LTFRB/LTO/NTC regulatory workstream.
- Created this master build document.

### 2026-08-17 — Hardware foundation

- Added migration `20260817215000_jeepney_hardware_foundation.sql`.
- Added `jeepney_gps_devices` with hashed secret, IMEI/device metadata and current health.
- Added `jeepney_device_assignments` with one-active-installation constraints.
- Added private `jeepney_device_ingest_receipts` to map accepted rider positions to physical devices without exposing hardware metadata publicly.
- Added `/api/telematics/v1/ingest`.
- Added device-secret authentication and duplicate sequence lookup.
- Added active-trip-first route resolution with temporary legacy `vehicle.route_id` fallback.
- Added `/api/telematics/v1/provision` for admin-created trackers and optional vehicle installation.
- Provisioning returns the device secret once; only its SHA-256 hash remains in the database.
- Hardware positions feed the existing `jeepney_positions` realtime stream using `source = hardware`.

**Next engineering target:** multi-vehicle rider live state and map markers.

---

## 16. First pilot definition of success

For a 5–25 vehicle pilot, Barangay Buddy should demonstrate:

- >99% accepted telemetry while cellular service is available;
- documented offline buffering/resend behavior;
- all simultaneously active jeepneys visible independently;
- tracker identity tied to installed vehicle;
- secure device credential with revocation;
- accurate route/trip association;
- stale/offline detection;
- useful rider ETA ranges;
- operator fleet visibility;
- daily trip/service reports;
- documented NTC/LTFRB status for the exact hardware SKU;
- documented privacy/data-retention controls.

That becomes the evidence package for larger cooperative and government discussions.
