-- =============================================================================
-- Auto-confirm deliveries: protect carriers from non-responsive customers.
-- Orders in 'delivered' status for 3+ days are moved to 'completed' and
-- funds are marked 'released'. Runs daily at 03:00 UTC via pg_cron.
-- =============================================================================

-- PL/pgSQL function that does the work directly in the DB.
-- Called by pg_cron; no HTTP round-trip needed.
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

-- To schedule this function:
-- Option A (Supabase Pro): enable pg_cron extension in the dashboard, then run:
--   SELECT cron.schedule('auto-confirm-deliveries', '0 3 * * *', 'SELECT public.auto_confirm_deliveries()');
-- Option B: invoke the auto-confirm-deliveries Edge Function daily via external cron (e.g. GitHub Actions).
