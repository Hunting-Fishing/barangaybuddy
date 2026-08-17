# Barangay Buddy Jeepney Mobility — Pre-Merge Gates

**Do not merge PR #3 to production until every external validation and deployment gate below is cleared.**

## External validation blockers

- [ ] GitHub Actions can run, or equivalent local validation is completed.
- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm run lint` succeeds.
- [ ] `pnpm run build` succeeds.
- [ ] Authorized Supabase migration access is available.
- [ ] Database recovery/backup path is confirmed before migration.

## Database deployment

- [ ] Phase 3 fleet migrations applied in timestamp order.
- [ ] Phase 4 route-direction and variant-analytics migrations applied in timestamp order.
- [ ] Gateway migrations applied after Phase 3/4.
- [ ] `supabase/verification/jeepney_phase3_phase4_checks.sql` returns zero violations.
- [ ] `supabase/verification/jeepney_gateway_checks.sql` returns zero violations.

## Code integration gates

### Route-detail Arrival — CLEARED IN SOURCE

- [x] `/jeepney/$slug` uses `JeepneyArrivalSummary`.
- [x] Legacy route-wide `bestEta` calculation removed.
- [x] Existing fares, rentals, photos, schedules, calendar, alerts and claims preserved.
- [ ] Validate outbound and inbound Arrival behavior with real pilot trips.

### Variant-specific stop membership — CLEARED IN SOURCE

- [x] Rider ETA components load `jeepney_route_variant_stops`.
- [x] Configured stop membership/order is authoritative for that direction through `stopsForVariant()`.
- [x] Legacy/unconfigured variants keep geometric ordering fallback.
- [ ] Pilot-test an inbound direction that excludes at least one outbound-only stop.

### Fleet operations query cleanup — CLEARED

- [x] Removed the empty placeholder route-variant query and unused result.
- [ ] Lint/build still must validate the component.

### External gateway endpoint — CLEARED

- [x] Deleted the original non-atomic gateway ingest route.
- [x] Supported integrations use only `/api/telematics/v1/gateway-ingest-v2`.
- [x] v2 atomically reserves the sequence, inserts the rider position and completes the private receipt.
- [x] The database transaction revalidates gateway, mapping, physical vehicle, active trip, route and direction identity.

### Variant-specific congestion — CLEARED IN SOURCE

- [x] Added `jeepney_variant_segment_stats`, keyed by exact `route_variant_id + segment_index + hour`.
- [x] Preserved existing `jeepney_segment_stats` as canonical/default-direction compatibility data.
- [x] Analytics rollup projects each ping against its own route variant geometry.
- [x] Historical pre-variant pings are assigned only to the canonical/default direction.
- [x] Arrival and detailed live ETA read direction-specific historical speeds when available.
- [x] Missing/unavailable variant history safely falls back to existing canonical/live speed behavior.
- [ ] Run the rollup after migration and validate separate outbound/inbound speed buckets with pilot data.

## Pilot smoke tests

- [ ] Two physical jeepneys simultaneously live on one route.
- [ ] Same physical jeepney switches outbound → inbound through separate trips.
- [ ] Phone GPS produces vehicle + trip + route + variant identity.
- [ ] Hardwired GPS produces the same identity model.
- [ ] External gateway v2 produces the same identity model.
- [ ] Same gateway sequence replay returns `duplicate:true` with the original position.
- [ ] Unmapped external vehicle is rejected.
- [ ] Mapped vehicle without an active trip is rejected.
- [ ] Suspended/retired gateway is rejected.
- [ ] Inbound stop subset produces only eligible stop ETAs.
- [ ] Outbound/inbound historical congestion remains separated by route variant.
- [ ] Fleet board stale/off-route/bunching behavior is tested with pilot vehicles.
- [ ] Stale rider positions disappear after the freshness window.

## Generated-route note

New TanStack file routes are committed as source. `src/routeTree.gen.ts` is generated code and must not be hand-edited. A successful build must regenerate/validate it before production merge.

## Authoritative identity chain

`operator/cooperative → physical vehicle → tracker or external mapping → active trip → route + direction variant → normalized telemetry → rider/cooperative views`
