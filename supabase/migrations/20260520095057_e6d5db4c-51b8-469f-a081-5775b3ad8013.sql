
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS pack_qty integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS size_value numeric,
  ADD COLUMN IF NOT EXISTS size_unit text,
  ADD COLUMN IF NOT EXISTS normalized_name text;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_size_unit_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_size_unit_check
  CHECK (size_unit IS NULL OR size_unit IN ('g','kg','ml','L','pc'));

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_pack_qty_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_pack_qty_check CHECK (pack_qty >= 1);

CREATE OR REPLACE FUNCTION public.set_listing_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_name := lower(regexp_replace(coalesce(NEW.name,''), '[^a-zA-Z0-9]+', ' ', 'g'));
  NEW.normalized_name := trim(regexp_replace(NEW.normalized_name, '\s+', ' ', 'g'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listings_normalize_name ON public.listings;
CREATE TRIGGER trg_listings_normalize_name
BEFORE INSERT OR UPDATE OF name ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_listing_normalized_name();

UPDATE public.listings
SET normalized_name = trim(regexp_replace(lower(regexp_replace(coalesce(name,''), '[^a-zA-Z0-9]+', ' ', 'g')), '\s+', ' ', 'g'))
WHERE normalized_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_normalized_name ON public.listings(normalized_name);
CREATE INDEX IF NOT EXISTS idx_businesses_barangay_published ON public.businesses(barangay_code, is_published);
