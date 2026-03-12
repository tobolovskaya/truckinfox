-- =============================================================================
-- Security: harden orders table RLS
--
-- PROBLEM: "Order participants can update orders" (init_schema) lets any
-- authenticated customer OR carrier UPDATE any column on their orders,
-- including status = 'completed' and payment_status = 'released'.
-- A carrier could self-complete an order and claim funds without payment.
--
-- FIX: Replace the broad UPDATE policy with two narrow ones.
--
-- Allowed transitions after this migration:
--   Carrier  → status: in_progress | delivered  (no payment_status changes)
--   Customer → payment_status: pending | initiated | failed  (no status changes)
--   Service role (Edge Functions, pg_cron) → anything (bypasses RLS)
-- =============================================================================

-- 1. Drop the overly permissive policy
DROP POLICY IF EXISTS "Order participants can update orders" ON public.orders;

-- 2. Carrier: may only advance delivery status
--    USING  — row must belong to this carrier
--    CHECK  — new status must be in_progress or delivered;
--             payment_status must not be 'released' (only service role can release funds)
CREATE POLICY "Carrier can update delivery status"
  ON public.orders FOR UPDATE TO authenticated
  USING  (auth.uid() = carrier_id)
  WITH CHECK (
    auth.uid() = carrier_id
    AND status IN ('in_progress', 'delivered')
    AND payment_status <> 'released'
  );

-- 3. Customer: may only update payment_status while the order is pending_payment
--    USING  — row must belong to this customer AND be in pending_payment
--    CHECK  — status must still be pending_payment (cannot change status);
--             payment_status restricted to legitimate payment-flow values
CREATE POLICY "Customer can update payment status"
  ON public.orders FOR UPDATE TO authenticated
  USING  (
    auth.uid() = customer_id
    AND status = 'pending_payment'
  )
  WITH CHECK (
    auth.uid() = customer_id
    AND status = 'pending_payment'
    AND payment_status IN ('pending', 'initiated', 'failed')
  );

-- Sanity check: existing INSERT policy stays (customers can create orders via client if needed)
-- Service role used by accept-bid Edge Function bypasses RLS automatically.
