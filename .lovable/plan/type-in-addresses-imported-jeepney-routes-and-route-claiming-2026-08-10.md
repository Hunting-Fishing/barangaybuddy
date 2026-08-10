# Type-in addresses, imported jeepney routes, and route claiming

## 1. Build a route by typing street names and addresses

Today a route can only be drawn by tapping the map or driving it. Adding a third way: typing.

On the Map tab of "Add a jeepney route", a new **Stops list** panel:

- A search box: "Type a street, landmark or address (e.g. Rizal St, Iloilo City)".
- Suggestions come from OpenStreetMap's free geocoder, biased to the Philippines.
- Picking a suggestion appends a numbered stop — **#1, #2, #3, #4…** — with its name and coordinates, drops a pin on the map, and extends the route line through it in order.
- Each row in the list can be renamed (e.g. "Palengke"), reordered by drag or up/down arrows, and deleted; numbers renumber automatically.
- Stops added by tapping the map get the same numbered rows, so both methods mix freely.
- A "Snap route to roads" toggle: when on, the line between numbered stops follows actual streets (free OSRM road router) instead of a straight line. Falls back to a straight line if routing is unavailable.

Result: a jeepney planner can lay out a whole loop by typing street names in order, without knowing anything about maps or coordinates.

## 2. Pre-loaded routes from public data

There is real, openly licensed jeepney data: OpenStreetMap has thousands of Philippine
public-transport relations tagged as jeepney / share_taxi / minibus routes, with names,
route numbers, the road path and stop positions. It is free to use with attribution
(ODbL) and we already pull OSM data through Overpass for fuel stations and businesses,
so the same pipeline applies. (Commercial feeds such as Sakay.ph are not openly
licensed, so they are out.)

- A nightly importer pulls every PH jeepney-type route relation from Overpass and upserts them as **unclaimed routes**: name, route code, path, stops, city.
- Imported routes appear on the rider map marked "Community route — from OpenStreetMap", with a note that times and fares are unconfirmed.
- Attribution line added to the jeepney pages.
- Admin "Run jeepney route sync now" button in the dashboard, matching the existing fuel/business sync buttons.

## 3. Claim a route

Any imported route (and any unclaimed route) gets a **Claim this route** button on the rider route page and in the operator portal.

The claim form asks for:
- Jeepney body/plate number and the LTFRB/franchise number shown on the vehicle
- A photo of the jeepney (upload or take with phone camera) clearly showing that number
- Optional second photo of the franchise/OR-CR document
- Operator or association name and contact number

Rules:
- Claims are **submitted as pending** — a claimant cannot approve themselves.
- An admin reviews the photo and number, then approves or rejects; approval transfers the route to that operator's portal, where they can edit times, fares and go live.
- A route can carry several jeepneys: once approved, the operator adds more vehicles with their own body numbers and photos.
- Rider route pages show "Operated by …" and the vehicle numbers running it.

## Technical notes

- Geocoding: Nominatim search proxied through a server function (`countrycodes=ph`, cached, rate-limit-respecting user agent). Road snapping: public OSRM `route/v1/driving` between consecutive stops, straight-line fallback.
- Stops already exist as `jeepney_stops` with a `position` column — the numbered list writes `position` 1..n; the form reuses it rather than a new table.
- Import: `src/lib/jeepney-osm-import.server.ts` + `/api/public/hooks/jeepney-routes-sync` on pg_cron nightly, mirroring `business-osm-import.server.ts`. Routes stored with `operator_id` null and a new `source`/`import_source_id` column, so `jeepney_routes.operator_id` becomes nullable and RLS gains public read for unclaimed community routes.
- New `jeepney_route_claims` table (route, user, body number, franchise number, photo paths, status, review notes) with grants, RLS (insert own, read own, admin read/update) and a status-forcing trigger so `pending` cannot be bypassed — same pattern as the group-team approval fix.
- New `jeepney_vehicles` rows gain photo + franchise number fields for post-approval vehicle adds.
- Photos go to a private storage bucket with owner-scoped policies; admins read via a server function.
- New components: `jeepney-stop-address-search.tsx`, `jeepney-stop-list.tsx`, `jeepney-claim-dialog.tsx`; admin review section on the existing dashboard.
