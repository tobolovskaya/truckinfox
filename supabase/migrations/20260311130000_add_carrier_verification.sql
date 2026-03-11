-- Add Brønnøysundregistrene verification fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brreg_org_number text,
  ADD COLUMN IF NOT EXISTS verified_at      timestamptz;

-- Unique constraint: one profile per org number (prevents duplicate registrations)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_brreg_org_number_key
  ON profiles (brreg_org_number)
  WHERE brreg_org_number IS NOT NULL;

-- Carriers can submit their own org number for verification
-- but cannot flip is_verified themselves (that is done by the Edge Function via service role)
CREATE POLICY "carriers_update_own_brreg_org_number"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Disallow client from setting is_verified = true or verified_at directly
    AND (is_verified = (SELECT is_verified FROM profiles WHERE id = auth.uid()))
    AND (verified_at  IS NOT DISTINCT FROM (SELECT verified_at  FROM profiles WHERE id = auth.uid()))
  );

-- Index for fast lookup in feed/bid queries
CREATE INDEX IF NOT EXISTS profiles_is_verified_idx ON profiles (is_verified) WHERE is_verified = true;
