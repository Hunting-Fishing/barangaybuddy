-- Jeepney route publication/security hardening.
--
-- Operators may edit routes they own, but may not self-publish a draft/pending
-- route. Operational service controls remain available for an already-approved
-- route: published -> suspended -> published.
--
-- Suspended routes remain publicly readable so riders can see the outage,
-- mapped stops and recent service context instead of the route disappearing.

CREATE OR REPLACE FUNCTION private.jeepney_guard_route_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  caller_is_admin boolean := false;
  caller_owns_route boolean := false;
BEGIN
  -- Server-side service-role workflows (payments, imports, admin actions) are
  -- allowed to perform controlled publication transitions.
  IF caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Database/maintenance contexts without an authenticated application caller
  -- are not operator self-service requests.
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = caller_id
      AND ur.role = 'admin'
  ) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.jeepney_operators o
    WHERE o.id = NEW.operator_id
      AND o.user_id = caller_id
  ) INTO caller_owns_route;

  -- Ownership itself remains enforced by RLS. If this is not the route owner,
  -- leave the row for RLS to reject rather than leaking authorization details.
  IF NOT caller_owns_route THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'Operators cannot self-publish jeepney routes'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'draft' AND NEW.status = 'pending')
     OR (OLD.status = 'pending' AND NEW.status = 'draft')
     OR (OLD.status = 'published' AND NEW.status = 'suspended')
     OR (OLD.status = 'suspended' AND NEW.status = 'published') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Jeepney route status transition % -> % requires admin/server approval',
    OLD.status, NEW.status
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.jeepney_guard_route_status() FROM PUBLIC;

DROP TRIGGER IF EXISTS jeepney_routes_guard_status ON public.jeepney_routes;
CREATE TRIGGER jeepney_routes_guard_status
BEFORE INSERT OR UPDATE OF status ON public.jeepney_routes
FOR EACH ROW EXECUTE FUNCTION private.jeepney_guard_route_status();

-- Keep suspended routes visible to riders so service alerts have a durable page.
DROP POLICY IF EXISTS "Published routes are public" ON public.jeepney_routes;
DROP POLICY IF EXISTS "Public routes are visible" ON public.jeepney_routes;
CREATE POLICY "Public routes are visible"
ON public.jeepney_routes FOR SELECT TO anon, authenticated
USING (status IN ('published', 'suspended'));

DROP POLICY IF EXISTS "Stops of published routes are public" ON public.jeepney_stops;
DROP POLICY IF EXISTS "Stops of public routes are public" ON public.jeepney_stops;
CREATE POLICY "Stops of public routes are public"
ON public.jeepney_stops FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    WHERE r.id = route_id
      AND r.status IN ('published', 'suspended')
  )
);

DROP POLICY IF EXISTS "Vehicles of published routes are public" ON public.jeepney_vehicles;
DROP POLICY IF EXISTS "Vehicles of public routes are public" ON public.jeepney_vehicles;
CREATE POLICY "Vehicles of public routes are public"
ON public.jeepney_vehicles FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    WHERE r.id = route_id
      AND r.status IN ('published', 'suspended')
  )
);

DROP POLICY IF EXISTS "Positions of published routes are public" ON public.jeepney_positions;
DROP POLICY IF EXISTS "Positions of public routes are public" ON public.jeepney_positions;
CREATE POLICY "Positions of public routes are public"
ON public.jeepney_positions FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jeepney_routes r
    WHERE r.id = route_id
      AND r.status IN ('published', 'suspended')
  )
);
