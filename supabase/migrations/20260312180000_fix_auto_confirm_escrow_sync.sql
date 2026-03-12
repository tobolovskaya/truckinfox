-- =============================================================================
-- Fix: auto_confirm_deliveries did not update escrow_payments.status
--
-- PROBLEM: When pg_cron auto-completes a delivered order it set
--   orders.payment_status = 'released'
-- but left the corresponding escrow_payments row in status = 'paid',
-- causing a permanent desynchronisation between the two tables.
--
-- FIX: Replace the function so it atomically updates both tables
-- inside the same loop iteration (single transaction per cron run).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_confirm_deliveries()
RETURNS TABLE (confirmed_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    UPDATE public.orders
    SET
      status         = 'completed',
      payment_status = 'released',
      updated_at     = NOW()
    WHERE status         = 'delivered'
      AND delivered_at  <= NOW() - INTERVAL '3 days'
      AND payment_status <> 'released'
    RETURNING id, customer_id, carrier_id, carrier_amount
  LOOP
    -- Keep escrow_payments in sync: mark the escrow row as released too
    UPDATE public.escrow_payments
    SET
      status     = 'released',
      updated_at = NOW()
    WHERE order_id = rec.id
      AND status   = 'paid';

    -- Notify customer
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      rec.customer_id,
      'order_status_change',
      'Delivery Auto-Confirmed',
      'Your delivery was automatically confirmed after 3 days. Contact support if you have concerns.',
      jsonb_build_object('order_id', rec.id, 'status', 'completed'),
      false
    );

    -- Notify carrier (funds released)
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      rec.carrier_id,
      'payment_success',
      'Payment Released',
      format('Payment of %s NOK released after 3-day auto-confirmation.', rec.carrier_amount),
      jsonb_build_object('order_id', rec.id, 'status', 'completed'),
      false
    );

    confirmed_id := rec.id;
    RETURN NEXT;
  END LOOP;
END;
$$;
