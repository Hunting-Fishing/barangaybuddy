# Barangay Buddy — External Jeepney Telematics Gateway Contract

This document defines the normalized server-to-server contract for connecting existing cooperative GPS platforms, OEM telematics feeds, or vendor protocol decoders to Barangay Buddy.

## Architecture

`Vendor tracker / OEM unit → vendor cloud or protocol decoder → Barangay Buddy gateway-ingest-v2 → physical fleet vehicle → active trip → route + direction variant → public rider position`

The upstream system does **not** choose the public route directly. It identifies the physical vehicle. Barangay Buddy Fleet Dispatch remains authoritative for the current trip, route and direction.

---

## 1. Provision a gateway

Barangay Buddy administrators provision gateways at:

`/jeepney/admin/gateways`

Provisioning returns:

- Gateway public ID, e.g. `bbgw_...`
- one-time 256-bit gateway secret
- atomic ingest path: `/api/telematics/v1/gateway-ingest-v2`

Only the SHA-256 secret hash is stored by Barangay Buddy. The raw secret must be stored by the upstream adapter/vendor integration when it is shown.

Prefer an **operator-scoped gateway** for one cooperative. A global gateway should be used only for a trusted integration serving multiple operators.

---

## 2. Map external vehicle identities

Each upstream vehicle identifier is mapped to one Barangay Buddy physical fleet vehicle.

Examples of usable upstream identifiers:

- vendor vehicle ID
- tracker IMEI
- OEM telematics vehicle key
- cooperative internal fleet ID

Mapping is configured in `/jeepney/admin/gateways`.

The same installed hardware can serve different routes over time because the mapping points to the **vehicle**, not the route.

---

## 3. Atomic normalized ingest endpoint

### Endpoint

`POST /api/telematics/v1/gateway-ingest-v2`

### Required headers

```text
Content-Type: application/json
x-bb-gateway-id: bbgw_...
x-bb-gateway-secret: <one-time provisioned secret>
```

### Required payload

```json
{
  "external_vehicle_id": "vendor-unit-104",
  "sequence": "0000199921",
  "latitude": 18.196,
  "longitude": 120.592
}
```

### Recommended payload

```json
{
  "external_vehicle_id": "vendor-unit-104",
  "sequence": "0000199921",
  "latitude": 18.196,
  "longitude": 120.592,
  "speed_kph": 22.4,
  "heading": 181.2,
  "accuracy_m": 8,
  "event_type": "position",
  "recorded_at": "2026-08-17T14:45:12.000Z",
  "metadata": {
    "imei": "123456789012345",
    "ignition": true,
    "signal_dbm": -74,
    "adapter_version": "topflytech-1.0.0"
  }
}
```

`metadata` is private audit/context data and is capped at 8 KB. Do not put secrets, passwords, tokens, driver personal data, or unnecessary payloads inside it.

---

## 4. Sequence / idempotency requirement

`sequence` is mandatory.

It must be stable and unique for that upstream vehicle event. Good choices include:

- vendor packet sequence number
- tracker message ID
- upstream event UUID
- deterministic composite ID produced by the decoder

Barangay Buddy enforces uniqueness by:

`gateway + external_vehicle_id + sequence`

The atomic database finalizer reserves the sequence, inserts the public position, and completes the private receipt in one PostgreSQL transaction.

A replay returns the original position instead of creating another public GPS point.

Example replay response:

```json
{
  "accepted": true,
  "duplicate": true,
  "position_id": "...",
  "trip_id": "...",
  "route_id": "...",
  "route_variant_id": "..."
}
```

---

## 5. Operational authority

A gateway event is publishable only when all of these are valid:

1. gateway is active;
2. gateway credential is valid;
3. external vehicle ID is mapped and active;
4. mapped physical vehicle is active;
5. operator-scoped gateway and physical vehicle belong to the same operator;
6. vehicle has one open trip;
7. trip belongs to the same operator and vehicle;
8. trip route is published or suspended;
9. trip route variant/direction exists and is active.

The database atomic finalizer rechecks these invariants even though the HTTP endpoint already validated them.

If the vehicle has no active trip, the correct response is an operational conflict. Dispatch the vehicle before forwarding live telemetry.

---

## 6. Successful response

Example:

```json
{
  "accepted": true,
  "duplicate": false,
  "gateway_id": "bbgw_...",
  "provider": "TOPFLYtech decoder",
  "external_vehicle_id": "vendor-unit-104",
  "vehicle_id": "...",
  "trip_id": "...",
  "route_id": "...",
  "route_variant_id": "...",
  "direction": "inbound",
  "position_id": "...",
  "receipt_id": "...",
  "recorded_at": "2026-08-17T14:45:12.000Z",
  "server_received_at": "2026-08-17T14:45:12.542Z"
}
```

---

## 7. Expected status codes

### `200`
Accepted or duplicate replay accepted.

### `400`
Malformed payload, invalid timestamp, invalid coordinate, etc.

### `401`
Missing/invalid gateway credentials.

### `403`
Gateway is suspended or retired.

### `409`
Operational identity conflict, for example:

- external vehicle is not mapped;
- vehicle is inactive;
- no active trip exists;
- gateway/operator ownership mismatch;
- route/direction assignment is invalid.

### `413`
Private metadata exceeds 8 KB.

### `500/503`
Server/database failure. The upstream adapter should retry with the **same sequence** so the request remains idempotent.

---

## 8. Retry policy

Recommended adapter behavior:

- network timeout: retry same sequence
- HTTP 500/503: exponential backoff, same sequence
- HTTP 409: do not hot-loop; surface an operational mapping/dispatch alert
- HTTP 401/403: stop sending and alert integration administrator
- duplicate `200`: treat as successful delivery

Do not generate a new sequence when retrying the same underlying GPS event.

---

## 9. Reporting interval

Barangay Buddy can accept frequent updates, but the pilot target should remain approximately **10–15 seconds while moving** unless the regulatory/vendor integration requires another cadence.

Adapters should preserve device-recorded time in `recorded_at` and allow buffered events to be forwarded after temporary cellular loss. Historical/buffered events remain useful for analytics, while the rider app's freshness rule prevents stale points from being displayed as live.

---

## 10. Vendor adapter responsibility

A TOPFLYtech/Jimi/Teltonika/Queclink/cooperative adapter is responsible for translating the vendor protocol into this normalized contract.

Examples:

### TCP/UDP tracker decoder

`raw binary packet → validate checksum/protocol → identify IMEI → normalize GPS fields → POST gateway-ingest-v2`

### Existing cooperative REST API

`poll/webhook cooperative API → external vehicle ID → normalize lat/lng/speed/time → POST gateway-ingest-v2`

### OEM telematics

`OEM webhook/event → OEM vehicle key → normalize → POST gateway-ingest-v2`

Barangay Buddy does not require the upstream vendor to understand Barangay Buddy route IDs, stop IDs or route variants.

---

## 11. Security requirements

- HTTPS only in production.
- Never log raw gateway secret.
- Rotate gateway credential if upstream secret storage may have been exposed.
- Suspend gateway immediately during investigation.
- Retired gateways cannot be reactivated.
- Scope gateway to one operator whenever possible.
- Do not put driver legal identity or other unnecessary personal information into public positions or gateway metadata.

---

## 12. Smoke test

Use:

`scripts/jeepney-gateway-smoke.mjs`

Required environment variables:

```text
BB_BASE_URL
BB_GATEWAY_ID
BB_GATEWAY_SECRET
BB_EXTERNAL_VEHICLE_ID
```

Optional duplicate test:

```text
BB_TEST_DUPLICATE=1
```

The duplicate test should return `duplicate: true` and the same original `position_id`.

---

## 13. Database verification

After gateway migrations are applied, run:

`supabase/verification/jeepney_gateway_checks.sql`

Every `*_violations` result should be empty/zero before pilot use.

---

## 14. Current migration sequence for gateway support

Apply after the Phase 3/4 fleet/direction migrations:

1. `20260817231500_jeepney_telematics_gateways.sql`
2. `20260817231600_jeepney_gateway_atomic_ingest.sql`
3. `20260817231700_jeepney_gateway_atomic_guard.sql`

These are not considered deployed until they are applied and verified on the target Supabase project.
