-- DevOps/Scaling hardening:
-- 1) Ensure media bucket read access is owner-or-admin only
-- 2) Remove legacy public-read cargo policy if it exists

BEGIN;

DROP POLICY IF EXISTS "Public read cargo" ON storage.objects;
DROP POLICY IF EXISTS "Users can access their media" ON storage.objects;

CREATE POLICY "Users can access their media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('avatars', 'cargo', 'trucks')
    AND (
      public.is_admin()
      OR owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

COMMIT;
