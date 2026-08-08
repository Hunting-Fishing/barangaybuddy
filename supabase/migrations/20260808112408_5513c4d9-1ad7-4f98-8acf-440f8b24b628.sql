CREATE TABLE public.fuel_price_outlooks (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_url text not null,
  fuel_type text not null,
  direction text not null,
  amount_per_liter numeric,
  effective_date date,
  note text,
  fetched_at timestamptz not null default now(),
  unique (source, fuel_type, effective_date)
);

GRANT SELECT ON public.fuel_price_outlooks TO anon, authenticated;
GRANT ALL ON public.fuel_price_outlooks TO service_role;

ALTER TABLE public.fuel_price_outlooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fuel outlook is public" ON public.fuel_price_outlooks FOR SELECT TO anon, authenticated USING (true);