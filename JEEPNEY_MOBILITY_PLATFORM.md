# Barangay Buddy Jeepney Mobility Platform

**Status:** Active build plan  
**Working branch:** `feature/jeepney-planner-live-route-ui`  
**Primary product:** Barangay Buddy Jeepney Planner / Public Transport Mobility Platform  
**Last updated:** 2026-08-17

---

## 1. Product goal

Build Barangay Buddy from a commuter-facing Jeepney Planner into a device-agnostic Philippine public-transport telemetry platform that can:

- show multiple live jeepneys on the same route;
- calculate useful rider ETAs and route progress;
- accept GPS from driver phones, Barangay Buddy branded trackers, existing cooperative trackers, and OEM telematics;
- give operators and cooperatives a professional fleet-management dashboard;
- expose controlled read-only regulatory views/APIs for LTFRB, DOTr, LTO, and LGUs where appropriate;
- maintain route, trip, device, vehicle, and telemetry audit trails;
- support future GTFS / GTFS-Realtime output;
- remain open to multiple hardware vendors so Barangay Buddy controls the platform and data model rather than being locked to one tracker vendor.

### Product principle

> Hardware is replaceable. The normalized transport-data network, fleet software, rider network, operational history, and integrations are the moat.

---

## 2. Current implementation audit

### Already implemented

- [x] Public `/jeepney` route directory and map
- [x] Route detail pages
- [x] Jeepney routes and stops
- [x] Operator accounts
- [x] Vehicle table
- [x] GPS position history
- [x] Supabase Realtime for new GPS positions
- [x] Phone-based live GPS broadcasting
- [x] ~15 second phone position upload cadence
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

- [ ] **P0: Rider live state is keyed by `route_id`, so only one live marker can be shown per route.** The database supports `vehicle_id`; the UI currently collapses multiple live vehicles into one route-level position.
- [ ] **P0: No dedicated hardware telemetry ingest gateway exists.** Trackers must never receive Supabase service credentials or write directly to the database.
- [ ] **P0: Route publication/status authorization needs hardening.** Operator-owned route updates currently include fields that should eventually require server/admin controlled transitions.
- [ ] **P1: Vehicle identity is too tightly coupled to `route_id`.** A fleet vehicle must be able to operate different routes/trips without changing its permanent identity.
- [ ] **P1: Device provisioning, IMEI, SIM, firmware, health and installation records are missing.**
- [ ] **P1: Fleet/cooperative dispatch and headway management are missing.**
- [ ] **P1: ETA map matching currently relies on route-node proximity rather than projected location along route geometry.**
- [ ] **P2: No standardized GTFS / GTFS-Realtime export.**
- [ ] **P2: No government/LGU read-only operations view or partner API.**

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
  - replay / duplicate protection
  - timestamp validation
  - coordinate / speed validation
  - device health ingestion
  - normalized event model
  |
  v
Transport Core
  - devices
  - SIMs
  - vehicles
  - device assignments
  - trips
  - routes / route variants
  - positions
  - events
  - route matching
  - headways
  - ETAs
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

Use the existing browser/PWA geolocation tracker for immediate onboarding and pilots.

- no hardware cost;
- suitable for small operators and demos;
- keep ~15 second cadence;
- clearly indicate that tracking can stop when the browser/app is closed or restricted by the OS.

### Tier B — Existing fleet GPS integration

Allow cooperatives to keep current hardware and connect data to Barangay Buddy.

Accepted integration forms should include:

- HTTPS webhook;
- REST polling adapter;
- TCP/UDP device protocol through the telemetry gateway;
- MQTT where supported;
- vendor server API where raw hardware protocol is unavailable.

### Tier C — Barangay Buddy branded hardware

Primary commercial tracker should be a concealed, hardwired 4G GNSS unit rather than relying on an OBD-II dongle.

Desired minimum capabilities:

- Philippine-compatible LTE;
- GNSS;
- TCP and/or UDP, preferably MQTT/TLS support;
- configurable 10–15 second reporting while moving;
- offline buffering and resend;
- ignition/ACC input;
- external-power-loss detection;
- backup battery;
- IMEI and firmware identification;
- configurable I/O;
- remote configuration / OTA where possible;
- ability to point directly to Barangay Buddy-controlled servers;
- no mandatory vendor-cloud dependency.

### Tier D — OEM telematics

Support modern PUV manufacturers that expose an approved telematics feed without requiring a second GPS box.

---

## 5. Hardware sourcing plan

### First vendors to sample

1. **TOPFLYtech** — OEM/ODM candidate
2. **Jimi IoT / Concox** — OEM/ODM candidate
3. **Teltonika** — premium/reference supported hardware
4. **Queclink** — premium/reference supported hardware

### RFQ quantities

Request pricing and conditions for:

- 5–25 engineering/sample units;
- 100-unit pilot;
- 1,000-unit production run;
- logo/casing/packaging customization MOQ.

### Required RFQ questions

- Can the unit report directly to our host/IP and port?
- Is the raw device protocol fully documented?
- Can vendor cloud be disabled?
- Supported TCP/UDP/MQTT/TLS modes?
- Configurable reporting interval?
- Offline buffering capacity and resend behavior?
- Ignition / ACC detection?
- External power disconnect/tamper alert?
- Backup battery capacity?
- I/O and RS232/RS485 options?
- Philippine LTE band compatibility?
- IMEI / ICCID / firmware reporting?
- OTA/configuration capabilities?
- Existing NTC certifications or Philippine deployments?
- Documentation/support for NTC type approval/type acceptance?
- Documentation/support for LTFRB GPS provider/device testing?
- Warranty and RMA terms?

**Do not order production quantity until device protocol, server control, Philippine radio compliance path, and LTFRB compliance matrix are verified.**

---

## 6. Regulatory / legal workstream

### Agency order

1. DOTr
2. LTFRB
3. LTO
4. NTC
5. LGUs / transport offices
6. Transport cooperatives / corporations

### Current working interpretation

- LTFRB is the primary PUV operating/franchise regulator for the GPS-provider/fleet-tracking proposal.
- LTO remains relevant to registration, vehicle identity, roadworthiness, and potential data integration.
- NTC is relevant to radio/cellular equipment type approval/type acceptance and supplier/dealer requirements.
- Modern PUV technical rules include GNSS capability, but program-specific requirements can change; do not make blanket public claims without checking the current circular/program.

### Regulatory references to maintain in compliance matrix

- LTFRB Memorandum Circular 2015-013 — GPS device provider accreditation / specifications
- LTFRB modern PUV technical specification issuances, including GNSS requirements
- Current DOTr / LTFRB service contracting rules
- NTC Type Approval / Type Acceptance / Equipment Conformity requirements
- Republic Act No. 10173 — Data Privacy Act of 2012

### Before government presentation

Create a clause-by-clause compliance matrix containing:

| Requirement | Source | Barangay Buddy platform | Candidate hardware | Evidence | Status |
|---|---|---|---|---|---|
| Position accuracy | LTFRB | Gateway validation | Vendor test | Test report | TBD |
| Reporting interval | LTFRB | Configurable | Vendor config | Protocol/config dump | TBD |
| Offline storage/resend | LTFRB | Deduplication supported | Vendor buffer | Test | TBD |
| Server routing | LTFRB | BB gateway | Configurable host | Config screenshot | TBD |
| Power-loss handling | LTFRB | Event storage | Device alert | Test | TBD |
| Device identity | Platform | IMEI/public device ID | Device IMEI | Provisioning record | TBD |

No hardware should be marketed as `LTFRB compliant` or `LTFRB approved/accredited` until the exact approval/accreditation status is documented.

---

## 7. Data model target

### Permanent identities

`operator/cooperative -> vehicle -> installed device`

A vehicle is a fleet asset. It should not permanently equal one route.

### Operational identity

`vehicle -> trip -> route / route variant`

The trip decides which route a vehicle is operating at that time.

### New core tables

- `jeepney_gps_devices`
- `jeepney_device_assignments`
- later: `jeepney_sim_cards`
- later: `jeepney_device_events`
- later: `jeepney_installation_records`
- later: `jeepney_route_variants`
- later: `jeepney_partner_integrations`
- later: `jeepney_api_clients`

### Extend GPS positions

Normalized telemetry should eventually support:

- `device_id`
- `vehicle_id`
- `route_id`
- `latitude`
- `longitude`
- `heading`
- `speed_kph`
- `accuracy_m`
- `altitude_m`
- `ignition_on`
- `external_voltage_v`
- `backup_battery_pct`
- `signal_dbm`
- `event_type`
- `source`
- `device_recorded_at`
- `server_received_at`

---

## 8. Device security model

Never put Supabase service-role credentials into trackers.

Hardware flow:

1. Provision device in Barangay Buddy.
2. Assign a public device ID.
3. Generate a high-entropy device secret.
4. Store only a cryptographic hash of the secret server-side.
5. Configure the tracker/gateway credential once.
6. Send telemetry to `/api/telematics/v1/ingest`.
7. Server authenticates, validates and normalizes the event.
8. Server writes to Supabase using server-only credentials.

Later hardening:

- signed requests/HMAC where hardware supports it;
- nonce/replay protection;
- credential rotation;
- per-device rate limiting;
- payload sequence numbers;
- IP/network anomaly detection;
- device revocation;
- audit log.

---

## 9. Rider experience target

### P0 multi-vehicle change

The UI must stop using one value per route:

```ts
Record<routeId, JeepneyPosition>
```

and move toward live vehicles such as:

```ts
Record<routeId, Record<vehicleId, JeepneyPosition>>
```

or a normalized list indexed by both route and vehicle.

Expected rider result:

```text
Laoag Route A
  Jeepney BB-104    2–4 min
  Jeepney BB-219    7–9 min
  Jeepney BB-087   12–15 min
```

### ETA stages

1. Current simple route-distance ETA
2. Project GPS point onto route geometry rather than nearest stored node
3. Detect route direction / trip progress
4. Incorporate segment-speed history
5. Incorporate current fleet headway
6. Add stop dwell-time model
7. Add confidence interval and stale-data confidence

---

## 10. Fleet / cooperative dashboard target

Fleet dashboard should eventually show:

- all active vehicles;
- assigned/current routes;
- last GPS age;
- ignition state;
- moving / stopped / offline;
- speed;
- route deviation;
- headway / bunching;
- first/last trip;
- breakdowns;
- device health;
- SIM/connectivity health;
- kilometers by day;
- service hours;
- trips completed;
- maintenance integration later;
- CSV/API exports.

---

## 11. Regulatory / partner dashboard target

Read-only access, scoped by organization/jurisdiction and agreement:

- active units by route;
- service coverage;
- route adherence;
- headways;
- trip completion;
- offline devices;
- fleet availability;
- aggregate speeds/congestion;
- breakdown/service alerts;
- export/API access;
- immutable audit history where required.

Do not expose unnecessary driver personal data on the public rider map.

---

## 12. Commercial model

### Rider

Free.

### Operator / cooperative

Long-term pricing should move from route-only pricing toward active fleet units and service level.

Possible products:

- free/basic phone tracking;
- per-vehicle Fleet Basic;
- per-vehicle Fleet Pro;
- cooperative fleet plan;
- hardware purchase;
- hardware lease;
- installation fee;
- managed SIM/connectivity subscription;
- analytics subscription;
- API/integration plan;
- LGU/government deployment/support contract.

The existing `₱100/month per route` plan can remain during the MVP/pilot but should not define the final telemetry business model.

---

## 13. Build phases

### Phase 0 — Stabilize current branch

- [ ] Merge/resolve active Jeepney PR cleanly when ready
- [ ] Verify migrations deployed in the target Supabase project
- [ ] Verify production deployment branch
- [ ] Add smoke tests for rider/operator/admin routes

### Phase 1 — Multi-vehicle live tracking **P0**

- [ ] Change live position state from one-per-route to one-per-vehicle
- [ ] Render every current vehicle marker
- [ ] Preserve route filtering/focus
- [ ] Show vehicle label/body number where permitted
- [ ] Show independent last-seen time and speed
- [ ] Prevent stale vehicle markers from appearing live
- [ ] Update route detail ETA logic to choose relevant approaching vehicle(s)

### Phase 2 — Hardware foundation **P0**

- [x] Define hardware/device architecture in this master plan
- [ ] Add `jeepney_gps_devices`
- [ ] Add `jeepney_device_assignments`
- [ ] Extend normalized position metadata
- [ ] Add server-side `/api/telematics/v1/ingest`
- [ ] Add hashed device-secret authentication
- [ ] Add device heartbeat/health update
- [ ] Preserve legacy phone tracking

### Phase 3 — Vehicle / route decoupling **P1**

- [ ] Treat vehicle as permanent fleet asset
- [ ] Use active trip for current route assignment
- [ ] Keep temporary compatibility with legacy `jeepney_vehicles.route_id`
- [ ] Add route direction / route variants
- [ ] Add trip lifecycle suitable for hardware auto-tracking

### Phase 4 — Fleet control **P1**

- [ ] Cooperative organization/fleet structure
- [ ] Dispatcher dashboard
- [ ] Vehicle/device health board
- [ ] Headway and bunching detection
- [ ] Route deviation
- [ ] Offline tracker alerts
- [ ] Shift/trip reports

### Phase 5 — Hardware adapters **P1**

- [ ] Generic JSON/webhook adapter
- [ ] TOPFLYtech protocol adapter
- [ ] Jimi/Concox adapter
- [ ] Teltonika adapter
- [ ] Queclink adapter
- [ ] Existing cooperative vendor API connector

### Phase 6 — Compliance / pilot **P1**

- [ ] Hardware RFQs
- [ ] Sample-device bench testing
- [ ] NTC status review
- [ ] LTFRB technical compliance matrix
- [ ] Pilot cooperative agreement
- [ ] Install 5–25 units
- [ ] Measure uptime, accuracy, cellular coverage and data usage

### Phase 7 — Open transit data / government integrations **P2**

- [ ] GTFS static export
- [ ] GTFS-Realtime VehiclePositions
- [ ] GTFS-Realtime TripUpdates
- [ ] Partner API keys / scopes
- [ ] LTFRB/LGU read-only dashboard
- [ ] Audit/export tooling

---

## 14. Immediate implementation queue

These are the next engineering actions in order:

1. **Create hardware tables and normalized telemetry fields.**
2. **Create secure server-side telemetry ingest endpoint.**
3. **Refactor public live map to keep all active vehicle positions.**
4. Refactor route detail to show the next multiple approaching jeepneys.
5. Add device provisioning UI for admins/operators.
6. Add fleet device-health dashboard.
7. Refactor route status transitions so publication/verification is server/admin controlled while breakdown reporting remains usable.
8. Start vendor protocol adapters once sample device/protocol documentation is obtained.

---

## 15. Implementation log

### 2026-08-17

- Audited current Jeepney feature branch.
- Confirmed existing phone GPS, trips, realtime positions, route claims, analytics, congestion and device request foundations.
- Confirmed one-live-marker-per-route limitation.
- Established device-agnostic target architecture.
- Established DOTr/LTFRB/LTO/NTC regulatory workstream.
- Created this master build document.
- **Next commit:** hardware/device schema + telemetry ingest MVP.

---

## 16. Definition of success for first real pilot

A successful pilot is not merely a moving marker.

For a 5–25 vehicle pilot, Barangay Buddy should demonstrate:

- >99% accepted telemetry while cellular service is available;
- offline buffering/resend behavior documented;
- all simultaneously active jeepneys visible independently;
- tracker identity tied to an installed vehicle;
- secure device credentials with revocation;
- accurate route/trip association;
- stale/offline status detection;
- useful rider ETA ranges;
- operator fleet visibility;
- daily trip/service reports;
- documented NTC/LTFRB compliance status for the exact hardware SKU used;
- data-retention and privacy controls documented.

That becomes the evidence package for larger cooperative and government discussions.
