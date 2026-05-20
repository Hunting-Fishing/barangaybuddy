## Goal

Upgrade the existing Barangay detail page (`/barangays/$city/$barangay`) so visitors can (1) see every store, service, restaurant, and food vendor in that barangay on a map, and (2) browse a **fair, comparable product listings feed** where multiple sellers can list the same item with different pack sizes/weights/quantities — automatically normalized to a **price-per-each** and **price-per-unit (kg/L/pc)** so shoppers can instantly tell which deal is best.

Fuel stations stay on `/fuel` as before (they have their own price-reporting model).

---

## What changes

### 1. Map of businesses in the barangay

Add an interactive map at the top of the page showing every published business with `latitude`/`longitude` set, color-coded by type (store / service / restaurant / food vendor). Clicking a pin opens a popup with the business name, type, and a link to its page. Businesses without coordinates are listed below the map with a "Pin location" prompt for owners.

Library: **Leaflet + OpenStreetMap tiles** (free, no API key, lightweight, works on edge SSR via client-only mount).

### 2. "Fair listings" comparison feed (the main new section)

A second tab area below the map: **Products in this barangay**, grouped by normalized product name (e.g. all "Chocolate bar" listings from any store in the barangay shown together), sorted by **per-each price ascending** so the best deal is at the top.

Each listing row shows:

```
[img]  Hershey's Milk Chocolate · 10-pack · 35 g each
       Sari-Sari ni Aling Nena                 ₱150.00
       ₱15.00 / ea   ·   ₱428.57 / kg          [best deal]
```

The "best deal" badge is awarded to the lowest per-each price in that product group.

### 3. New listing form fields (for business owners)

When an owner adds/edits a listing on their dashboard, they now fill in:

- **Product name** (free text, used for grouping — fuzzy normalized: lowercased, trimmed, punctuation stripped)
- **Category** (existing)
- **Total price** (existing — the price for the whole pack as sold)
- **Pack quantity** — how many individual pieces are in the pack (default 1; e.g. 10 for a 10-pack)
- **Size per piece** + **size unit** — optional; e.g. `35` + `g`. Units allowed: `g`, `kg`, `ml`, `L`, `pc`
- **Description, image, in stock** (existing)

The UI computes and displays a live preview of per-each and per-unit price while typing so the owner sees exactly what shoppers will see.

### 4. Per-each / per-unit math (single source of truth)

A pure helper `computeUnitPrice(price, packQty, sizeValue, sizeUnit)` returns:

- `perEach = price / packQty`
- `perUnit` normalized to a base unit (g → kg, ml → L, pc stays pc) so a 10-pack of 35 g bars at ₱150 becomes `₱428.57 / kg`

Used identically on the dashboard preview and on the public listings feed — no drift.

---

## Technical details

### Database migration

Add columns to `public.listings` (all nullable / defaulted so existing rows keep working):

- `pack_qty integer NOT NULL DEFAULT 1` — number of pieces in the pack
- `size_value numeric` — size of one piece (nullable)
- `size_unit text` — one of `g`, `kg`, `ml`, `L`, `pc` (nullable; CHECK constraint via trigger — not a CHECK on a mutable expression, but a simple immutable enum check is fine here)
- `normalized_name text` — lowercased, punctuation-stripped product name, maintained by a `BEFORE INSERT/UPDATE` trigger from `name`; used for grouping
- Index on `(normalized_name)` for grouping queries
- Index on `businesses(barangay_code, is_published)` if not already present, to speed up the page's business fetch

Existing RLS policies on `listings` already cover owner-managed writes + public reads — no policy changes needed.

### Map component

New `src/components/business-map.tsx`:

- Client-only (dynamically imported with `ssr: false` pattern — wrap in `useEffect` mount guard since this stack uses TanStack Start, not Next.js)
- Centers on the average lat/lng of pins, or on the barangay centroid fallback
- Uses Leaflet's default OSM tile layer; type-colored circle markers
- Bundles its own CSS import

Install: `bun add leaflet @types/leaflet`

### Listings feed component

New `src/components/barangay-listings-feed.tsx`:

- Fetches all `listings` for businesses in this barangay in one query (join via `business_id` → `businesses.barangay_code`)
- Groups client-side by `normalized_name`
- For each group: sort by `perEach` asc, mark cheapest with "Best deal" badge
- Search box to filter by product name
- Category filter chips

### Helper

New `src/lib/unit-price.ts` with `computeUnitPrice` + `formatUnitPrice` (returns strings like `₱15.00 / ea`, `₱428.57 / kg`). Pure, fully unit-testable.

### Dashboard listing editor

Update `src/routes/dashboard.business.$id.tsx` (or wherever the listing form lives — will verify during implementation) to include the new fields and the live per-each / per-unit preview.

### Page layout

`src/routes/barangays.$city.$barangay.tsx` becomes:

```
Breadcrumb
H1: Barangay <name>
[Map of businesses]
Tabs:
  [Products]  ← new, default
  [Stores] [Services] [Restaurants] [Food vendors] [Fuel]
```

The existing per-type business grids stay as-is.

---

## Out of scope (call out, don't build)

- Owner-submitted price corrections / voting on listings (fuel already has this; could come later for products)
- Photos per listing variant
- Stock levels beyond the existing `in_stock` boolean
- Geocoding addresses to lat/lng automatically — owners pin manually for now

---

## Files touched

- **Migration**: add columns + trigger + indexes on `listings`
- **New** `src/lib/unit-price.ts`
- **New** `src/components/business-map.tsx`
- **New** `src/components/barangay-listings-feed.tsx`
- **Edit** `src/routes/barangays.$city.$barangay.tsx` — add map + Products tab
- **Edit** `src/routes/dashboard.business.$id.tsx` — extend listing form
- **Install** `leaflet`, `@types/leaflet`
