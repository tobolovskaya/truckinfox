-- =============================================================================
-- Fix: truck_images SELECT policy is too restrictive
--
-- PROBLEM: "Owners and admins can read truck_images" limits SELECT to the
-- carrier who owns the truck or admins. Any other authenticated user (customer
-- browsing carrier profiles / truck listings) gets a 403 → broken images.
--
-- FIX: Replace the SELECT-only policy with one that allows any authenticated
-- user to read truck images. Write policies (INSERT/UPDATE/DELETE) stay
-- owner-only — only the SELECT changes.
-- =============================================================================

DROP POLICY IF EXISTS "Owners and admins can read truck_images" ON storage.objects;

CREATE POLICY "Authenticated users can read truck_images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'truck_images');
