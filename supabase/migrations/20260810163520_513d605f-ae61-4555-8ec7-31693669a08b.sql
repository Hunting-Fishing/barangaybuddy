DROP POLICY IF EXISTS "Captain updates own team" ON public.group_teams;

CREATE POLICY "Captain updates own team"
ON public.group_teams
FOR UPDATE
TO authenticated
USING (captain_id = auth.uid())
WITH CHECK (
  captain_id = auth.uid()
  AND (
    status = ANY (ARRAY['pending'::team_status, 'disbanded'::team_status, 'rejected'::team_status])
    OR (
      status = 'approved'::team_status
      AND (private.is_group_admin(group_id, auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role))
    )
  )
);