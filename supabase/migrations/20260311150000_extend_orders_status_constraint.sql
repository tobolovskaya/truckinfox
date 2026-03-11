-- Extend orders.status CHECK constraint to include all statuses
-- required by Edge Functions (update-order-status, accept-bid).
--
-- Previous allowed set: pending, active, in_transit, delivered, cancelled, disputed
-- New allowed set adds:  pending_payment, paid, in_progress, completed, refunded
--
-- Strategy: drop the old constraint, add the new one in one transaction.
-- Existing rows are unaffected because every old value is present in the new set.

BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending',
      'pending_payment',
      'paid',
      'active',
      'in_progress',
      'in_transit',
      'delivered',
      'completed',
      'cancelled',
      'disputed',
      'refunded'
    ));

COMMIT;
