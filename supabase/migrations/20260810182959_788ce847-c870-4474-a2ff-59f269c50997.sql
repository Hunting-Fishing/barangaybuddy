-- 1. Community (unclaimed) routes
ALTER TABLE public.jeepney_routes ALTER COLUMN operator_id DROP NOT NULL;
ALTER TABLE public.jeepney_routes ADD COLUMN IF NOT EXISTS imported_from text;
ALTER TABLE public.jeepney_routes ADD COLUMN IF NOT EXISTS import_source_id text;
ALTER TABLE public.jeepney_routes ADD COLUMN IF NOT EXISTS source_url text;
CREATE UNIQUE INDEX IF NOT EXISTS jeepney_routes_import_uniq
  ON public.jeepney_routes (imported_from, import_source_id)
  WHERE imported_from IS NOT NULL AND import_source_id IS NOT NULL;

-- 2. Typed addresses on stops
ALTER TABLE public.jeepney_stops ADD COLUMN IF NOT EXISTS address text;

-- 3. Vehicle evidence
ALTER TABLE public.jeepney_vehicles ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.jeepney_vehicles ADD COLUMN IF NOT EXISTS franchise_number text;

-- 4. Route claims
CREATE TABLE IF NOT EXISTS public.jeepney_route_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_name text NOT NULL,
  contact_phone text,
  body_number text NOT NULL,
  franchise_number text,
  photo_path text NOT NULL,
  document_path text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.jeepney_route_claims TO authenticated;
GRANT ALL ON public.jeepney_route_claims TO service_role;

ALTER TABLE public.jeepney_route_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users submit own claims"
  ON public.jeepney_route_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own claims"
  ON public.jeepney_route_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins review claims"
  ON public.jeepney_route_claims FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION private.jeepney_claim_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_note := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can change a claim status';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.jeepney_claim_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS jeepney_claim_guard_trg ON public.jeepney_route_claims;
CREATE TRIGGER jeepney_claim_guard_trg
  BEFORE INSERT OR UPDATE ON public.jeepney_route_claims
  FOR EACH ROW EXECUTE FUNCTION private.jeepney_claim_guard();

-- 5. Import run log
CREATE TABLE IF NOT EXISTS public.jeepney_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'osm',
  status text NOT NULL DEFAULT 'running',
  routes_upserted integer NOT NULL DEFAULT 0,
  stops_upserted integer NOT NULL DEFAULT 0,
  total_fetched integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.jeepney_import_runs TO authenticated;
GRANT ALL ON public.jeepney_import_runs TO service_role;
ALTER TABLE public.jeepney_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read jeepney import runs"
  ON public.jeepney_import_runs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- 6. Private storage policies for claim evidence
CREATE POLICY "Claimants upload own jeepney evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'jeepney-claims' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Claimants read own jeepney evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'jeepney-claims' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 7. Nightly community route refresh (04:00 Manila = 20:00 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule('jeepney-routes-osm-sync') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'jeepney-routes-osm-sync'
);
SELECT cron.schedule(
  'jeepney-routes-osm-sync',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--be26f2e6-75d8-4129-a0d9-8a96d4b5652e.lovable.app/api/public/hooks/jeepney-routes-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-secret', current_setting('app.data_sync_secret', true)),
    body := '{}'::jsonb
  );
  $$
);