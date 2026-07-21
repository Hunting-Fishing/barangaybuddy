
-- 1) profiles: hide phone from anon via column-level grants
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, display_name, avatar_url, created_at, updated_at) ON public.profiles TO anon;

-- 2) businesses: hide contact_email/contact_phone from anon via column-level grants
REVOKE SELECT ON public.businesses FROM anon;
GRANT SELECT (id, owner_id, barangay_code, name, slug, type, description, tags,
  cover_image_url, logo_url, hours, address, latitude, longitude, is_published,
  created_at, updated_at, additional_types, custom_types, is_claimed,
  imported_from, import_source_id, website) ON public.businesses TO anon;

-- 3) Simplify business-media storage read policy
DROP POLICY IF EXISTS "Public read business media objects" ON storage.objects;

-- 4) Remove broad listing SELECT policies on public buckets (public URL access still works)
DROP POLICY IF EXISTS "Public read locality flags" ON storage.objects;

-- 5) Revoke EXECUTE on SECURITY DEFINER trigger-only functions from callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_fuel_price_votes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_duplicate_fuel_price() FROM PUBLIC, anon, authenticated;
