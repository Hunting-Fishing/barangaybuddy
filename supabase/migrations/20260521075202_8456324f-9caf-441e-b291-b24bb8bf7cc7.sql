
-- Make owner_id nullable to allow unclaimed listings
ALTER TABLE public.businesses ALTER COLUMN owner_id DROP NOT NULL;

-- New columns for imported businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_claimed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS imported_from text,
  ADD COLUMN IF NOT EXISTS import_source_id text,
  ADD COLUMN IF NOT EXISTS website text;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_import_source_unique
  ON public.businesses (imported_from, import_source_id)
  WHERE imported_from IS NOT NULL AND import_source_id IS NOT NULL;

-- Drop & recreate RLS policies on businesses so unclaimed (owner_id NULL) rows are visible
DROP POLICY IF EXISTS "Public can view published businesses" ON public.businesses;
CREATE POLICY "Public can view published businesses" ON public.businesses
  FOR SELECT USING (
    is_published = true OR (auth.uid() IS NOT NULL AND auth.uid() = owner_id)
  );

-- Tag catalog (auto-grows from imports + manual entries)
CREATE TABLE IF NOT EXISTS public.tag_catalog (
  slug text PRIMARY KEY,
  label text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tag_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read tag catalog" ON public.tag_catalog FOR SELECT USING (true);

-- Custom-type catalog (auto-grows similarly)
CREATE TABLE IF NOT EXISTS public.custom_type_catalog (
  slug text PRIMARY KEY,
  label text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_type_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read custom-type catalog" ON public.custom_type_catalog FOR SELECT USING (true);

-- Business import audit log
DO $$ BEGIN
  CREATE TYPE public.business_import_source AS ENUM ('google', 'facebook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.business_import_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.business_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source public.business_import_source NOT NULL,
  source_url text NOT NULL,
  source_external_id text,
  raw_payload jsonb,
  extracted jsonb,
  status public.business_import_status NOT NULL DEFAULT 'pending',
  error text,
  created_by uuid,
  created_business_id uuid,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitter can read own imports" ON public.business_imports
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND auth.uid() = created_by)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Claim requests (Phase 2 hook; recorded today, resolved later)
CREATE TABLE IF NOT EXISTS public.claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own claim requests" ON public.claim_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own claim requests" ON public.claim_requests
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER tag_catalog_touch BEFORE UPDATE ON public.tag_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER custom_type_catalog_touch BEFORE UPDATE ON public.custom_type_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER business_imports_touch BEFORE UPDATE ON public.business_imports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
