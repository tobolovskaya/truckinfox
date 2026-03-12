-- =============================================================================
-- Fix: remove 'accepted → active' from sync_order_status_from_bid_status
--
-- PROBLEM: When a bid is accepted the AFTER trigger fires (same transaction)
-- and writes orders.status = 'active'. The accept-bid Edge Function then
-- issues a separate UPDATE to orders.status = 'pending_payment'. If that
-- second UPDATE fails (network error, etc.) the order is permanently stuck
-- in 'active' and the payment flow can never start.
--
-- FIX: Remove the 'accepted' branch from the trigger entirely.
-- The accept-bid Edge Function is the sole owner of the accepted → pending_payment
-- transition. The trigger keeps only rejected/withdrawn → cancelled, which
-- covers provisional orders that were never confirmed by an Edge Function.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_order_status_from_bid_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order_status TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- 'accepted' is intentionally excluded: the accept-bid Edge Function
  -- owns that transition and sets status = 'pending_payment' directly.
  IF lower(coalesce(NEW.status, '')) IN ('rejected', 'withdrawn') THEN
    target_order_status := 'cancelled';
  END IF;

  IF target_order_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.orders
  SET
    status     = target_order_status,
    updated_at = now()
  WHERE bid_id = NEW.id
    AND status IS DISTINCT FROM target_order_status;

  RETURN NEW;
END;
$$;
