## Goal

Finish populating `cities_municipalities.flag_url` for the ~1,170 rows still null, using the existing `scripts/scrape-flags.ts` scraper.

## Approach

The scraper is idempotent — re-running with no flags refetches only rows where `flag_url IS NULL`. I'll run it in sequential passes against the cities level only, until coverage stops improving.

## Steps

1. Check current coverage: `SELECT count(*) FILTER (WHERE flag_url IS NULL), count(*) FROM cities_municipalities;` to confirm how many rows remain.
2. Run `bun scripts/scrape-flags.ts --level=cities` (each pass ≈10 min, processes whatever is still null).
3. Repeat until either coverage plateaus or two consecutive passes add <10 new flags.
4. After the final pass, read `scripts/flag-misses-cities.json` to summarize which LGUs have no official flag/seal on Wikipedia (these legitimately stay on the `MapPin` fallback — the `LocalityFlag` component already handles that).
5. Report final coverage stats (X/1647 flagged, Y misses) and call out any patterns in the misses (e.g. small municipalities, NCR districts, recently created LGUs).

## Out of scope

- No code, schema, or UI changes — the component, column, bucket, and attribution are already in place from the previous turn.
- No barangay-level scraping.
- No manual overrides for individual missing LGUs.
