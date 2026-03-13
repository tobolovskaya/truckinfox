-- =============================================================================
-- Trigger: auto-set orders.status = 'paid' when payment_status transitions to 'paid'
--
-- WHY: The Customer RLS policy only allows updating payment_status to
-- 'pending'|'initiated'|'failed' — it cannot set status = 'paid'.
-- The Vipps Edge Function sets payment_status = 'paid' via service role,
-- but no code path ever advances orders.status from 'pending_payment' to 'paid'.
-- Without status = 'paid', the carrier's canStartTransport check never becomes
-- true and the entire post-payment lifecycle is blocked.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_order_status_on_payment_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
    AND (OLD.payment_status IS DISTINCT FROM 'paid')
    AND NEW.status = 'pending_payment'
  THEN
    NEW.status := 'paid';
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_status_on_payment_paid ON public.orders;
CREATE TRIGGER trg_sync_order_status_on_payment_paid
  BEFORE UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_on_payment_paid();
