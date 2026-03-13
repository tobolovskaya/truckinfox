-- =============================================================================
-- Fix: reviews SELECT policy is too restrictive
--
-- PROBLEM: "Users can view reviews where they are involved" only allows
-- reviewer_id OR reviewed_id to read a review row. Any other authenticated
-- user (e.g. a customer browsing a carrier's public profile) gets 0 rows,
-- making ratings completely invisible on profile pages.
--
-- FIX: Replace with a policy that allows any authenticated user to read all
-- reviews. Reviews are public-facing reputation data — restricting them to
-- participants defeats the purpose of a rating system.
-- =============================================================================

DROP POLICY IF EXISTS "Users can view reviews where they are involved" ON public.reviews;

CREATE POLICY "Reviews are publicly readable by authenticated users"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);
