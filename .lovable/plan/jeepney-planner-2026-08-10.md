# Jeepney Planner

A public route map for jeepneys, owned and maintained by the jeepney operators themselves, with schedule info and optional live tracking. Operators pay ₱100/month to keep their routes listed.

## What riders get (`/jeepney`)

- Full-screen map of jeepney routes drawn as coloured lines with stop pins, plus a searchable route list.
- Filter by city/barangay, route name/code, and "passes near me" using the rider's location.
- Route detail panel: operator name, fare, first run, last run, last pickup, trips per day, rough headway ("every ~20 min"), and the stop sequence with estimated times.
- Live layer: when an operator is broadcasting, a moving jeepney icon appears on the route with "arriving at your nearest stop in ~N min" (straight-line ETA along the route path, not turn-by-turn).
- Rider "notify me" is out of scope for v1 (see Out of scope).

## What operators get (`/jeepney/operator`)

- Register a jeepney route: name/code, city, fare, vehicle plate/body number, seats.
- Draw the route on the map by clicking waypoints (same pin-drop pattern already used for fuel stations), plus add named stops along it.
- Schedule fields: start time of first run, last run, last pickup, number of trips per day, operating days, average trip minutes.
- Status: draft → pending review → published. Only published + paid routes show on the public map.
- "Go live" button: starts GPS broadcasting from the operator's phone (browser geolocation `watchPosition`), pushing a position every ~15s while the tab is open. A clear on/off control and a battery/data warning.
- Subscription card: ₱100/month, Stripe checkout, status + renewal date, and a grace period badge when lapsed.

## Live tracking

- Phase 1 (this build): operator phone broadcasts via the browser while "on shift". Positions are written to a `jeepney_positions` table; riders subscribe with Realtime and see the marker move. Positions older than 5 minutes are treated as offline.
- Phase 2 (hardware): a "Request a tracker device" interest form on the operator page that records a lead. No device is sold or shipped yet — an ingest endpoint (`/api/public/hooks/jeepney-ping`, device-token authenticated) is built so a tracker can post to the same table later.

## Payments

Reuse the existing Stripe setup (`src/lib/stripe.server.ts`, `payments.functions.ts`, webhook at `/api/public/payments/webhook`). New recurring product: **Jeepney Operator Listing** — ₱100/month, quantity 1 per route. Webhook activates/renews `jeepney_subscriptions` and flips routes to visible; cancellation or failed payment moves the route to `unpaid` after a 7-day grace period. Manual GCash/Maya reference fallback stays available, matching the league flow.

## Database (one migration)

Enums: `jeepney_route_status` (draft, pending, published, suspended), `jeepney_sub_status` (trialing, active, past_due, cancelled).

Tables (RLS + GRANTs, public read only on published rows):
- `jeepney_operators` — user_id, display_name, contact_phone (kept in a private companion table like `group_team_contacts`), city_code, verified.
- `jeepney_routes` — operator_id, name, code, slug, city_code, fare_php, path (jsonb array of lat/lng), status, first_run, last_run, last_pickup, trips_per_day, operating_days, avg_trip_minutes, colour, timestamps.
- `jeepney_stops` — route_id, name, position index, lat/lng, offset_minutes.
- `jeepney_vehicles` — route_id, plate/body number, seats, active.
- `jeepney_positions` — route_id, vehicle_id, lat/lng, heading, speed, recorded_at (indexed, kept ~24h).
- `jeepney_subscriptions` — operator_id, route_id, status, current_period_end, stripe refs, amount_php.
- `jeepney_device_requests` — operator_id, quantity, note, status.

Public SELECT (anon) limited to published routes, their stops, and recent positions. Writes restricted to the owning operator; subscription rows written only by the webhook (service role).

## Files

**New**
- migration (schema + grants + policies)
- `src/lib/jeepney.ts`, `src/lib/jeepney.functions.ts`, `src/lib/jeepney.server.ts`
- `src/routes/jeepney.index.tsx`, `src/routes/jeepney.$slug.tsx`, `src/routes/jeepney.operator.tsx`
- `src/routes/api/public/hooks/jeepney-ping.ts`
- `src/components/jeepney-map.tsx` (Leaflet, client-only lazy load like `FuelMap`)
- `src/components/jeepney-route-editor.tsx` (waypoint + stop drawing)
- `src/components/jeepney-route-form.tsx`, `src/components/jeepney-live-toggle.tsx`, `src/components/jeepney-subscription-card.tsx`, `src/components/jeepney-device-request-dialog.tsx`

**Edited**
- `src/components/site-header.tsx` — "Jeepney" nav link
- `src/components/featured-carousel.tsx` — a Jeepney Planner slide
- `src/routes/dashboard.tsx` — "My jeepney routes" block
- webhook + payments helpers — handle the new monthly product

## Technical notes

- Map work stays inside `<ClientOnly>` with a lazy import so SSR doesn't touch Leaflet.
- Route paths are stored as simple lat/lng arrays and rendered with `L.polyline` — no routing engine call needed, since the operator draws the actual jeepney path.
- ETA is distance-along-path ÷ recent average speed, floored at a sensible minimum; shown as a range, never an exact minute.
- Every route gets its own `head()` with unique title/description/OG for shareable route links.

## Out of scope for v1

- Push/SMS arrival alerts to riders.
- Fare matrix per distance segment (single flat fare + optional "per km after 4km" note only).
- Selling/shipping tracker hardware — interest form only.
- Background tracking when the operator's phone screen is off (browser limitation; hardware phase solves it).
