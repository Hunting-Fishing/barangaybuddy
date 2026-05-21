## Why both links failed

**Google link** — it's a *directions* URL (`/maps?...&daddr=5Q4J+X5W+Brgy,+Piddig,+Ilocos+Norte`), not a place URL. Our `extractPlaceQuery` doesn't know about `daddr=` or `destination=`, so it falls through and sends the entire 800-character URL to the Places `searchText` API, which returns nothing.

**Facebook link** — `facebook.com/profile.php?id=…` rendered through Firecrawl hits the JS login wall and returns under 50 characters of markdown, which trips our "no readable content" guard. This is a well-known Facebook quirk.

## Fixes

### 1. Smarter Google URL parsing (`src/lib/imports.server.ts` → `extractPlaceQuery`)

Recognize these patterns in order:
- `place_id` / `cid` query param → use as place ID (already works)
- `/place/{name}` path → already works
- `/maps/dir/.../{destination}` path segment (Google directions short form)
- `daddr=` or `destination=` query param (Google directions long form) → use that as text query
- `q=` / `query=` (already works)
- Plus Code in the URL (e.g. `5Q4J+X5W Brgy, Piddig, Ilocos Norte`) → pass straight to `searchText`
- Fall back to the URL only if nothing else matched, AND truncate it to a reasonable length so the Places API doesn't choke

### 2. Reliable Facebook fetch (`fetchScrape` for Facebook)

When the source is `facebook`:
- Rewrite the URL host to `mbasic.facebook.com` (mobile-basic, no JS, no login redirect for public pages). `profile.php?id=…` works there as-is.
- Bump `waitFor` to ~3000ms and turn off `onlyMainContent` for FB so the page header / About text isn't stripped.
- If the rewrite still returns under 50 chars of markdown, retry once against `m.facebook.com`.

### 3. Better error UX (`previewImport` in `src/lib/imports.functions.ts`)

Today when all sources fail we throw one generic line. Change it to report **per-link reasons** so the user can see "Google: directions link, please paste a place link" vs "Facebook: page is private or login-walled". This makes the next attempt obvious instead of guesswork.

### 4. Hint on the Google input row (`src/components/business-import-dialog.tsx`)

Add a one-line helper under the Google input: *"Paste the place link, not a directions link — open the business on Google Maps and tap Share."* No other UI changes.

## What I won't touch

- The Gemini extraction prompt, schema, catalog growth, claim flow, or any other source (IG / X / TikTok / LinkedIn / YT / Yelp / website) — they're unrelated to this failure.
- No database migration. No new dependencies.

## Verify

After the change I'll re-run the user's exact two URLs via `invoke-server-function` against the `previewImport` endpoint and confirm:
- The Google directions URL either resolves to the right place (Piddig, Ilocos Norte) or returns a clear "this is a directions link" error.
- The Facebook profile URL returns ≥50 chars of markdown and feeds Gemini successfully.