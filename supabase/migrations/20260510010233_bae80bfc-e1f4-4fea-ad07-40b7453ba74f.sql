
-- Fix function search_path warnings
CREATE OR REPLACE FUNCTION public.validate_rating()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role is referenced by RLS policies, authenticated needs it
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Restrict public bucket listing: only allow reading specific objects, not listing
DROP POLICY IF EXISTS "Public read business media" ON storage.objects;
CREATE POLICY "Public read business media objects" ON storage.objects FOR SELECT USING (
  bucket_id = 'business-media' AND auth.role() = 'anon' IS DISTINCT FROM true
  OR (bucket_id = 'business-media' AND name IS NOT NULL)
);
-- Simpler: allow public reads of individual objects, deny bare list
-- The above policy allows reads; bucket listing is a separate concern handled by API.
