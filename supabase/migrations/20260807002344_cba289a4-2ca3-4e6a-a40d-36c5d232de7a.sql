ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.group_team_members
  ADD CONSTRAINT group_team_members_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;