CREATE TABLE public.jeepney_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.jeepney_operators(id) ON DELETE CASCADE,
  vehicle_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  distance_km NUMERIC,
  avg_speed_kph NUMERIC,
  ping_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX jeepney_trips_route_started_idx ON public.jeepney_trips (route_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_trips TO authenticated;
GRANT ALL ON public.jeepney_trips TO service_role;

ALTER TABLE public.jeepney_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage their own trips"
ON public.jeepney_trips FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = jeepney_trips.operator_id AND o.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = jeepney_trips.operator_id AND o.user_id = auth.uid()));

CREATE TABLE public.jeepney_route_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  bucket_type TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  ping_count INTEGER NOT NULL DEFAULT 0,
  trip_count INTEGER NOT NULL DEFAULT 0,
  avg_speed_kph NUMERIC,
  busy_score NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, bucket_type, bucket_key)
);

GRANT SELECT ON public.jeepney_route_stats TO anon;
GRANT SELECT ON public.jeepney_route_stats TO authenticated;
GRANT ALL ON public.jeepney_route_stats TO service_role;

ALTER TABLE public.jeepney_route_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stats for live routes"
ON public.jeepney_route_stats FOR SELECT
USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = jeepney_route_stats.route_id AND r.status IN ('published','suspended')));

CREATE POLICY "Operators read their own route stats"
ON public.jeepney_route_stats FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jeepney_routes r
  JOIN public.jeepney_operators o ON o.id = r.operator_id
  WHERE r.id = jeepney_route_stats.route_id AND o.user_id = auth.uid()
));

CREATE TABLE public.jeepney_segment_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  hour SMALLINT NOT NULL,
  avg_speed_kph NUMERIC,
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, segment_index, hour)
);

CREATE INDEX jeepney_segment_stats_route_hour_idx ON public.jeepney_segment_stats (route_id, hour);

GRANT SELECT ON public.jeepney_segment_stats TO anon;
GRANT SELECT ON public.jeepney_segment_stats TO authenticated;
GRANT ALL ON public.jeepney_segment_stats TO service_role;

ALTER TABLE public.jeepney_segment_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read segment speeds for live routes"
ON public.jeepney_segment_stats FOR SELECT
USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = jeepney_segment_stats.route_id AND r.status IN ('published','suspended')));

CREATE POLICY "Operators read their own segment speeds"
ON public.jeepney_segment_stats FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jeepney_routes r
  JOIN public.jeepney_operators o ON o.id = r.operator_id
  WHERE r.id = jeepney_segment_stats.route_id AND o.user_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.jeepney_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.jeepney_touch_updated_at() FROM PUBLIC;

CREATE TRIGGER update_jeepney_trips_updated_at
BEFORE UPDATE ON public.jeepney_trips
FOR EACH ROW EXECUTE FUNCTION public.jeepney_touch_updated_at();