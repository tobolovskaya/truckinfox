-- =============================================================================
-- Bid expiration: pending bids expire after 48 hours.
-- Protects marketplace freshness — carriers won't get surprise acceptances
-- on stale bids, and customers see only live offers.
-- =============================================================================

-- 1. Add 'expired' to bids.status constraint
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_status_check;
ALTER TABLE public.bids
  ADD CONSTRAINT bids_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired'));

-- 2. Add expires_at column (48h after creation, set on insert via default)
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
  NOT NULL DEFAULT NOW() + INTERVAL '48 hours';

-- Backfill existing rows so they don't immediately expire
UPDATE public.bids
SET expires_at = created_at + INTERVAL '48 hours'
WHERE expires_at < created_at + INTERVAL '48 hours';

-- 3. Index for efficient expiry sweeps
CREATE INDEX IF NOT EXISTS idx_bids_expires_at
  ON public.bids(expires_at)
  WHERE status = 'pending';

-- 4. Function: mark all overdue pending bids as expired
CREATE OR REPLACE FUNCTION public.expire_stale_bids()
RETURNS TABLE (expired_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    UPDATE public.bids
    SET    status     = 'expired',
           updated_at = NOW()
    WHERE  status     = 'pending'
      AND  expires_at <= NOW()
    RETURNING id, carrier_id, request_id
  LOOP
    -- Notify the carrier that their bid has expired
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      rec.carrier_id,
      'order_status_change',
      'Bid Expired',
      'Your bid was not accepted within 48 hours and has expired.',
      jsonb_build_object('bid_id', rec.id, 'request_id', rec.request_id),
      false
    );

    expired_id := rec.id;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- To schedule this function:
-- Option A (Supabase Pro): enable pg_cron, then run:
--   SELECT cron.schedule('expire-stale-bids', '0 * * * *', 'SELECT public.expire_stale_bids()');
-- Option B: call the function from an Edge Function invoked hourly via external cron.
