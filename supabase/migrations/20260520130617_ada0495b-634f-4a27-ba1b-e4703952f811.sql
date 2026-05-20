ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS custom_types text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_businesses_custom_types ON public.businesses USING GIN (custom_types);
CREATE INDEX IF NOT EXISTS idx_businesses_tags ON public.businesses USING GIN (tags);