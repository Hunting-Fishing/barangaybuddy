CREATE UNIQUE INDEX IF NOT EXISTS group_payments_external_id_key
  ON public.group_payments (external_id)
  WHERE external_id IS NOT NULL;