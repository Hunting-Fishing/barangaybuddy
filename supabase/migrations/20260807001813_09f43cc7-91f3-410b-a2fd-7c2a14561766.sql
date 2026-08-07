-- 1) Membership tier
DO $$ BEGIN
  CREATE TYPE public.membership_tier AS ENUM ('supporter','player');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.group_memberships
  ADD COLUMN IF NOT EXISTS tier public.membership_tier NOT NULL DEFAULT 'player';

-- 2) Teams
DO $$ BEGIN
  CREATE TYPE public.team_status AS ENUM ('pending','approved','rejected','disbanded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.team_member_status AS ENUM ('invited','confirmed','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.group_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  barangay_code text REFERENCES public.barangays(code),
  city_code text,
  home_venue_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  captain_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone text,
  logo_url text,
  notes text,
  status public.team_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_teams TO authenticated;
GRANT SELECT ON public.group_teams TO anon;
GRANT ALL ON public.group_teams TO service_role;
ALTER TABLE public.group_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved teams are public" ON public.group_teams
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Captain reads own team" ON public.group_teams
  FOR SELECT TO authenticated USING (captain_id = auth.uid());
CREATE POLICY "Group admins read teams" ON public.group_teams
  FOR SELECT TO authenticated
  USING (private.is_group_admin(group_id, auth.uid()) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated create pending team" ON public.group_teams
  FOR INSERT TO authenticated
  WITH CHECK (captain_id = auth.uid() AND status = 'pending');
CREATE POLICY "Captain updates own team" ON public.group_teams
  FOR UPDATE TO authenticated
  USING (captain_id = auth.uid())
  WITH CHECK (captain_id = auth.uid() AND status IN ('pending','disbanded','approved','rejected'));
CREATE POLICY "Group admins manage teams" ON public.group_teams
  FOR ALL TO authenticated
  USING (private.is_group_admin(group_id, auth.uid()) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.is_group_admin(group_id, auth.uid()) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Captain deletes own team" ON public.group_teams
  FOR DELETE TO authenticated USING (captain_id = auth.uid());

CREATE TRIGGER group_teams_touch BEFORE UPDATE ON public.group_teams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS group_teams_group_idx ON public.group_teams(group_id, status);

-- helper: is a user the captain of a team (avoids recursive policy checks)
CREATE OR REPLACE FUNCTION private.is_team_captain(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_teams t WHERE t.id = _team_id AND t.captain_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION private.is_team_captain(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.team_group_id(_team_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT group_id FROM public.group_teams WHERE id = _team_id
$$;
REVOKE EXECUTE ON FUNCTION private.team_group_id(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Team roster
CREATE TABLE IF NOT EXISTS public.group_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.group_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_captain boolean NOT NULL DEFAULT false,
  jersey_name text,
  status public.team_member_status NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_team_members TO authenticated;
GRANT SELECT ON public.group_team_members TO anon;
GRANT ALL ON public.group_team_members TO service_role;
ALTER TABLE public.group_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Confirmed roster is public" ON public.group_team_members
  FOR SELECT USING (status = 'confirmed');
CREATE POLICY "Own roster row readable" ON public.group_team_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Captain reads roster" ON public.group_team_members
  FOR SELECT TO authenticated USING (private.is_team_captain(team_id, auth.uid()));
CREATE POLICY "Group admins read roster" ON public.group_team_members
  FOR SELECT TO authenticated
  USING (private.is_group_admin(private.team_group_id(team_id), auth.uid()) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Captain invites players" ON public.group_team_members
  FOR INSERT TO authenticated
  WITH CHECK (private.is_team_captain(team_id, auth.uid()));
CREATE POLICY "Captain manages roster" ON public.group_team_members
  FOR UPDATE TO authenticated
  USING (private.is_team_captain(team_id, auth.uid()))
  WITH CHECK (private.is_team_captain(team_id, auth.uid()));
CREATE POLICY "Player updates own roster row" ON public.group_team_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Captain removes players" ON public.group_team_members
  FOR DELETE TO authenticated USING (private.is_team_captain(team_id, auth.uid()));
CREATE POLICY "Player leaves team" ON public.group_team_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Group admins manage roster" ON public.group_team_members
  FOR ALL TO authenticated
  USING (private.is_group_admin(private.team_group_id(team_id), auth.uid()) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.is_group_admin(private.team_group_id(team_id), auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER group_team_members_touch BEFORE UPDATE ON public.group_team_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS group_team_members_team_idx ON public.group_team_members(team_id, status);
CREATE INDEX IF NOT EXISTS group_team_members_user_idx ON public.group_team_members(user_id);

-- 4) Online payments (GCash / Maya via provider API)
CREATE TABLE IF NOT EXISTS public.group_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_php integer NOT NULL,
  provider text NOT NULL DEFAULT 'paymongo',
  method text,
  status text NOT NULL DEFAULT 'pending',
  external_id text,
  checkout_url text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.group_payments TO authenticated;
GRANT ALL ON public.group_payments TO service_role;
ALTER TABLE public.group_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own payments readable" ON public.group_payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read payments" ON public.group_payments
  FOR SELECT TO authenticated
  USING (private.is_group_admin(group_id, auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER group_payments_touch BEFORE UPDATE ON public.group_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS group_payments_ext_idx ON public.group_payments(external_id);

-- 5) Free supporter memberships: allow self-insert/activate when tier = supporter and no fee owed
DROP POLICY IF EXISTS "Members insert own pending membership" ON public.group_memberships;
CREATE POLICY "Members insert own membership" ON public.group_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (tier = 'supporter' AND status = 'active' AND amount_paid_php = 0)
      OR (tier = 'player' AND status = 'pending')
    )
  );