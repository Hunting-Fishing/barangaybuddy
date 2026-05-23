
## Goal
Auto-populate the barangay directory with Philippine businesses pulled from OpenStreetMap (OSM) via the free Overpass API. Runs nightly, publishes immediately as **unclaimed** so real owners can claim later — same pattern as the existing OSM fuel-station importer.

## How it works

```text
pg_cron (nightly 02:00 PHT)
  └─► POST /api/public/hooks/business-osm-sync
        └─► fetches OSM businesses by region (17 chunks)
              └─► geocodes each to nearest barangay (lat/lng)
                    └─► upserts into `businesses` (imported_from='osm')
```

### What we import from OSM
OSM tags we'll map to your `business_type` enum:
- `shop=*` → store / grocery / pharmacy / hardware / clothing …
- `amenity=restaurant|cafe|fast_food|bar|bakery` → restaurant / cafe
- `amenity=clinic|hospital|dentist|veterinary` → clinic / hospital
- `amenity=bank|atm|pharmacy|post_office` → service
- `office=*` → service
- `tourism=hotel|guest_house|hostel` → hotel
- anything unmapped → `other` with the OSM tag stored in `tags`

Per place we capture: name, lat/lng, address (street+number when present), phone, website, opening_hours, OSM id → `import_source_id`.

### Coverage strategy (avoids Overpass timeouts)
Overpass cannot return all PH businesses in one query. We chunk by the 17 **regions** (already in your `regions` table). The nightly job loops through regions sequentially with a 30s gap between calls — gentle on the public Overpass server, fully done in ~15–20 minutes.

### Barangay geocoding
For each OSM point we need a `barangay_code` (required column). Approach:
1. Build a Postgres function `nearest_barangay(lat, lng) → barangay_code` that uses a centroid lookup against `barangays` (we'll seed centroids from existing `businesses` data + a one-time PSGC centroid backfill, or fall back to the existing `OSM-UNRESOLVED` sentinel for points we can't place).
2. Simpler MVP fallback: use the existing `OSM-UNRESOLVED` sentinel barangay (already used by fuel-station importer) for v1, then refine later. **Recommend MVP first.**

### Dedupe & re-runs
Reuse the existing unique index `businesses_import_source_unique (imported_from, import_source_id)`. Nightly upsert refreshes name/phone/hours without creating duplicates. Owner-claimed rows (`is_claimed=true`, `owner_id` set) are skipped on update — we only refresh unclaimed OSM rows.

### Where they show up
- **Barangay directory** (`/barangays`, `/barangays/$city/$barangay`) — listed automatically because they have `is_published=true` and a `barangay_code`.
- **Search** page — already queries `businesses`.
- Each row shows an "Unclaimed — is this yours? Claim it" badge (reuses existing claim flow).

## Files

**New**
- `src/lib/business-osm-import.server.ts` — Overpass fetcher, tag→type mapper, upserter (mirrors `fuel-import.server.ts`)
- `src/routes/api/public/hooks/business-osm-sync.ts` — cron endpoint, loops regions, writes a row to `business_import_runs` for observability
- Migration: `business_import_runs` table (mirrors `fuel_import_runs`) for status/error tracking
- Migration: add `is_claimed` filter index + small "Unclaimed" badge component for cards

**Edited**
- `src/components/barangay-listings-feed.tsx` — show "Unclaimed" pill on OSM-imported rows
- `src/routes/dashboard.tsx` — add an admin-only "Run business OSM sync now" button + last-run status (so you don't have to wait for cron)

**Cron**
- pg_cron job `business-osm-sync-nightly` at `0 18 * * *` UTC (02:00 PHT) posting to the new endpoint with the project's anon key.

## Limitations to know

- **OSM coverage is patchy outside Metro Manila, Cebu, Davao**. Expect ~30–80k businesses nationwide (vs. millions in reality). Rural barangays will still be sparse — that's an OSM data limitation, not a code one.
- **No photos, no ratings** — OSM doesn't have them. Cards will use a placeholder image.
- Hours/phone present on only ~20–40% of OSM rows.
- First nightly run will insert tens of thousands of rows; subsequent runs are mostly no-op upserts.

## What I will NOT do
- No Facebook scraping (against ToS, blocked by FB).
- No Google Places (you chose free/OSM).
- No moderation queue (you chose publish-immediately).

Approve and I'll build it.
