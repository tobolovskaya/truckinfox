-- =============================================================================
-- Add title_key / body_key to server-generated notifications so the mobile
-- app can render them in the user's language via i18n rather than showing
-- the hardcoded English strings stored in title / body columns.
--
-- Affected functions:
--   public.auto_confirm_deliveries()   — customer + carrier notifications
--   public.expire_stale_bids()         — carrier bid-expiry notification
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. auto_confirm_deliveries: include i18n keys and carrier_amount in data
-- ---------------------------------------------------------------------------
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
    -- Keep escrow_payments in sync
    UPDATE public.escrow_payments
    SET
      status     = 'released',
      updated_at = NOW()
    WHERE order_id = rec.id
      AND status   = 'paid';

    -- Notify customer (with i18n keys)
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      rec.customer_id,
      'order_status_change',
      'Delivery Auto-Confirmed',
      'Your delivery was automatically confirmed after 3 days. Contact support if you have concerns.',
      jsonb_build_object(
        'order_id',   rec.id,
        'status',     'completed',
        'title_key',  'notifAutoConfirmTitle',
        'body_key',   'notifAutoConfirmBody'
      ),
      false
    );

    -- Notify carrier (with i18n keys + amount for interpolation)
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      rec.carrier_id,
      'payment_success',
      'Payment Released',
      format('Payment of %s NOK released after 3-day auto-confirmation.', rec.carrier_amount),
      jsonb_build_object(
        'order_id',   rec.id,
        'status',     'completed',
        'amount',     rec.carrier_amount,
        'title_key',  'notifPaymentReleasedTitle',
        'body_key',   'notifPaymentReleasedBody'
      ),
      false
    );

    confirmed_id := rec.id;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. expire_stale_bids: include i18n keys in carrier notification
-- ---------------------------------------------------------------------------
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
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      rec.carrier_id,
      'order_status_change',
      'Bid Expired',
      'Your bid was not accepted within 48 hours and has expired.',
      jsonb_build_object(
        'bid_id',      rec.id,
        'request_id',  rec.request_id,
        'title_key',   'notifBidExpiredTitle',
        'body_key',    'notifBidExpiredBody'
      ),
      false
    );

    expired_id := rec.id;
    RETURN NEXT;
  END LOOP;
END;
$$;
