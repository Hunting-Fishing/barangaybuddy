
-- Enums
CREATE TYPE public.group_type AS ENUM ('league', 'club', 'interest_group');
CREATE TYPE public.group_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.membership_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
CREATE TYPE public.event_status AS ENUM ('scheduled', 'cancelled', 'completed');
CREATE TYPE public.venue_status AS ENUM ('pending', 'approved', 'rejected');

-- =========================================================================
-- groups
-- =========================================================================
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  type public.group_type NOT NULL DEFAULT 'club',
  description text,
  cover_image_url text,
  logo_url text,
  membership_fee_php integer NOT NULL DEFAULT 0,
  membership_period_days integer NOT NULL DEFAULT 365,
  is_public boolean NOT NULL DEFAULT true,
  payment_instructions text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public groups are viewable" ON public.groups
  FOR SELECT USING (is_public = true OR (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Admins can create groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins or creator can update groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid());
CREATE POLICY "Admins can delete groups" ON public.groups
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- group_memberships
-- =========================================================================
CREATE TABLE public.group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_role NOT NULL DEFAULT 'member',
  status public.membership_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  expires_at timestamptz,
  payment_ref text,
  payment_note text,
  amount_paid_php integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX group_memberships_user_status_idx ON public.group_memberships(user_id, status);
CREATE INDEX group_memberships_group_status_idx ON public.group_memberships(group_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_memberships TO authenticated;
GRANT ALL ON public.group_memberships TO service_role;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_active_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_id = _group_id AND user_id = _user_id
      AND status = 'active' AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid, uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_id = _group_id AND user_id = _user_id
      AND role IN ('owner','admin') AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;

CREATE POLICY "Users view own memberships or admins view all" ON public.group_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Users request own membership as pending" ON public.group_memberships
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND role = 'member');
CREATE POLICY "Users cancel own membership; admins manage" ON public.group_memberships
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Users delete own pending; admins delete" ON public.group_memberships
  FOR DELETE TO authenticated
  USING ((user_id = auth.uid() AND status = 'pending') OR public.is_group_admin(group_id, auth.uid()));

CREATE TRIGGER group_memberships_updated_at BEFORE UPDATE ON public.group_memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- group_venues
-- =========================================================================
CREATE TABLE public.group_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status public.venue_status NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, business_id)
);
CREATE INDEX group_venues_group_status_idx ON public.group_venues(group_id, status);

GRANT SELECT ON public.group_venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_venues TO authenticated;
GRANT ALL ON public.group_venues TO service_role;
ALTER TABLE public.group_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved venues public; owners/admins see own" ON public.group_venues
  FOR SELECT
  USING (
    status = 'approved'
    OR (auth.uid() IS NOT NULL AND (
      requested_by = auth.uid()
      OR public.is_group_admin(group_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    ))
  );
CREATE POLICY "Business owner requests venue link" ON public.group_venues
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
  );
CREATE POLICY "Group admins update venues" ON public.group_venues
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "Group admins or requester delete venues" ON public.group_venues
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()) OR requested_by = auth.uid());

CREATE TRIGGER group_venues_updated_at BEFORE UPDATE ON public.group_venues
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- group_events
-- =========================================================================
CREATE TABLE public.group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  venue_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  entry_fee_php integer NOT NULL DEFAULT 0,
  member_free boolean NOT NULL DEFAULT true,
  status public.event_status NOT NULL DEFAULT 'scheduled',
  cover_image_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_events_group_starts_idx ON public.group_events(group_id, starts_at);

GRANT SELECT ON public.group_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO authenticated;
GRANT ALL ON public.group_events TO service_role;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scheduled events public" ON public.group_events
  FOR SELECT
  USING (status <> 'cancelled' OR (auth.uid() IS NOT NULL AND public.is_group_admin(group_id, auth.uid())));
CREATE POLICY "Group admins manage events" ON public.group_events
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));

CREATE TRIGGER group_events_updated_at BEFORE UPDATE ON public.group_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- group_event_rsvps
-- =========================================================================
CREATE TABLE public.group_event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX group_event_rsvps_event_idx ON public.group_event_rsvps(event_id);

GRANT SELECT, INSERT, DELETE ON public.group_event_rsvps TO authenticated;
GRANT ALL ON public.group_event_rsvps TO service_role;
ALTER TABLE public.group_event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own or event admins see all rsvps" ON public.group_event_rsvps
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_events e
      WHERE e.id = event_id AND public.is_group_admin(e.group_id, auth.uid())
    )
  );
CREATE POLICY "Authenticated users rsvp for self" ON public.group_event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users cancel own rsvp" ON public.group_event_rsvps
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =========================================================================
-- group_promos
-- =========================================================================
CREATE TABLE public.group_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  discount_percent numeric(5,2),
  discount_amount_php integer,
  code text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_promos_group_valid_idx ON public.group_promos(group_id, valid_until);
CREATE INDEX group_promos_business_idx ON public.group_promos(business_id);

GRANT SELECT ON public.group_promos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_promos TO authenticated;
GRANT ALL ON public.group_promos TO service_role;
ALTER TABLE public.group_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active promos public" ON public.group_promos
  FOR SELECT
  USING (
    (valid_until IS NULL OR valid_until >= now())
    OR (auth.uid() IS NOT NULL AND public.is_group_admin(group_id, auth.uid()))
  );
CREATE POLICY "Group admins manage promos" ON public.group_promos
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));

CREATE TRIGGER group_promos_updated_at BEFORE UPDATE ON public.group_promos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- Seed: Barangay Buddy Billiards League
-- =========================================================================
INSERT INTO public.groups (slug, name, type, description, membership_fee_php, membership_period_days, is_public, payment_instructions)
VALUES (
  'barangay-buddy-billiards-league',
  'Barangay Buddy Billiards League',
  'league',
  E'The first nationwide billiards league on Barangay Buddy. Members enjoy free entry to league events and tournaments, get listed on the members roster, and unlock automatic member discounts at league venues across the Philippines.\n\nMembership: ₱100 per year.',
  100,
  365,
  true,
  E'Pay ₱100 via GCash or bank transfer to your league organizer, then submit your reference number below. A league admin will verify and activate your membership within 24 hours.\n\nGCash: 0917-XXX-XXXX (Barangay Buddy Billiards League)\nBank: BPI 1234-5678-90'
);
