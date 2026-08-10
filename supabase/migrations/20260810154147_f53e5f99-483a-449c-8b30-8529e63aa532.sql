CREATE TABLE public.jeepney_route_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  push_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_route_follows TO authenticated;
GRANT ALL ON public.jeepney_route_follows TO service_role;

ALTER TABLE public.jeepney_route_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders manage their own route follows"
ON public.jeepney_route_follows FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER jeepney_route_follows_touch
BEFORE UPDATE ON public.jeepney_route_follows
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_route_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('breakdown','repaired')),
  headline text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jeepney_route_alerts_route_idx ON public.jeepney_route_alerts (route_id, created_at DESC);

GRANT SELECT ON public.jeepney_route_alerts TO anon;
GRANT SELECT ON public.jeepney_route_alerts TO authenticated;
GRANT ALL ON public.jeepney_route_alerts TO service_role;

ALTER TABLE public.jeepney_route_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read jeepney route alerts"
ON public.jeepney_route_alerts FOR SELECT TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION private.jeepney_route_status_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  note text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'suspended' THEN
      note := (
        SELECT trim(replace(line, '[BREAKDOWN]', ''))
        FROM unnest(string_to_array(coalesce(NEW.notes, ''), E'\n')) AS line
        WHERE line LIKE '%[BREAKDOWN]%'
        LIMIT 1
      );
      INSERT INTO public.jeepney_route_alerts (route_id, kind, headline, message)
      VALUES (NEW.id, 'breakdown', NEW.name || ' is out of service',
              coalesce(nullif(note, ''), 'The jeepney on this route has reported a breakdown.'));
    ELSIF OLD.status = 'suspended' AND NEW.status = 'published' THEN
      INSERT INTO public.jeepney_route_alerts (route_id, kind, headline, message)
      VALUES (NEW.id, 'repaired', NEW.name || ' is back in service',
              'A jeepney is serving this route again.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.jeepney_route_status_alert() FROM PUBLIC;

CREATE TRIGGER jeepney_routes_status_alert
AFTER UPDATE ON public.jeepney_routes
FOR EACH ROW EXECUTE FUNCTION private.jeepney_route_status_alert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.jeepney_route_alerts;