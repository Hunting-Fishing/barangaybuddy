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

- gateway public ID, e.g. `bbgw_...`;
- one-time 256-bit gateway secret;
- atomic ingest path: `/api/telematics/v1/gateway-ingest-v2`.

Only the SHA-256 secret hash is stored by Barangay Buddy. The raw secret must be stored by the upstream adapter/vendor integration when it is shown.

Prefer an **operator-scoped gateway** for one cooperative. A global gateway should be used only for a trusted integration serving multiple operators.

---

## 2. Map external vehicle identities

Each upstream vehicle identifier is mapped to one Barangay Buddy physical fleet vehicle.

Examples:

- vendor vehicle ID;
- tracker IMEI;
- OEM telematics vehicle key;
- cooperative internal fleet ID.

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

`sequence` is mandatory and must be stable/unique for the underlying upstream vehicle event.

Good choices:

- vendor packet sequence number;
- tracker message ID;
- upstream event UUID;
- deterministic composite ID produced by the decoder.

Barangay Buddy enforces uniqueness by:

`gateway + external_vehicle_id + sequence`

The atomic database finalizer reserves the sequence, inserts the public position, and completes the private receipt in one PostgreSQL transaction.

A replay returns the original immutable position/trip/direction identity instead of creating another public GPS point. An incomplete historical receipt fails closed and requires reconciliation rather than returning false success.

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

The database atomic finalizer rechecks these invariants even though the HTTP endpoint already validates them.

If the vehicle has no active trip, dispatch the vehicle before forwarding live telemetry.

---

## 6. Authenticated per-vehicle burst limit

After gateway authentication **and after the external vehicle ID resolves to an active mapping**, Barangay Buddy consumes one distributed rate slot for:

`gateway:<gateway UUID>:<external_vehicle_id>`

Default ceiling:

**300 authenticated requests/minute per mapped external vehicle**

That is roughly 5 requests/sec, intentionally much higher than the normal 10–15 second moving-report interval so buffered reconnect bursts can be forwarded quickly.

Important behavior:

- duplicate/replay requests count toward the ceiling;
- two mapped vehicles on the same gateway have independent buckets;
- unmapped external IDs do not allocate per-vehicle rate buckets;
- unauthenticated requests do not allocate rate buckets;
- exceeding the ceiling returns HTTP `429` with a `Retry-After` header.

Adapters must honor `Retry-After`; do not generate new sequence IDs merely because a request was rate-limited.

---

## 7. Successful response

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

## 8. Expected status codes

### `200`
Accepted or duplicate replay accepted.

### `400`
Malformed payload, invalid timestamp, invalid coordinate, etc.

### `401`
Missing/invalid gateway credentials.

### `403`
Gateway is suspended or retired.

### `409`
Operational identity conflict or incomplete historical receipt, for example:

- external vehicle is not mapped;
- vehicle is inactive;
- no active trip exists;
- gateway/operator ownership mismatch;
- route/direction assignment is invalid;
- old receipt exists without a completed public position.

### `413`
Private metadata exceeds 8 KB.

### `429`
Authenticated mapped vehicle exceeded its telemetry burst ceiling.

Example:

```json
{
  "error": "Telemetry rate limit exceeded",
  "retry_after_seconds": 24,
  "request_count": 301,
  "request_limit": 300
}
```

The response also includes `Retry-After`.

### `500/503`
Server/database failure. Retry with the **same sequence** so delivery remains idempotent.

---

## 9. Retry policy

Recommended adapter behavior:

- network timeout: retry same sequence;
- HTTP 500/503: exponential backoff, same sequence;
- HTTP 429: wait at least `Retry-After`, then retry same sequence;
- HTTP 409: do not hot-loop; surface an operational mapping/dispatch/reconciliation alert;
- HTTP 401/403: stop sending and alert integration administrator;
- duplicate `200`: treat as successful delivery.

Do not generate a new sequence when retrying the same underlying GPS event.

---

## 10. Reporting interval

Pilot target: approximately **10–15 seconds while moving** unless regulatory/vendor requirements dictate another cadence.

Adapters should preserve device-recorded time in `recorded_at` and forward buffered events after cellular loss. Historical events remain useful for analytics, while rider freshness rules prevent stale positions from displaying as live.

A vendor that can dump a large offline buffer should pace replay so one physical vehicle stays within the configured authenticated source ceiling.

---

## 11. Vendor adapter responsibility

A TOPFLYtech/Jimi/Teltonika/Queclink/cooperative adapter translates its native protocol into this normalized contract.

### TCP/UDP tracker decoder

`raw binary packet → checksum/protocol validation → IMEI → normalize → POST gateway-ingest-v2`

### Cooperative REST/API integration

`poll/webhook cooperative API → external vehicle ID → normalize → POST gateway-ingest-v2`

### OEM telematics

`OEM event → OEM vehicle key → normalize → POST gateway-ingest-v2`

Barangay Buddy does not require upstream vendors to understand Barangay Buddy route IDs, stop IDs or route variants.

---

## 12. Security requirements

- HTTPS only in production.
- Never log raw gateway secret.
- Rotate gateway credential if upstream secret storage may have been exposed.
- Suspend gateway immediately during investigation.
- Retired gateways cannot be reactivated.
- Scope gateway to one operator whenever possible.
- Do not place unnecessary driver/legal identity in public positions or private metadata.
- Treat HTTP 429 as flow control, not as a reason to discard sequence identity.

---

## 13. Smoke test

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

The duplicate test should return `duplicate: true` and the same original `position_id`/trip/direction identity.

Burst-limit testing is defined in `JEEPNEY_DEPLOYMENT_CHECKLIST.md`; it should be performed only against an authorized test/pilot environment.

---

## 14. Database verification

After migrations are applied, run:

`supabase/verification/jeepney_gateway_checks.sql`

Every `*_violations` result should be empty/zero before pilot use.

---

## 15. Migration notes

Gateway-specific foundation/safety migrations:

1. `20260817231500_jeepney_telematics_gateways.sql`
2. `20260817231600_jeepney_gateway_atomic_ingest.sql`
3. `20260817231700_jeepney_gateway_atomic_guard.sql`
4. `20260817231800_jeepney_gateway_mapping_safety.sql`

Shared telemetry burst control is added later in the global timestamp sequence by:

`20260817232100_jeepney_telematics_rate_limit.sql`

Always use the full migration order in `JEEPNEY_DEPLOYMENT_CHECKLIST.md`; these files are not considered deployed until applied and verified on the intended Barangay Buddy Supabase project.
