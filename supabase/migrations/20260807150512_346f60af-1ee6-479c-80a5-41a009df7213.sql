-- 1. Team contact phone -> private table
CREATE TABLE public.group_team_contacts (
  team_id uuid PRIMARY KEY REFERENCES public.group_teams(id) ON DELETE CASCADE,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_team_contacts TO authenticated;
GRANT ALL ON public.group_team_contacts TO service_role;

ALTER TABLE public.group_team_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.can_manage_team(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_teams t
    WHERE t.id = _team_id
      AND (
        t.captain_id = _user_id
        OR private.is_group_admin(t.group_id, _user_id)
        OR private.has_role(_user_id, 'admin'::app_role)
      )
  )
$$;

REVOKE ALL ON FUNCTION private.can_manage_team(uuid, uuid) FROM PUBLIC;

CREATE POLICY "Captains and admins read team contacts"
ON public.group_team_contacts FOR SELECT TO authenticated
USING (private.can_manage_team(team_id, auth.uid()));

CREATE POLICY "Captains and admins write team contacts"
ON public.group_team_contacts FOR INSERT TO authenticated
WITH CHECK (private.can_manage_team(team_id, auth.uid()));

CREATE POLICY "Captains and admins update team contacts"
ON public.group_team_contacts FOR UPDATE TO authenticated
USING (private.can_manage_team(team_id, auth.uid()))
WITH CHECK (private.can_manage_team(team_id, auth.uid()));

CREATE POLICY "Captains and admins delete team contacts"
ON public.group_team_contacts FOR DELETE TO authenticated
USING (private.can_manage_team(team_id, auth.uid()));

CREATE TRIGGER group_team_contacts_updated_at
BEFORE UPDATE ON public.group_team_contacts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.group_team_contacts (team_id, contact_phone)
SELECT id, contact_phone FROM public.group_teams WHERE contact_phone IS NOT NULL
ON CONFLICT (team_id) DO NOTHING;

ALTER TABLE public.group_teams DROP COLUMN contact_phone;

-- 2. No self-activated memberships
DROP POLICY IF EXISTS "Members insert own membership" ON public.group_memberships;
DROP POLICY IF EXISTS "Users request own membership" ON public.group_memberships;

CREATE POLICY "Users request own membership as pending"
ON public.group_memberships FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'::group_role
  AND status = 'pending'::membership_status
  AND amount_paid_php = 0
);

-- Server-side activation for genuinely free supporter memberships only
CREATE OR REPLACE FUNCTION public.activate_free_supporter_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.activate_free_supporter_membership() FROM PUBLIC;

DROP TRIGGER IF EXISTS group_memberships_free_supporter ON public.group_memberships;
CREATE TRIGGER group_memberships_free_supporter
BEFORE INSERT ON public.group_memberships
FOR EACH ROW EXECUTE FUNCTION public.activate_free_supporter_membership();