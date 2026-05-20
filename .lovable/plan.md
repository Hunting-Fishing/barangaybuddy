## Goal

Replace the generic MapPin icon next to every region, province, and city/municipality with its official flag or seal, sourced from Wikimedia Commons (matching the page you linked).

## What gets built

### 1. Database

Add a nullable `flag_url TEXT` column to each of:
- `regions`
- `provinces`
- `cities_municipalities`

Stores the public URL of the flag image hosted in Lovable Cloud storage. Nullable so the UI can fall back to MapPin when a flag isn't found yet.

### 2. Storage

Create a public bucket `locality-flags` with three folders:
```
locality-flags/
  regions/{slug}.{png|svg}
  provinces/{slug}.{png|svg}
  cities/{slug}.{png|svg}
```
Public read; no client writes (scraper uses service role).

### 3. One-time scraper script

A Node script at `scripts/scrape-flags.ts` (run locally / on demand, not in the browser):

1. Read all rows from `regions`, `provinces`, `cities_municipalities`.
2. For each row, query the Wikipedia REST API + MediaWiki API to resolve the article (e.g. "Cebu City", "Province of Cebu", "Bicol Region") and pull the `pageimage` / infobox flag/seal file. Falls back to Wikimedia Commons `Special:Search` with the locality name + "flag"/"seal" if the page has none.
3. Download the original raster (PNG preferred; SVG converted to PNG with sharp at 256px wide for consistency and small bundle size).
4. Upload to `locality-flags/<level>/<slug>.png` via the Supabase admin client.
5. Update the corresponding row's `flag_url`.
6. Rate-limited (Wikimedia asks ≤200 req/s, we'll do ~5/s) with a resumable manifest so it can be re-run for failures only.

Expected coverage: ~100% for regions and provinces, ~70–90% for the 1,647 cities & municipalities — the rest stay `null` and show MapPin. The script logs misses to `scripts/flag-misses.json` for manual follow-up.

The full crawl will take ~10–15 minutes. It's idempotent: re-running only re-fetches rows where `flag_url IS NULL` (or where `--force` is passed).

### 4. UI changes

A new shared component `src/components/locality-flag.tsx`:
```tsx
<LocalityFlag src={r.flag_url} name={r.name} size={48} />
```
- Renders the flag inside the existing gradient/rounded container.
- Falls back to the `MapPin` icon when `src` is null or the image errors.
- `loading="lazy"`, `decoding="async"`, fixed aspect to avoid CLS.

Replace MapPin usage in:
- `src/routes/regions.index.tsx` — region cards
- `src/routes/regions.$region.tsx` — province cards
- `src/routes/provinces.$province.tsx` — city cards
- `src/routes/cities.$city.tsx` — page header next to the city name
- `src/routes/index.tsx` — homepage featured regions (if it shows them)

Queries in each route are updated to include `flag_url` in the `select(...)` (currently `select("*")` already covers it after the column is added).

`PhRegionMap` keeps the label-based hotspots as-is — flags would clutter the map at that scale.

### 5. Attribution

Wikimedia Commons requires attribution. Add a small "Flags & seals via Wikimedia Commons" line to `site-footer.tsx` linking to https://commons.wikimedia.org/wiki/Flags_of_cities_and_municipalities_in_the_Philippines.

## Out of scope

- Barangay flags (no consistent Wikimedia coverage).
- An admin UI to upload/override flags — the scraper + miss-log is enough for v1.
- Hotlinking from upload.wikimedia.org (rejected in your earlier answer).

## Order of operations

1. Migration: add `flag_url` columns + create `locality-flags` bucket + public read policy.
2. Build `LocalityFlag` component and wire it into the 5 routes (renders MapPin fallback until the scraper populates URLs — site keeps working throughout).
3. Add scraper script + run it once. Report coverage stats and any noteworthy gaps.
4. Add the Commons attribution line in the footer.
