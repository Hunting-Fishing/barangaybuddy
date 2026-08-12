-- 1. Landmark photos on stops
ALTER TABLE public.jeepney_stops ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Rental config on routes
ALTER TABLE public.jeepney_routes ADD COLUMN IF NOT EXISTS rental_available boolean NOT NULL DEFAULT false;
ALTER TABLE public.jeepney_routes ADD COLUMN IF NOT EXISTS rental_day_rate_php numeric;
ALTER TABLE public.jeepney_routes ADD COLUMN IF NOT EXISTS rental_note text;

-- 3. Per-day schedule grid
CREATE TABLE IF NOT EXISTS public.jeepney_day_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  day text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  first_run text,
  last_run text,
  last_pickup text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, day)
);
GRANT SELECT ON public.jeepney_day_schedule TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_day_schedule TO authenticated;
GRANT ALL ON public.jeepney_day_schedule TO service_role;
ALTER TABLE public.jeepney_day_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Day schedule of published routes is public" ON public.jeepney_day_schedule
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = route_id AND r.status = 'published'));
CREATE POLICY "Operator manages own day schedule" ON public.jeepney_day_schedule
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_day_schedule_touch BEFORE UPDATE ON public.jeepney_day_schedule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Fare table
CREATE TABLE IF NOT EXISTS public.jeepney_route_fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  amount_php numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jeepney_route_fares TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_route_fares TO authenticated;
GRANT ALL ON public.jeepney_route_fares TO service_role;
ALTER TABLE public.jeepney_route_fares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fares of published routes are public" ON public.jeepney_route_fares
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = route_id AND r.status = 'published'));
CREATE POLICY "Operator manages own fares" ON public.jeepney_route_fares
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_route_fares_touch BEFORE UPDATE ON public.jeepney_route_fares
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Service calendar
CREATE TABLE IF NOT EXISTS public.jeepney_route_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  end_date date,
  kind text NOT NULL DEFAULT 'notice',
  title text NOT NULL,
  note text,
  not_running boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jeepney_route_calendar_kind_check CHECK (kind IN ('maintenance','breakdown','holiday','notice','rental'))
);
GRANT SELECT ON public.jeepney_route_calendar TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_route_calendar TO authenticated;
GRANT ALL ON public.jeepney_route_calendar TO service_role;
ALTER TABLE public.jeepney_route_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Calendar of published routes is public" ON public.jeepney_route_calendar
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = route_id AND r.status IN ('published','suspended')));
CREATE POLICY "Operator manages own calendar" ON public.jeepney_route_calendar
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_route_calendar_touch BEFORE UPDATE ON public.jeepney_route_calendar
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS jeepney_route_calendar_route_date_idx ON public.jeepney_route_calendar (route_id, entry_date);

-- 6. Rental / charter requests
CREATE TABLE IF NOT EXISTS public.jeepney_rental_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'other',
  event_date date NOT NULL,
  start_time text,
  hours integer,
  pickup_address text NOT NULL,
  dropoff_address text,
  passengers integer,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  operator_reply text,
  quoted_php numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jeepney_rental_requests_status_check CHECK (status IN ('pending','accepted','declined','cancelled','completed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_rental_requests TO authenticated;
GRANT ALL ON public.jeepney_rental_requests TO service_role;
ALTER TABLE public.jeepney_rental_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rider reads own rental requests" ON public.jeepney_rental_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Rider creates own rental request" ON public.jeepney_rental_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Rider cancels own rental request" ON public.jeepney_rental_requests
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND status IN ('pending','cancelled'));
CREATE POLICY "Operator reads rental requests for own routes" ON public.jeepney_rental_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));
CREATE POLICY "Operator updates rental requests for own routes" ON public.jeepney_rental_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_rental_requests_touch BEFORE UPDATE ON public.jeepney_rental_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS jeepney_rental_requests_route_idx ON public.jeepney_rental_requests (route_id, status);