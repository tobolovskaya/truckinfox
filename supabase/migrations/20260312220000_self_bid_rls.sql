-- =============================================================================
-- Prevent a carrier from placing a bid on their own cargo request.
-- Currently only enforced in the UI; this adds a DB-level guarantee.
-- =============================================================================

CREATE POLICY "Carriers cannot bid on their own requests"
  ON public.bids
  FOR INSERT
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM   public.cargo_requests cr
      WHERE  cr.id          = request_id
        AND  cr.customer_id = auth.uid()
    )
  );
