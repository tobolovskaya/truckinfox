-- =============================================================================
-- Fix: rating race condition + missing rating_count
--
-- PROBLEM: submitReview() computes the average client-side:
--   1. Read all existing reviews
--   2. Compute avg
--   3. Write profiles.rating
-- Two concurrent reviews both read the stale list → one overwrites the other.
-- Also, profiles has no rating_count column so it is never persisted.
--
-- FIX: Add rating_count to profiles, then maintain both columns via a DB
-- trigger that runs AFTER INSERT/UPDATE/DELETE on reviews. SQL AVG() +
-- COUNT() inside the trigger is atomic within the transaction — no race.
-- =============================================================================

-- 1. Add rating_count column (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

-- 2. Backfill existing data
UPDATE public.profiles p
SET
  rating       = COALESCE(agg.avg_rating, 0.0),
  rating_count = COALESCE(agg.cnt, 0)
FROM (
  SELECT reviewed_id,
         ROUND(AVG(rating)::NUMERIC, 1) AS avg_rating,
         COUNT(*) AS cnt
  FROM public.reviews
  GROUP BY reviewed_id
) agg
WHERE p.id = agg.reviewed_id;

-- 3. Trigger function
CREATE OR REPLACE FUNCTION public.sync_profile_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_id UUID;
BEGIN
  -- Determine which profile to update
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.reviewed_id;
  ELSE
    target_id := NEW.reviewed_id;
  END IF;

  UPDATE public.profiles
  SET
    rating       = COALESCE(
                     (SELECT ROUND(AVG(r.rating)::NUMERIC, 1)
                      FROM public.reviews r
                      WHERE r.reviewed_id = target_id),
                     0.0),
    rating_count = (SELECT COUNT(*)
                    FROM public.reviews r
                    WHERE r.reviewed_id = target_id),
    updated_at   = NOW()
  WHERE id = target_id;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_rating ON public.reviews;
CREATE TRIGGER trg_sync_profile_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_rating();
