## Goal

Fill the remaining ~435 null `flag_url` rows in `cities_municipalities` by re-running the existing idempotent scraper.

## Steps

1. Confirm current coverage with `SELECT count(*) FILTER (WHERE flag_url IS NULL), count(*) FROM cities_municipalities;`.
2. Launch `bun scripts/scrape-flags.ts --level=cities` in the background via `nohup ... > /tmp/flags.log 2>&1 &` so it survives the 10-minute exec timeout. Poll the log + DB count periodically.
3. Repeat additional background passes until two consecutive passes add fewer than 10 new flags (expected ~2–3 more passes).
4. Read final `scripts/flag-misses-cities.json` to summarize legitimate misses (LGUs with no official Wikipedia flag/seal — these keep the `MapPin` fallback handled by `LocalityFlag`).
5. Report final coverage stats (X / 1647 flagged, Y misses) and note any patterns (small municipalities, NCR districts, recently-created LGUs).

## Out of scope

- No code, schema, UI, or component changes.
- No barangay-level scraping.
- No manual per-LGU overrides for misses.
