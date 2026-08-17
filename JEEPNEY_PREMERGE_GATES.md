# Barangay Buddy Jeepney Mobility — Pre-Merge Gates

This file is intentionally short and operational. **Do not merge PR #3 to production until every blocking item below is cleared.**

## External blockers

- [ ] GitHub Actions account/billing lock cleared so `Jeepney CI` can actually reach checkout.
- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm run lint` succeeds.
- [ ] `pnpm run build` succeeds.
- [ ] Supabase migration-management permission granted for target project `stwfpogxpfimyimdexqo`.
- [ ] Current production database backed up / recovery path confirmed.

## Database deployment

- [ ] Phase 3 fleet migrations applied in timestamp order.
- [ ] Phase 4 route-direction migrations applied in timestamp order.
- [ ] Gateway migrations applied after Phase 3/4:
  - `20260817231500_jeepney_telematics_gateways.sql`
  - `20260817231600_jeepney_gateway_atomic_ingest.sql`
  - `20260817231700_jeepney_gateway_atomic_guard.sql`
  - `20260817231800_jeepney_gateway_mapping_safety.sql`
- [ ] `supabase/verification/jeepney_phase3_phase4_checks.sql` returns zero violations.
- [ ] `supabase/verification/jeepney_gateway_checks.sql` returns zero violations.

## Known code integration gates

### 1. Route-detail top Arrival card — BLOCKING

The map and detailed live-unit list use route variants/directions. The legacy top-level Arrival card in `src/routes/jeepney.$slug.tsx` still uses the old route-wide/canonical calculation.

Prepared replacement:

`src/components/jeepney-arrival-summary.tsx`

Required safe change:

- import `JeepneyArrivalSummary` into `src/routes/jeepney.$slug.tsx`;
- replace only the legacy Arrival card;
- preserve fares, rentals, photos, day schedule, service calendar, alerts and all newer route-page work;
- validate outbound and inbound arrival behavior.

Do not perform a destructive whole-file overwrite merely to make this change.

### 2. Variant-specific stop membership — BLOCKING FOR FULL INBOUND CLAIM

The database and helper layer support `jeepney_route_variant_stops` and `stopsForVariant()`.

Current live list / arrival components still need final wiring to fetch memberships and call `stopsForVariant()` instead of relying only on the shared route stop set/geometric ordering.

Until that is done, do not claim that an inbound direction with a **different pickup subset** is fully represented in rider ETA.

### 3. Fleet operations lint cleanup — BLOCKING IF LINT CONFIRMS

`src/components/jeepney-fleet-operations.tsx` first version contains an unnecessary placeholder variant query/result in the initial Promise collection before it performs the real route-ID-scoped variant query.

Remove the placeholder/unused `variantResult` before production merge if ESLint reports it. Do not disable `no-unused-vars` project-wide.

### 4. Legacy external gateway endpoint — DO NOT USE FOR PILOT

`/api/telematics/v1/gateway-ingest` was the first implementation and writes public position then audit receipt separately.

New integrations must use:

`/api/telematics/v1/gateway-ingest-v2`

v2 calls the atomic PostgreSQL finalizer. The legacy v1 route should be deleted or changed to a clear deprecation/forwarding response once a safe file-level edit is available.

### 5. Variant-specific congestion analytics — NOT BLOCKING BASIC PILOT

Existing congestion segment stats are keyed to the canonical/default path. Inbound/custom ETA deliberately does **not** reuse those segment indexes.

Current safe behavior:

- default/canonical direction: historical segment speeds may be used;
- non-default direction: live speed/default ETA fallback.

Future:

- key segment stats by `route_variant_id`;
- calculate inbound/custom historical speeds independently.

## Pilot smoke tests

- [ ] Two physical jeepneys live simultaneously on one route.
- [ ] One physical jeepney switches outbound → inbound through separate trips.
- [ ] Phone GPS produces vehicle + trip + route + variant identity.
- [ ] Hardwired GPS produces the same identity model.
- [ ] External gateway v2 produces the same identity model.
- [ ] Same gateway sequence replay returns `duplicate:true` and original position ID.
- [ ] Unmapped external vehicle returns operational conflict.
- [ ] Mapped vehicle with no active trip returns operational conflict.
- [ ] Suspended/retired gateway is rejected.
- [ ] Off-route/bunching fleet board tested against real pilot vehicles.
- [ ] Stale public position disappears from live rider state after freshness window.

## Current authoritative model

`operator/cooperative → physical vehicle → [installed tracker OR external vendor mapping] → active trip → route + route variant/direction → normalized telemetry → rider/cooperative views`

The physical vehicle and hardware integration remain stable while the active trip changes route/direction.
