CREATE POLICY "Jeepney media readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'jeepney-media');
CREATE POLICY "Jeepney media upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'jeepney-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Jeepney media update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'jeepney-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'jeepney-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Jeepney media delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'jeepney-media' AND (storage.foldername(name))[1] = auth.uid()::text);