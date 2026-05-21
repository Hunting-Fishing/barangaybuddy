## Goal
Auto-import Philippine fuel station locations and pump prices from the Department of Energy (DOE), refreshed twice daily (5:00 AM and 6:00 PM Manila time), and surface them on `/fuel`.

## Data sources (legal, attributed)
- **Stations**: DOE List of Filling/Retail Outlets (LFRO) — published dataset, public domain government data.
- **Prices**: DOE Oil Industry Management Bureau (OIMB) "Prevailing Retail Pump Prices" tables (Metro Manila + regional). Updated daily by DOE.
- Both will be fetched via the existing **Firecrawl** connector (DOE blocks plain fetch with Cloudflare; Firecrawl handles it) with clear "Source: DOE" attribution shown on `/fuel`.

## What gets built

### 1. Database (migration)
- New `fuel_stations_doe` table (or extend `businesses` with `imported_from='doe_lfro'` rows of `type='fuel_station'`). Plan uses `businesses` to keep one source of truth — adds a unique index on `(imported_from, import_source_id)` for idempotent upserts.
- New `fuel_price_snapshots` table for the official DOE prevailing price per `(brand, fuel_type, region, snapshot_date)` — kept separate from the crowdsourced `fuel_prices` table so user reports stay distinct from official figures.
- New `fuel_import_runs` table (run timestamp, source, status, rows_imported, error) for observability.

### 2. Server logic
- `src/lib/fuel-import.server.ts` — Firecrawl calls + parsers for the DOE LFRO list and OIMB price tables, plus an upsert routine using `supabaseAdmin`.
- `src/routes/api/public/hooks/fuel-sync.ts` — TanStack public server route. Validates an `apikey` header (Supabase anon key), then runs the import. Returns counts + errors.

### 3. Scheduling
- `pg_cron` + `pg_net` jobs:
  - `fuel-sync-morning` at `0 21 * * *` UTC (= 5:00 AM PHT)
  - `fuel-sync-evening` at `0 10 * * *` UTC (= 6:00 PM PHT)
- Both POST to `/api/public/hooks/fuel-sync` on the stable preview/published URL.

### 4. UI on `/fuel`
- New "Today's official DOE prices" section above the crowd-reported list (brand × fuel-type grid for the user's region).
- Station picker in "Report a price" already exists; once DOE stations land, the dropdown is populated nationwide.
- "Last synced" timestamp + small "Data: DOE" attribution badge.

## Open question (one)
DOE publishes per-brand "common posted prices" plus an Excel of week-on-week changes. The Excel is richer (per-station prices in NCR) but is a download, not a webpage. **Default plan = scrape the webpage tables (faster, twice-daily fresh).** Say the word if you want me to also pull the weekly NCR per-station Excel.

## Technical notes
- Times stored in UTC; cron uses UTC; UI renders PHT.
- Firecrawl key (`FIRECRAWL_API_KEY`) already in secrets — no new keys needed.
- Idempotent upserts so re-runs don't duplicate stations.
- Stations imported with `is_claimed=false`, `owner_id=null`, so local owners can later claim them.
