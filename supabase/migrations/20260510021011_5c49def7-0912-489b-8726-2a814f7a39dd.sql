
CREATE OR REPLACE FUNCTION public.sync_fuel_price_votes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 1 THEN
      UPDATE public.fuel_prices SET upvotes = upvotes + 1 WHERE id = NEW.fuel_price_id;
    ELSIF NEW.vote = -1 THEN
      UPDATE public.fuel_prices SET downvotes = downvotes + 1 WHERE id = NEW.fuel_price_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.vote <> OLD.vote THEN
    IF OLD.vote = 1 THEN
      UPDATE public.fuel_prices SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.fuel_price_id;
    ELSIF OLD.vote = -1 THEN
      UPDATE public.fuel_prices SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = OLD.fuel_price_id;
    END IF;
    IF NEW.vote = 1 THEN
      UPDATE public.fuel_prices SET upvotes = upvotes + 1 WHERE id = NEW.fuel_price_id;
    ELSIF NEW.vote = -1 THEN
      UPDATE public.fuel_prices SET downvotes = downvotes + 1 WHERE id = NEW.fuel_price_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 1 THEN
      UPDATE public.fuel_prices SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.fuel_price_id;
    ELSIF OLD.vote = -1 THEN
      UPDATE public.fuel_prices SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = OLD.fuel_price_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fuel_price_votes ON public.fuel_price_votes;
CREATE TRIGGER trg_sync_fuel_price_votes
AFTER INSERT OR UPDATE OR DELETE ON public.fuel_price_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_fuel_price_votes();
