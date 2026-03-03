-- Keep provisional orders in sync with bid lifecycle.

CREATE OR REPLACE FUNCTION public.sync_order_status_from_bid_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_status TEXT;
  target_order_status TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  normalized_status := lower(coalesce(NEW.status, ''));
  target_order_status := NULL;

  IF normalized_status = 'accepted' THEN
    target_order_status := 'active';
  ELSIF normalized_status IN ('rejected', 'withdrawn') THEN
    target_order_status := 'cancelled';
  END IF;

  IF target_order_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.orders
  SET
    status = target_order_status,
    updated_at = now()
  WHERE bid_id = NEW.id
    AND status IS DISTINCT FROM target_order_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_status_from_bid_status ON public.bids;
CREATE TRIGGER trg_sync_order_status_from_bid_status
AFTER UPDATE OF status ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_status_from_bid_status();
