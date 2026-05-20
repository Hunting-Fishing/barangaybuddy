
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS flag_url TEXT;
ALTER TABLE public.provinces ADD COLUMN IF NOT EXISTS flag_url TEXT;
ALTER TABLE public.cities_municipalities ADD COLUMN IF NOT EXISTS flag_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('locality-flags', 'locality-flags', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read locality flags"
ON storage.objects FOR SELECT
USING (bucket_id = 'locality-flags');
