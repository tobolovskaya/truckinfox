-- =============================================================================
-- Fix: 3 critical RLS security vulnerabilities
--
-- BUG 1: escrow_payments UPDATE has no WITH CHECK → carrier can self-release funds
--   FIX: Drop the UPDATE policy entirely. All escrow state transitions happen via
--        edge functions (service_role key, bypasses RLS). No client needs to UPDATE.
--
-- BUG 2: chats INSERT only checks auth.uid() IN (user_a_id, user_b_id) → any
--        authenticated user can open a chat with any other user with no relationship.
--   FIX: Require a shared cargo_request (customer + bidding carrier) or order.
--
-- BUG 3: messages "Users can send messages via request" INSERT only checks
--        sender_id = auth.uid() AND request_id IS NOT NULL → anyone can write to
--        any request_id they invent.
--   FIX: Also verify the caller is the request's customer or a bidder on it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BUG 1: Drop escrow_payments UPDATE policy — no client-side updates needed
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Escrow participants can update escrow state" ON public.escrow_payments;

-- ---------------------------------------------------------------------------
-- BUG 2: chats INSERT — require a shared relationship between both users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;

CREATE POLICY "Users can create chats only with related parties"
  ON public.chats FOR INSERT
  WITH CHECK (
    -- caller must be one of the two participants
    (auth.uid() = user_a_id OR auth.uid() = user_b_id)
    AND (
      -- they share an order (as customer + carrier)
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE
          (o.customer_id = user_a_id AND o.carrier_id = user_b_id)
          OR (o.customer_id = user_b_id AND o.carrier_id = user_a_id)
      )
      OR
      -- or the carrier has bid on a request owned by the other user
      EXISTS (
        SELECT 1
        FROM public.cargo_requests cr
        JOIN public.bids b ON b.request_id = cr.id
        WHERE
          (cr.customer_id = user_a_id AND b.carrier_id = user_b_id)
          OR (cr.customer_id = user_b_id AND b.carrier_id = user_a_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- BUG 3: messages legacy path — verify caller has access to the request
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can send messages via request" ON public.messages;

CREATE POLICY "Users can send messages via request"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND request_id IS NOT NULL
    AND chat_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.cargo_requests cr
      WHERE cr.id = request_id
        AND (
          -- caller is the customer who owns the request
          cr.customer_id = auth.uid()
          OR
          -- caller is a carrier who has bid on this request
          EXISTS (
            SELECT 1 FROM public.bids b
            WHERE b.request_id = cr.id AND b.carrier_id = auth.uid()
          )
        )
    )
  );
