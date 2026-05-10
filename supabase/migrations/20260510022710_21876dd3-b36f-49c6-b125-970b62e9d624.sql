
CREATE OR REPLACE FUNCTION public.prevent_duplicate_fuel_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fuel_prices
    WHERE station_id = NEW.station_id
      AND fuel_type = NEW.fuel_type
      AND reported_by = NEW.reported_by
      AND price = NEW.price
      AND reported_at > now() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'You already reported this same price for this station and fuel type in the last 10 minutes.'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_fuel_price_trg ON public.fuel_prices;
CREATE TRIGGER prevent_duplicate_fuel_price_trg
BEFORE INSERT ON public.fuel_prices
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_fuel_price();

CREATE INDEX IF NOT EXISTS idx_fuel_prices_dedup
  ON public.fuel_prices (station_id, fuel_type, reported_by, reported_at DESC);
