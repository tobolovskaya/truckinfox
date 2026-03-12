-- Add 'assigned' to cargo_requests.status CHECK constraint.
-- accept-bid Edge Function sets status = 'assigned' after a bid is accepted,
-- but the original constraint did not include this value, causing a 500 error.

ALTER TABLE public.cargo_requests
  DROP CONSTRAINT IF EXISTS cargo_requests_status_check;

ALTER TABLE public.cargo_requests
  ADD CONSTRAINT cargo_requests_status_check
  CHECK (status IN ('open', 'bidding', 'assigned', 'accepted', 'in_transit', 'delivered', 'cancelled'));
