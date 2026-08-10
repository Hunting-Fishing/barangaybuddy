CREATE TYPE public.jeepney_route_status AS ENUM ('draft','pending','published','suspended');
CREATE TYPE public.jeepney_sub_status AS ENUM ('trialing','active','past_due','cancelled');

CREATE TABLE public.jeepney_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  city_code text REFERENCES public.cities_municipalities(code),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_operators TO authenticated;
GRANT SELECT ON public.jeepney_operators TO anon;
GRANT ALL ON public.jeepney_operators TO service_role;
ALTER TABLE public.jeepney_operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators are publicly viewable" ON public.jeepney_operators FOR SELECT USING (true);
CREATE POLICY "Users create own operator profile" ON public.jeepney_operators FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own operator profile" ON public.jeepney_operators FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own operator profile" ON public.jeepney_operators FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER jeepney_operators_touch BEFORE UPDATE ON public.jeepney_operators FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_operator_contacts (
  operator_id uuid PRIMARY KEY REFERENCES public.jeepney_operators(id) ON DELETE CASCADE,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_operator_contacts TO authenticated;
GRANT ALL ON public.jeepney_operator_contacts TO service_role;
ALTER TABLE public.jeepney_operator_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator reads own contact" ON public.jeepney_operator_contacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE POLICY "Operator writes own contact" ON public.jeepney_operator_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE POLICY "Operator updates own contact" ON public.jeepney_operator_contacts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_operator_contacts_touch BEFORE UPDATE ON public.jeepney_operator_contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.jeepney_operators(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  slug text NOT NULL UNIQUE,
  city_code text REFERENCES public.cities_municipalities(code),
  barangay_code text REFERENCES public.barangays(code),
  fare_php numeric,
  fare_note text,
  path jsonb NOT NULL DEFAULT '[]'::jsonb,
  colour text NOT NULL DEFAULT '#f59e0b',
  status public.jeepney_route_status NOT NULL DEFAULT 'draft',
  first_run text,
  last_run text,
  last_pickup text,
  trips_per_day integer,
  operating_days text[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
  avg_trip_minutes integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jeepney_routes_status ON public.jeepney_routes(status);
CREATE INDEX idx_jeepney_routes_city ON public.jeepney_routes(city_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_routes TO authenticated;
GRANT SELECT ON public.jeepney_routes TO anon;
GRANT ALL ON public.jeepney_routes TO service_role;
ALTER TABLE public.jeepney_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published routes are public" ON public.jeepney_routes FOR SELECT USING (status = 'published');
CREATE POLICY "Operator reads own routes" ON public.jeepney_routes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE POLICY "Operator creates routes" ON public.jeepney_routes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE POLICY "Operator updates own routes" ON public.jeepney_routes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE POLICY "Operator deletes own routes" ON public.jeepney_routes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_routes_touch BEFORE UPDATE ON public.jeepney_routes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  offset_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jeepney_stops_route ON public.jeepney_stops(route_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_stops TO authenticated;
GRANT SELECT ON public.jeepney_stops TO anon;
GRANT ALL ON public.jeepney_stops TO service_role;
ALTER TABLE public.jeepney_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stops of published routes are public" ON public.jeepney_stops FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = route_id AND r.status = 'published'));
CREATE POLICY "Operator manages own stops" ON public.jeepney_stops FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));

CREATE TABLE public.jeepney_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  label text NOT NULL,
  plate_number text,
  seats integer,
  active boolean NOT NULL DEFAULT true,
  device_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jeepney_vehicles_route ON public.jeepney_vehicles(route_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jeepney_vehicles TO authenticated;
GRANT SELECT (id, route_id, label, seats, active, created_at) ON public.jeepney_vehicles TO anon;
GRANT ALL ON public.jeepney_vehicles TO service_role;
ALTER TABLE public.jeepney_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicles of published routes are public" ON public.jeepney_vehicles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = route_id AND r.status = 'published'));
CREATE POLICY "Operator manages own vehicles" ON public.jeepney_vehicles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_vehicles_touch BEFORE UPDATE ON public.jeepney_vehicles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.jeepney_vehicles(id) ON DELETE SET NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  heading numeric,
  speed_kph numeric,
  source text NOT NULL DEFAULT 'phone',
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jeepney_positions_route_time ON public.jeepney_positions(route_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.jeepney_positions TO authenticated;
GRANT SELECT ON public.jeepney_positions TO anon;
GRANT ALL ON public.jeepney_positions TO service_role;
ALTER TABLE public.jeepney_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Positions of published routes are public" ON public.jeepney_positions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.jeepney_routes r WHERE r.id = route_id AND r.status = 'published'));
CREATE POLICY "Operator posts own positions" ON public.jeepney_positions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_routes r JOIN public.jeepney_operators o ON o.id = r.operator_id WHERE r.id = route_id AND o.user_id = auth.uid()));

CREATE TABLE public.jeepney_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.jeepney_operators(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.jeepney_routes(id) ON DELETE CASCADE,
  status public.jeepney_sub_status NOT NULL DEFAULT 'past_due',
  amount_php integer NOT NULL DEFAULT 100,
  current_period_end timestamptz,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  payment_ref text,
  payment_note text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jeepney_subscriptions_operator ON public.jeepney_subscriptions(operator_id);
GRANT SELECT ON public.jeepney_subscriptions TO authenticated;
GRANT ALL ON public.jeepney_subscriptions TO service_role;
ALTER TABLE public.jeepney_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator views own subscription" ON public.jeepney_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE TRIGGER jeepney_subscriptions_touch BEFORE UPDATE ON public.jeepney_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.jeepney_device_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.jeepney_operators(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.jeepney_device_requests TO authenticated;
GRANT ALL ON public.jeepney_device_requests TO service_role;
ALTER TABLE public.jeepney_device_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator views own device requests" ON public.jeepney_device_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));
CREATE POLICY "Operator creates device requests" ON public.jeepney_device_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.jeepney_operators o WHERE o.id = operator_id AND o.user_id = auth.uid()));