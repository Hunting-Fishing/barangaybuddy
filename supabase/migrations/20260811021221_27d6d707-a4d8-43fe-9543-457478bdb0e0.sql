ALTER TABLE public.jeepney_stops ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'stop';
ALTER TABLE public.jeepney_stops DROP CONSTRAINT IF EXISTS jeepney_stops_kind_check;
ALTER TABLE public.jeepney_stops ADD CONSTRAINT jeepney_stops_kind_check CHECK (kind IN ('stop','waiting','terminal','landmark'));