DROP POLICY IF EXISTS "Owners can list own business media" ON storage.objects;
CREATE POLICY "Owners can list own business media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'business-media'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);