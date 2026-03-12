-- =============================================================================
-- Trigger: keep escrow_payments.status in sync whenever
-- orders.payment_status is set to 'released'.
--
-- Covers ALL code paths (Edge Functions, SQL functions, admin updates)
-- so escrow can never end up stranded as 'paid' after funds are released.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_escrow_on_payment_released()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when payment_status transitions into 'released'
  IF NEW.payment_status = 'released'
    AND (OLD.payment_status IS DISTINCT FROM 'released')
  THEN
    UPDATE public.escrow_payments
    SET    status     = 'released',
           updated_at = NOW()
    WHERE  order_id = NEW.id
      AND  status  <> 'released';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_escrow_on_payment_released ON public.orders;

CREATE TRIGGER trg_sync_escrow_on_payment_released
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_escrow_on_payment_released();
