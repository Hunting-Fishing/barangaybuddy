DROP POLICY IF EXISTS "Users request own membership as pending" ON public.group_memberships;

CREATE POLICY "Users request or self-activate own membership"
ON public.group_memberships
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND (
    status = 'pending'
    OR (status = 'active' AND payment_ref IS NOT NULL AND length(trim(payment_ref)) > 0)
  )
);