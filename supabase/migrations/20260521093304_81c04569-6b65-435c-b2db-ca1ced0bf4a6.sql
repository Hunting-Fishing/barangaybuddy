
-- Allow imported businesses to have no owner
ALTER TABLE public.businesses ALTER COLUMN owner_id DROP NOT NULL;

-- Idempotent upsert key for imports
CREATE UNIQUE INDEX IF NOT EXISTS businesses_import_source_idx
  ON public.businesses (imported_from, import_source_id)
  WHERE imported_from IS NOT NULL AND import_source_id IS NOT NULL;

-- Public can also view imported (unowned) stations is already covered by is_published = true.

-- Official DOE price snapshots
CREATE TABLE IF NOT EXISTS public.fuel_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'doe',
  brand text NOT NULL,
  fuel_type text NOT NULL,
  region_code text,
  region_name text,
  price numeric(8,3) NOT NULL,
  snapshot_date date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, brand, fuel_type, region_code, snapshot_date)
);

ALTER TABLE public.fuel_price_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read price snapshots"
  ON public.fuel_price_snapshots FOR SELECT
  USING (true);

-- Import run log
CREATE TABLE IF NOT EXISTS public.fuel_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL,
  stations_upserted integer NOT NULL DEFAULT 0,
  prices_upserted integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.fuel_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read import runs"
  ON public.fuel_import_runs FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS fuel_price_snapshots_lookup_idx
  ON public.fuel_price_snapshots (snapshot_date DESC, region_code, brand, fuel_type);
