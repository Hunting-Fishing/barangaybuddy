## Goal

Let owners (1) add custom business types when the preset list doesn't fit (e.g. Bar, Pub, Billiards hall) and (2) tag their place with a large, PH-focused catalog of features (amenities, services, payments, dining modes, etc.).

## Changes

### 1. Custom "Other" types (free text)

The `businesses.type` column is a Postgres enum, so free text can't go there. Plan:

- Keep `type` (primary) and `additional_types` as enum-only.
- Add a new column `custom_types text[] not null default '{}'` on `businesses` for user-typed labels (e.g. "Bar", "Pub", "Billiards hall").
- In the dashboard form, add an "Other (type your own)" input with an "Add" button below the additional-categories grid. Entries appear as removable chips alongside the preset additional types.
- Validation: trim, dedupe (case-insensitive), max 30 chars each, max 10 entries, allow letters/numbers/spaces/&/-/'.
- On display (cards, listings), merge `type` + `additional_types` (labeled) + `custom_types` (raw) when showing categories.

### 2. Feature tags (massive PH-focused catalog)

The `businesses.tags text[]` column already exists. Plan:

- Define a curated `FEATURE_TAGS` catalog in `src/lib/business-tags.ts`, grouped by category, with stable slug + label. Proposed groups:

  - **Dining & service**: Dine-in, Take-out, Delivery, Drive-thru, Curbside pickup, Catering, Reservations, Walk-ins, Counter service, Table service, Buffet, Self-service, 24-hour
  - **Drinks & bar**: Full bar, Beer, Wine, Cocktails, Local spirits (Tanduay/Red Horse), Inumang Pinoy, Pulutan, Happy hour, BYOB
  - **Entertainment**: Billiards/Pool, Darts, Videoke/Karaoke, Live band, DJ, Acoustic nights, Beerpong, Board games, Arcade, Gaming PCs, Sports on TV, Cockfighting (sabong) viewing, Boxing/MMA nights
  - **Amenities**: Public restroom, Air-conditioned, Electric fan only, Free WiFi, Charging outlets, Parking, Motorcycle parking, Bike parking, Covered parking, Valet, CCTV, Smoking area, Non-smoking, Outdoor seating, Al fresco, Rooftop, Garden, Beachfront, Riverside
  - **Stay**: Overnight stay, Day-use rooms, Hourly rooms, Camping, Cottages, Cabanas
  - **Accessibility & family**: Wheelchair accessible, PWD ramp, Senior-friendly, Kid-friendly, High chairs, Play area, Pet-friendly, Breastfeeding area, Baby changing
  - **Payments**: Cash, GCash, Maya, Bank transfer, Credit/Debit card, COD, Installment, Suki/Lista (credit)
  - **Goods & services specific**: LPG refill, Water refill, Load/E-load, Padala/Remittance, Bills payment, Pera Padala, Printing/Xerox, Lamination, Internet café, ATM, ATM cash-in
  - **Fresh/market**: Live seafood, Fresh catch daily, Organic, Locally sourced, Halal, Vegetarian options, Vegan options
  - **Hours**: Open 24/7, Open early (before 6am), Open late (after 10pm), Sunday open, Holiday open
  - **Language/local**: Tagalog, English, Bisaya, Ilocano, Hiligaynon spoken

  (Final catalog finalized in implementation; ~100+ tags total.)

- Form UI under "Features & amenities":
  - Search input filtering tags by label
  - Collapsible group sections with Checkbox grid (2–3 cols)
  - Selected tags shown as removable chips above the picker
  - "Add custom tag" input for anything not in the catalog (same validation as custom types; stored mixed into `tags` array)
  - Limit ~50 tags per business

- Validation in `create`: `tags: z.array(z.string().trim().min(1).max(40)).max(50)`.

### 3. Files touched

- **Migration** — add `custom_types text[] not null default '{}'` to `businesses` (tags column already exists). GIN index on `custom_types`.
- **New** `src/lib/business-tags.ts` — `FEATURE_TAG_GROUPS`, `TAG_LABEL`, `slugifyCustom()`, helpers.
- **Edit** `src/routes/dashboard.tsx` — extend form state with `custom_types: string[]` and `tags: string[]`; add the Other-type input and the FeatureTagsPicker subcomponent; update Zod schema and insert payload.
- **New** `src/components/feature-tags-picker.tsx` — reusable picker (search + grouped checkboxes + chips + custom add).
- **Edit** `src/routes/dashboard.business.$id.tsx` — same picker + custom-types editor on the edit form (so existing businesses can update).
- **Edit** display surfaces that show categories — `barangay-listings-feed.tsx`, `business.$slug.tsx`, business cards on `dashboard.tsx` — to render `custom_types` chips and (where appropriate) top feature tags.

### 4. Out of scope (this turn)

- Filtering listings by tags on the barangay/search pages (can be a follow-up).
- Translating tag labels.
- Per-tag icons.

## Open question

The catalog above is large but opinionated. Want me to proceed with the full list as drafted, or trim/expand any group before I build it?
