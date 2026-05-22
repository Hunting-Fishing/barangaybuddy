# Why the map is empty

The database has 0 fuel stations with coordinates. The DOE sync we built only writes per-brand price snapshots (e.g. "Shell · Diesel · NCR · ₱65.20") to `fuel_price_snapshots`. It never wrote station rows to `businesses` — that step was left as a "future expansion" comment. The map queries `businesses WHERE type='fuel_station' AND latitude IS NOT NULL` and gets nothing.

# Fix: pull stations from OpenStreetMap

OSM is the only legal, free, lat/lng-complete source for Philippine fuel stations. Overpass API returns the whole country in one query, ~6–10k stations, no API key, ODbL license with attribution.

## 1. Server importer — `src/lib/fuel-import.server.ts`

Add `runStationSync()`:

- Query Overpass:
  `[out:json][timeout:120]; area["ISO3166-1"="PH"]->.ph; (node["amenity"="fuel"](area.ph); way["amenity"="fuel"](area.ph);); out center tags;`
- Map each element → `businesses` row:
  - `name` = `tags.name` || `${brand} station` || "Unnamed station"
  - `brand` = title-cased `tags.brand`
  - `latitude` / `longitude` (use `center` for `way` elements)
  - `address` = `tags["addr:full"]` or assembled from `addr:housenumber / street / city / province`
  - `type='fuel_station'`, `is_published=true`, `owner_id=null`
  - `imported_from='osm'`, `import_source_id='osm:<type>:<id>'`
- Bulk upsert in chunks of 500 on the existing unique index `(imported_from, import_source_id)`.
- Log to `fuel_import_runs` with `source='osm'`, counts, errors.
- Fallback Overpass mirror on 429/5xx: `overpass.kumi.systems`.

## 2. Hook — `src/routes/api/public/hooks/fuel-stations-sync.ts`

New `POST` route, same `apikey` header check as the price hook, calls `runStationSync()` and returns `{ ok, upserted, errors }`. Kept separate from price sync because it's heavier and only needs weekly cadence.

## 3. Cron — new migration

Add weekly `pg_cron` job (Sundays 03:00 PHT = `0 19 * * 6` UTC) that POSTs to the new hook via `pg_net`, alongside the existing 5 AM / 6 PM price jobs.

## 4. UI — `src/routes/fuel.tsx`

- Add a "Refresh stations from OSM" button next to the existing "Refresh now" prices button. Shows toast with upserted count.
- Add a small `Stations: © OpenStreetMap contributors (ODbL)` attribution line under the map.

## 5. First run

Call the new hook once right after the migration deploys so pins appear immediately — don't wait until Sunday.

## Technical notes

- `out center` gives a centroid for polygon-mapped stations (`way` elements) so every result has coordinates.
- Brand normalization (title-case) keeps "shell" / "Shell" / "SHELL" as one brand and lines up with the brand strings already in `fuel_price_snapshots`, enabling a later popup enhancement: when a station has no community price, show its brand's DOE regional price as a fallback.
- Idempotent: weekly re-runs upsert by `(imported_from, import_source_id)`, so renamed/moved stations update in place without duplicates.
- No new secrets. Overpass is keyless.

## Out of scope (say the word if you want it)

- Showing DOE brand+region price in the popup when no community price exists.
- Deduping OSM stations against user-submitted stations by proximity (same lat/lng within 50 m + same brand).
- Importing the DOE LFRO list as a secondary source (no coords, would need geocoding — much slower, lower quality).
