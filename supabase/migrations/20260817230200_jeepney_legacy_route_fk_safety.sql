-- Phase 3 fleet safety.
-- jeepney_vehicles.route_id is now only a nullable legacy/home-route hint. The
-- original FK used ON DELETE CASCADE, which would wrongly delete the physical
-- fleet vehicle (and its tracker installation) when an old route is deleted.
-- Replace any FK from jeepney_vehicles.route_id -> jeepney_routes.id with
-- ON DELETE SET NULL.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class child ON child.oid = con.conrelid
  JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
  JOIN pg_class parent ON parent.oid = con.confrelid
  JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
  WHERE con.contype = 'f'
    AND child_ns.nspname = 'public'
    AND child.relname = 'jeepney_vehicles'
    AND parent_ns.nspname = 'public'
    AND parent.relname = 'jeepney_routes'
    AND con.conkey = ARRAY[
      (SELECT attnum FROM pg_attribute
       WHERE attrelid = 'public.jeepney_vehicles'::regclass
         AND attname = 'route_id'
         AND NOT attisdropped)
    ]::smallint[]
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.jeepney_vehicles DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

ALTER TABLE public.jeepney_vehicles
  ADD CONSTRAINT jeepney_vehicles_route_id_fkey
  FOREIGN KEY (route_id)
  REFERENCES public.jeepney_routes(id)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT jeepney_vehicles_route_id_fkey ON public.jeepney_vehicles IS
  'Legacy/home-route hint only. Route deletion must never delete the physical fleet vehicle.';
