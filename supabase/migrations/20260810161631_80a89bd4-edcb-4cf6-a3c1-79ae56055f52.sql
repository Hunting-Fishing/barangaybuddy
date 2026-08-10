CREATE SCHEMA IF NOT EXISTS private;

DROP TRIGGER IF EXISTS update_jeepney_trips_updated_at ON public.jeepney_trips;
DROP FUNCTION IF EXISTS public.jeepney_touch_updated_at();

CREATE OR REPLACE FUNCTION private.jeepney_touch_updated_at()
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

REVOKE ALL ON FUNCTION private.jeepney_touch_updated_at() FROM PUBLIC;

CREATE TRIGGER update_jeepney_trips_updated_at
BEFORE UPDATE ON public.jeepney_trips
FOR EACH ROW EXECUTE FUNCTION private.jeepney_touch_updated_at();