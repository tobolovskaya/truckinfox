-- =============================================================================
-- Counter-offers: customer can propose a different price on a carrier's bid.
-- Flow: carrier places bid (pending) → customer counters (countered) →
--       carrier accepts counter (price updated, pending) or declines (pending).
-- =============================================================================

-- 1. Add 'countered' to bids.status constraint
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_status_check;
ALTER TABLE public.bids
  ADD CONSTRAINT bids_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'countered'));

-- 2. Add counter-offer columns
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS counter_price    NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS counter_note     TEXT,
  ADD COLUMN IF NOT EXISTS countered_at     TIMESTAMPTZ;

-- 3. RLS policies for counter-offer operations
--    Customers can update a bid (to set counter_price / status='countered')
--    only for bids on their own cargo requests.
CREATE POLICY "Customer can counter a bid on their request"
  ON public.bids FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cargo_requests r
      WHERE r.id = bids.request_id
        AND r.customer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cargo_requests r
      WHERE r.id = bids.request_id
        AND r.customer_id = auth.uid()
    )
  );

--    Carriers can update their own bid status (accept/decline counter).
CREATE POLICY "Carrier can respond to a counter on their own bid"
  ON public.bids FOR UPDATE TO authenticated
  USING  (carrier_id = auth.uid())
  WITH CHECK (carrier_id = auth.uid());
