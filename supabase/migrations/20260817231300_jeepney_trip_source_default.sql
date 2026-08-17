-- Unspecified new trip assignments are conservatively dispatcher-owned. Phone
-- tracking explicitly writes assignment_source='phone'. This prevents a client
-- that forgets the field from gaining permission to end a hardwired trip later.

ALTER TABLE public.jeepney_trips
  ALTER COLUMN assignment_source SET DEFAULT 'dispatch';
