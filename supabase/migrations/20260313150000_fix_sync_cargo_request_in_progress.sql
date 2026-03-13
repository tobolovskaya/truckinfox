-- =============================================================================
-- Fix: sync_cargo_request_status_from_order trigger misses 'in_progress'
--
-- PROBLEM: The trigger maps order status → cargo_request status but only
-- recognises 'in_transit'. Orders now use 'in_progress' (set by the
-- update-order-status Edge Function). When an order moves to 'in_progress'
-- the cargo_request status stays at 'accepted' — broken search/filter view.
--
-- FIX: Also match 'in_progress' and map it to cargo_request 'in_transit'
-- (cargo_requests has no 'in_progress' status in its CHECK constraint).
-- =============================================================================

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

  IF normalized_status IN ('in_transit', 'in_progress') THEN
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

-- Trigger definition is unchanged; recreating ensures the new function body is live.
DROP TRIGGER IF EXISTS trg_sync_cargo_request_status_from_order ON public.orders;
CREATE TRIGGER trg_sync_cargo_request_status_from_order
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_cargo_request_status_from_order();
