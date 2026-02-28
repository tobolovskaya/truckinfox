DROP POLICY IF EXISTS "Trucks are viewable by everyone" ON public.trucks;
DROP POLICY IF EXISTS "Carriers can view their trucks" ON public.trucks;

CREATE POLICY "Carriers can view their trucks"
  ON public.trucks FOR SELECT
  USING (auth.uid() = carrier_id);

-- Existing admin policy remains in effect:
-- "Admins have full access to trucks" USING/WITH CHECK public.is_admin().
