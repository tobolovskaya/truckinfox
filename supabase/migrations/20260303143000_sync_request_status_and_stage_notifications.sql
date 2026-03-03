-- Sync cargo_request stage from order stage and emit stage notifications for customer

CREATE OR REPLACE FUNCTION public.sync_cargo_request_status_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_status TEXT;
  next_request_status TEXT;
BEGIN
  IF NEW.request_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  normalized_status := lower(coalesce(NEW.status, ''));
  next_request_status := NULL;

  IF normalized_status = 'in_transit' THEN
    next_request_status := 'in_transit';
  ELSIF normalized_status IN ('delivered', 'completed') THEN
    next_request_status := 'delivered';
  ELSIF normalized_status IN ('cancelled', 'canceled') THEN
    next_request_status := 'cancelled';
  END IF;

  IF next_request_status IS NOT NULL THEN
    UPDATE public.cargo_requests
    SET
      status = next_request_status,
      updated_at = NOW()
    WHERE id = NEW.request_id
      AND status IS DISTINCT FROM next_request_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cargo_request_status_from_order ON public.orders;
CREATE TRIGGER trg_sync_cargo_request_status_from_order
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_cargo_request_status_from_order();

CREATE OR REPLACE FUNCTION public.notify_cargo_request_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_status TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  normalized_status := lower(coalesce(NEW.status, ''));

  IF normalized_status = 'accepted' THEN
    notification_title := 'Pickup confirmed';
    notification_body := 'Your request has moved to pickup planning.';
  ELSIF normalized_status = 'in_transit' THEN
    notification_title := 'In transit';
    notification_body := 'Your vehicle is now in transit.';
  ELSIF normalized_status IN ('delivered', 'completed') THEN
    notification_title := 'Delivered';
    notification_body := 'Your vehicle delivery has been confirmed.';
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      related_id,
      related_type,
      data,
      created_at
    )
    VALUES (
      NEW.customer_id,
      'order_status_change',
      notification_title,
      notification_body,
      NEW.id,
      'cargo_request',
      jsonb_build_object(
        'order_status', normalized_status,
        'request_id', NEW.id
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cargo_request_stage_change ON public.cargo_requests;
CREATE TRIGGER trg_notify_cargo_request_stage_change
AFTER UPDATE OF status ON public.cargo_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_cargo_request_stage_change();
