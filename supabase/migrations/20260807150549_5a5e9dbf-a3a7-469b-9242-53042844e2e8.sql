DROP TRIGGER IF EXISTS group_memberships_free_supporter ON public.group_memberships;
DROP FUNCTION IF EXISTS public.activate_free_supporter_membership();

CREATE OR REPLACE FUNCTION private.activate_free_supporter_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.tier = 'supporter'::membership_tier
     AND NEW.status = 'pending'::membership_status
     AND COALESCE(NEW.amount_paid_php, 0) = 0 THEN
    NEW.status := 'active'::membership_status;
    NEW.started_at := COALESCE(NEW.started_at, now());
    NEW.expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.activate_free_supporter_membership() FROM PUBLIC;

CREATE TRIGGER group_memberships_free_supporter
BEFORE INSERT ON public.group_memberships
FOR EACH ROW EXECUTE FUNCTION private.activate_free_supporter_membership();