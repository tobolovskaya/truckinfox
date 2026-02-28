-- TruckInfoX: monthly partitioning playbook for tracking + messages
-- Target: staging first, then production maintenance window.
-- PostgreSQL/Supabase notes:
-- 1) We use RANGE partitioning by timestamp.
-- 2) For messages, partition key is created_at, so PK becomes (id, created_at).
-- 3) Keep old tables as *_legacy until rollback window closes.

BEGIN;

-- ============================================================================
-- A) TRACKING: create partitioned replacement
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tracking_p (
  id              UUID DEFAULT uuid_generate_v4(),
  truck_id        UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  request_id      UUID REFERENCES public.cargo_requests(id) ON DELETE SET NULL,
  country_code    CHAR(2) NOT NULL DEFAULT 'NO',
  latitude        NUMERIC(10, 7) NOT NULL,
  longitude       NUMERIC(10, 7) NOT NULL,
  location        GEOGRAPHY(POINT, 4326),
  altitude_m      NUMERIC(8, 2),
  accuracy_m      NUMERIC(8, 2),
  speed_kmh       NUMERIC(6, 2),
  heading_deg     NUMERIC(5, 2),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE INDEX IF NOT EXISTS idx_tracking_p_truck_recorded
  ON public.tracking_p(truck_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_p_request_id
  ON public.tracking_p(request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_p_country_recorded
  ON public.tracking_p(country_code, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_p_country_request_recorded
  ON public.tracking_p(country_code, request_id, recorded_at DESC)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_p_coordinates
  ON public.tracking_p(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_tracking_p_location_gist
  ON public.tracking_p USING GIST(location);

ALTER TABLE public.tracking_p ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carriers can insert tracking for their trucks"
  ON public.tracking_p FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trucks t
      WHERE t.id = truck_id AND t.carrier_id = auth.uid()
    )
  );

CREATE POLICY "Carriers can view their own tracking"
  ON public.tracking_p FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trucks t
      WHERE t.id = truck_id AND t.carrier_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view tracking for their active requests"
  ON public.tracking_p FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cargo_requests cr
      WHERE cr.id = request_id AND cr.customer_id = auth.uid()
        AND cr.status = 'in_transit'
    )
  );

-- ============================================================================
-- B) MESSAGES: create partitioned replacement
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages_p (
  id              UUID DEFAULT uuid_generate_v4(),
  chat_id         UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         TEXT,
  media_url       TEXT,
  media_type      TEXT CHECK (media_type IN ('image', 'video', 'file', NULL)),
  sender_type     TEXT CHECK (sender_type IN ('customer', 'carrier', 'system')),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id      UUID REFERENCES public.cargo_requests(id) ON DELETE SET NULL,
  receiver_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (content IS NOT NULL OR media_url IS NOT NULL),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_messages_p_chat_id
  ON public.messages_p(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_p_sender_id
  ON public.messages_p(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_p_unread
  ON public.messages_p(chat_id, read_at)
  WHERE read_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_p_chat_created_desc
  ON public.messages_p(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_p_created_at
  ON public.messages_p(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_p_request_id_created_at
  ON public.messages_p(request_id, created_at ASC)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_p_receiver_unread
  ON public.messages_p(receiver_id, request_id, read_at)
  WHERE receiver_id IS NOT NULL AND read_at IS NULL AND deleted_at IS NULL;

ALTER TABLE public.messages_p ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages"
  ON public.messages_p FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can send messages"
  ON public.messages_p FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Sender can update their messages"
  ON public.messages_p FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Receiver can mark messages as read"
  ON public.messages_p FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
        AND auth.uid() <> sender_id
    )
  );

CREATE POLICY "Admins have full access to messages"
  ON public.messages_p FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

-- ============================================================================
-- C) Partition-creation helpers (monthly)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_tracking_partition_for_month(p_month DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_start DATE := date_trunc('month', p_month)::date;
  v_end   DATE := (date_trunc('month', p_month) + interval '1 month')::date;
  v_name  TEXT := format('tracking_%s', to_char(v_start, 'YYYYMM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.tracking_p FOR VALUES FROM (%L) TO (%L);',
    v_name, v_start, v_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_messages_partition_for_month(p_month DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_start DATE := date_trunc('month', p_month)::date;
  v_end   DATE := (date_trunc('month', p_month) + interval '1 month')::date;
  v_name  TEXT := format('messages_%s', to_char(v_start, 'YYYYMM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.messages_p FOR VALUES FROM (%L) TO (%L);',
    v_name, v_start, v_end
  );
END;
$$;

-- Pre-create previous/current/next month partitions
SELECT public.ensure_tracking_partition_for_month((date_trunc('month', now()) - interval '1 month')::date);
SELECT public.ensure_tracking_partition_for_month(date_trunc('month', now())::date);
SELECT public.ensure_tracking_partition_for_month((date_trunc('month', now()) + interval '1 month')::date);

SELECT public.ensure_messages_partition_for_month((date_trunc('month', now()) - interval '1 month')::date);
SELECT public.ensure_messages_partition_for_month(date_trunc('month', now())::date);
SELECT public.ensure_messages_partition_for_month((date_trunc('month', now()) + interval '1 month')::date);

-- ============================================================================
-- D) Data migration + swap (maintenance window)
-- ============================================================================
-- 1) Backfill existing rows
INSERT INTO public.tracking_p
SELECT * FROM public.tracking;

INSERT INTO public.messages_p
SELECT * FROM public.messages;

-- 2) Fast swap (short lock window)
BEGIN;
LOCK TABLE public.tracking IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.messages IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.tracking RENAME TO tracking_legacy;
ALTER TABLE public.messages RENAME TO messages_legacy;

ALTER TABLE public.tracking_p RENAME TO tracking;
ALTER TABLE public.messages_p RENAME TO messages;
COMMIT;

-- 3) Re-bind realtime publication to new table OIDs
ALTER PUBLICATION supabase_realtime DROP TABLE public.tracking;
ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 4) Rollback pattern (if needed)
-- BEGIN;
-- LOCK TABLE public.tracking IN ACCESS EXCLUSIVE MODE;
-- LOCK TABLE public.messages IN ACCESS EXCLUSIVE MODE;
-- ALTER TABLE public.tracking RENAME TO tracking_p_failed;
-- ALTER TABLE public.messages RENAME TO messages_p_failed;
-- ALTER TABLE public.tracking_legacy RENAME TO tracking;
-- ALTER TABLE public.messages_legacy RENAME TO messages;
-- COMMIT;

-- 5) After validation period, drop legacy tables manually
-- DROP TABLE public.tracking_legacy;
-- DROP TABLE public.messages_legacy;
