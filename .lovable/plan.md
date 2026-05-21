## Goal

Let anyone paste a Google Maps or Facebook Page URL and turn it into a draft business listing in seconds. Gemini reads the source, fills in name, location, categories, products and feature tags, and any brand-new tags/types are added to the global catalog so the directory keeps getting richer.

## How a user will experience it

1. New "Import a business" button on the homepage and dashboard, available logged-out and logged-in.
2. Modal asks for a Google Maps link **or** a Facebook page link, plus an optional note ("they sell halo-halo and lechon").
3. Progress states: *Fetching → Reading the page → Matching to a barangay → Saving draft*.
4. Result screen shows the parsed business with every field editable: name, type, additional types, custom types, tags, description, barangay, address, lat/lng, phone, hours, website, cover photo.
5. Submitter clicks **Publish as unclaimed** → listing goes live with a "Claim this business" badge. Logged-in users can also choose **Publish as mine** which sets `owner_id` to their user id.
6. Owner claim flow (Phase 2): on any unclaimed business page, a "Claim this listing" button starts Google Business Profile OAuth; if Google confirms they manage the place, we transfer `owner_id` to them.

## Sources

- **Google**: Google Places API (New) `places:searchText` + `places/v1/places/{id}` through the existing Google Maps connector. Pulls displayName, formattedAddress, location, types, primaryType, regularOpeningHours, internationalPhoneNumber, websiteUri, editorialSummary, photos, reviews snippets.
- **Facebook**: Firecrawl `scrape` (markdown + screenshot + branding) on the public page URL. Gemini reads the markdown to extract structured fields.
- **GBP OAuth (Phase 2)**: deferred until claim flow is built; not in this plan's first cut.

## Smart extraction with Gemini

A single server function calls Lovable AI (`google/gemini-3-flash-preview`) with structured output. It receives the raw payload from Google or Firecrawl plus the project's current `BUSINESS_TYPES` catalog and feature tag groups, and returns:

- `name`, `description`, `address`, `latitude`, `longitude`, `phone`, `email`, `website`, `hours`
- `type` (one of existing BUSINESS_TYPES)
- `additional_types` (subset of BUSINESS_TYPES)
- `custom_types` (free text — e.g. "bar", "pub", "sari-sari store")
- `tags` (slug list — reuses known feature tags, may invent new slugs)
- `products` (optional list for the listings table — name, price hint, unit)
- `confidence` per field, so the review UI can flag low-confidence ones

After extraction, the server:
- Snaps each new tag/custom type to canonical slug (`lower, hyphenated, dedup`) and tries to match it against existing tags first.
- For genuinely new slugs, inserts into a new `tag_catalog` table with `usage_count = 1` and `source = 'gemini'` (auto-grows the global catalog).
- For new custom types, inserts into a new `custom_type_catalog` table the same way.
- Resolves barangay by reverse-geocoding the lat/lng against `cities_municipalities` + `barangays` (nearest by name match + admin area from Google). If no confident match, leaves `barangay_code` blank and asks the submitter to pick.

## Database changes

Migration adds:
- `tag_catalog (slug PK, label, usage_count, source, first_seen_at)` — RLS: public read, no public write; writes only via server function using service role.
- `custom_type_catalog (slug PK, label, usage_count, source, first_seen_at)` — same RLS shape.
- `business_imports (id, source enum 'google'|'facebook', source_url, source_external_id, raw_payload jsonb, extracted jsonb, status enum 'pending'|'completed'|'failed', error, created_by nullable uuid, created_business_id nullable uuid, created_at)` — audit log; RLS: insert by anyone, select own + admins.
- `businesses` gets `is_claimed boolean default true`, `imported_from text`, `import_source_id text`. Existing rows stay claimed. New unclaimed listings have `owner_id` set to a dedicated `unclaimed-listings` service user so existing RLS keeps working without policy changes.
- A unique index `(imported_from, import_source_id)` prevents duplicate imports of the same Google place / FB page.

## Server functions (TanStack `createServerFn`, no edge functions)

`src/lib/imports.functions.ts`:
- `previewImport({ url, hint? })` — public (no auth required). Detects Google vs Facebook, fetches the source, runs Gemini, returns extracted payload + `importId`. Rate-limited per IP (10/hour).
- `commitImport({ importId, overrides, publish: 'unclaimed' | 'mine' })` — creates the business row, listings rows, bumps catalog counts, links to `business_imports`. `publish: 'mine'` requires auth.
- `claimBusiness({ businessId, googleVerificationToken })` — Phase 2 stub; returns "coming soon" for now.

`src/lib/imports.server.ts` holds the Google/Firecrawl fetchers, the Gemini prompt, slug normalization, and the barangay matcher. All secrets read inside handlers via `process.env`.

## UI

- New route `src/routes/import.tsx` — public landing for the importer with the URL input, a sample/demo link, and the review form.
- New component `BusinessImportDialog` mounted on `src/routes/index.tsx` (CTA in hero) and `src/routes/dashboard.tsx` (next to "Add a business").
- Review form reuses `FeatureTagsPicker` and the existing categories control from the dashboard so the look stays consistent.
- Unclaimed badge on `src/routes/business.$slug.tsx` with a "Claim this listing" button (Phase 2 hooks up; for now it opens a "we'll email you" form that records intent in a `claim_requests` table — minor add to the same migration).

## Secrets / connectors

- Google Places: already covered by the existing Google Maps connector — no new secret.
- Facebook scraping: needs the Firecrawl connector. I'll prompt for it during build via `standard_connectors--connect` (connector_id `firecrawl`).
- Gemini: uses `LOVABLE_API_KEY` (already set).

## Safety / quality guardrails

- Block import if the parsed business already exists (by `imported_from + import_source_id`, or by name + lat/lng within 50m).
- Rate-limit `previewImport` per IP using a small in-memory map plus a `business_imports` insert audit.
- Gemini is told to never invent contact details — if a field isn't in the source, return null.
- Tag/type auto-promotion has a cap: a brand-new slug only becomes searchable in the public filter once `usage_count >= 3` (the search route and feature picker will read from `tag_catalog`). Below that threshold the tag still attaches to the business but doesn't pollute the global picker — a light-touch version of moderation without blocking growth.
- All Gemini outputs are validated with Zod before writing to the DB.

## Out of scope for this plan (call out so we agree)

- Google Business Profile OAuth claim flow — scaffolded as a stub, full build is Phase 2.
- Bulk admin importer — not built; the per-URL flow is already "anyone can submit", so seeding can happen the same way.
- Photo import (Google place photos / FB cover) — first version only stores the URL of the first photo as `cover_image_url`; no re-hosting in storage yet.

## Technical details

- Stack: TanStack Start `createServerFn`, no Supabase Edge Functions.
- Gemini call: `streamText` not needed — use `generateText` + `Output.object` with a Zod schema for the extracted business.
- Google Places call goes through the gateway URL `https://connector-gateway.lovable.dev/google_maps/places/v1/...` with `X-Goog-FieldMask` to limit response size.
- Facebook scrape uses Firecrawl SDK `firecrawl.scrape(url, { formats: ['markdown', 'screenshot'] })` server-side only.
- New tables get `touch_updated_at` trigger and GIN indexes where relevant (`businesses.tags`, `tag_catalog.label trgm` for future fuzzy search).
- All new RLS policies follow the existing project pattern (public read on catalogs, owner-or-admin writes on imports).
