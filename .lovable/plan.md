## Goal

Make every region card on `/regions` open a richer **region detail page** (`/regions/$region`) that mirrors the navigation pattern used by [PhilAtlas](https://www.philatlas.com/regions.html): breadcrumb trail at the top, a summary stat block, and the next administrative layer (provinces) presented as both a quick grid and a sortable table — so users can drill down region → province → city → barangay smoothly.

## What changes

### 1. `/regions/$region` — full rebuild (PhilAtlas-style)

Currently it shows just a plain grid of provinces. We turn it into a structured profile page:

- **Breadcrumb**: `Home › Regions › {Region name}` (using shadcn `Breadcrumb`).
- **Hero block**:
  - Region name (display font, large)
  - Region code badge (e.g. "Region III", "NCR", "BARMM")
  - One-line description ("Administrative region in the Philippines")
- **Summary stats card** (4 tiles): provinces count · cities count · municipalities count · barangays count. Computed in a single query per region by joining `provinces → cities_municipalities → barangays`.
- **Provinces section** (the "next layer"):
  - Heading: "Provinces"
  - Card grid (current style, kept) — each card shows province name + small subtitle like "X cities · Y municipalities · Z barangays"
  - Cards link to `/provinces/$province` (already exists)
- **LGU table** (PhilAtlas-style, collapsible/optional below the grid):
  - Columns: Name · Type (Province / HUC) · Cities · Municipalities · Barangays
  - Uses shadcn `Table`
  - Sticky header, sortable by name
- Empty state if a region has no provinces yet.

### 2. `/regions` — minor polish

- Add the same breadcrumb at the top (`Home › Regions`).
- Keep both the interactive map and the card grid (unchanged).
- Region cards already link to `/regions/$region` — verify and keep.

### 3. Cascade the same pattern (lightweight)

To keep navigation consistent across the hierarchy, apply matching breadcrumb + summary header to:

- `/provinces/$province` — breadcrumb `Home › Regions › {Region} › {Province}`, summary "X cities & municipalities · Y barangays", existing city/municipality grid kept.
- `/cities/$city` — breadcrumb `Home › Regions › {Region} › {Province} › {City}`, summary "X barangays", existing barangay grid kept.

This gives users a clear path back up the chain at every level, matching how PhilAtlas lets you navigate region → province → city.

## Out of scope (can be a follow-up)

- Demographics / population / historical census data from PhilAtlas — our DB doesn't have those columns, so we won't fabricate them.
- Per-region maps highlighting just that region.
- Charts.

## Technical notes

- Aggregations done client-side with one batched query per page load:
  - On region page: fetch provinces for the region, then a single query `cities_municipalities` filtered by `province_code IN (...)`, then `barangays` filtered by `city_code IN (...)`. Group counts in JS.
  - 1647 cities and 42k barangays total, but per-region subsets are small enough for a single round-trip.
- Reuse existing shadcn primitives: `Breadcrumb`, `Card`, `Table`, `Badge`.
- No DB migrations needed — current PSGC tables already model the full hierarchy.
- No changes to fuel/voting/auth code.
