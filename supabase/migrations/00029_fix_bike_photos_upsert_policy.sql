-- Migration: 00029_fix_bike_photos_upsert_policy
-- Purpose: Add UPDATE policy on bike-photos storage bucket so upsert works
-- Without this, re-uploading a bike photo fails with RLS violation

CREATE POLICY "Users update own bike photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bike-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'bike-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
