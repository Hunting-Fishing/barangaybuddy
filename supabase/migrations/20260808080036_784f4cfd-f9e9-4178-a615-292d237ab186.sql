DROP POLICY IF EXISTS "Admins can create groups" ON public.groups;
DROP POLICY IF EXISTS "Admins create groups or members apply" ON public.groups;
CREATE POLICY "Admins create groups or members apply" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin')
    OR (created_by = auth.uid() AND is_public = false)
  );

DROP POLICY IF EXISTS "Admins or creator can update groups" ON public.groups;
CREATE POLICY "Admins or creator can update groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR created_by = auth.uid())
  WITH CHECK (
    private.has_role(auth.uid(), 'admin')
    OR (created_by = auth.uid() AND is_public = false)
  );