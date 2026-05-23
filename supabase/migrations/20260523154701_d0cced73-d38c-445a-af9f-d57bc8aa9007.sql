
CREATE TABLE IF NOT EXISTS public.business_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL,
  businesses_upserted integer NOT NULL DEFAULT 0,
  total_fetched integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.business_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read business import runs"
  ON public.business_import_runs FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS business_import_runs_started_idx
  ON public.business_import_runs (started_at DESC);
