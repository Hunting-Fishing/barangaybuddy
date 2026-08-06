-- 1. Restrict import run tables to admins
DROP POLICY IF EXISTS "Public read business import runs" ON public.business_import_runs;
DROP POLICY IF EXISTS "Public read import runs" ON public.fuel_import_runs;

CREATE POLICY "Admins read business import runs"
  ON public.business_import_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read fuel import runs"
  ON public.fuel_import_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.business_import_runs FROM anon;
REVOKE SELECT ON public.fuel_import_runs FROM anon;
GRANT SELECT ON public.business_import_runs TO authenticated;
GRANT SELECT ON public.fuel_import_runs TO authenticated;

-- 2. Move phone numbers out of the publicly readable profiles table
CREATE TABLE IF NOT EXISTS public.profiles_private (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles_private TO authenticated;
GRANT ALL ON public.profiles_private TO service_role;

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own private profile"
  ON public.profiles_private FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read private profiles"
  ON public.profiles_private FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.profiles_private (user_id, phone)
SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE TRIGGER profiles_private_touch
  BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

-- 3. Move internal SECURITY DEFINER routines out of the exposed API schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.bump_conversation() SET SCHEMA private;
ALTER FUNCTION public.handle_new_user() SET SCHEMA private;
ALTER FUNCTION public.prevent_duplicate_fuel_price() SET SCHEMA private;
ALTER FUNCTION public.sync_fuel_price_votes() SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_active_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_group_admin(uuid, uuid) SET SCHEMA private;

ALTER FUNCTION private.bump_conversation() SET search_path = public, private;
ALTER FUNCTION private.handle_new_user() SET search_path = public, private;
ALTER FUNCTION private.prevent_duplicate_fuel_price() SET search_path = public, private;
ALTER FUNCTION private.sync_fuel_price_votes() SET search_path = public, private;
ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public, private;
ALTER FUNCTION private.is_active_member(uuid, uuid) SET search_path = public, private;
ALTER FUNCTION private.is_group_admin(uuid, uuid) SET search_path = public, private;

REVOKE ALL ON FUNCTION private.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_duplicate_fuel_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_fuel_price_votes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_active_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_group_admin(uuid, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_active_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_group_admin(uuid, uuid) TO authenticated, anon;