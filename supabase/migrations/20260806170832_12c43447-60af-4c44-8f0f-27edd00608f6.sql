DROP POLICY IF EXISTS "Users request or self-activate own membership" ON public.group_memberships;
CREATE POLICY "Users request own membership"
ON public.group_memberships FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'::group_role
  AND status = 'pending'::membership_status
);

DROP POLICY IF EXISTS "Users cancel own membership; admins manage" ON public.group_memberships;
CREATE POLICY "Users cancel own membership; admins manage"
ON public.group_memberships FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR private.is_group_admin(group_id, auth.uid()))
WITH CHECK (
  private.is_group_admin(group_id, auth.uid())
  OR (
    user_id = auth.uid()
    AND role = 'member'::group_role
    AND status IN ('pending'::membership_status, 'cancelled'::membership_status)
  )
);