-- =============================================================================
-- TruckInfoX — Enhancement Migration
-- =============================================================================
-- Addresses all items from the Supabase audit checklist:
--   1. truck_tracking view (alias for tracking, as required by problem spec)
--   2. chat_participants table (normalized N-party participant structure)
--   3. trucks storage bucket + policies (for truck media files)
--   4. chat storage bucket + policies (for chat media files, private)
--   5. audit_log table (GDPR compliance)
--   6. Messages RLS fix for legacy request_id / receiver_id path
--   7. Realtime publications for bids, orders, chat_participants
--   8. Additional indexes for performance
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. truck_tracking VIEW
-- ---------------------------------------------------------------------------
-- Alias for the `tracking` table. Exposes the same columns so ORM models can
-- reference either name. Inherits RLS from the underlying tracking table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.truck_tracking AS
SELECT
  id,
  truck_id,
  request_id,
  latitude,
  longitude,
  altitude_m,
  accuracy_m,
  speed_kmh,
  heading_deg,
  recorded_at,
  created_at
FROM public.tracking;

-- ---------------------------------------------------------------------------
-- 2. chat_participants TABLE
-- ---------------------------------------------------------------------------
-- Normalized participant list for each chat. Kept in sync with chats.user_a_id
-- / user_b_id via a trigger. Enables future group-chat support without schema
-- changes to chats.
-- Node.js ORM: belongsTo(Chat, { foreignKey: 'chat_id' })
--              belongsTo(Profile, { foreignKey: 'user_id' })
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_participants (
  chat_id      UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 'member' for regular participants; 'admin' reserved for future moderation
  role         TEXT NOT NULL DEFAULT 'member'
                 CHECK (role IN ('member', 'admin')),

  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Tracks what each participant has read (used for unread badge counts)
  last_read_at TIMESTAMPTZ,

  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id
  ON public.chat_participants(user_id);

-- RLS
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Each user can see the chats they are part of
CREATE POLICY "Users can view their own chat participations"
  ON public.chat_participants FOR SELECT
  USING (auth.uid() = user_id);

-- Chat members can see all other participants of the same chat (via chats table)
CREATE POLICY "Chat members can view all participants in their chats"
  ON public.chat_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- Authenticated users can join a chat they belong to
CREATE POLICY "Authenticated users can join chats"
  ON public.chat_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Participants can update their own read cursor
CREATE POLICY "Participants can update their own membership"
  ON public.chat_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Backfill chat_participants from all existing chats
-- ---------------------------------------------------------------------------
INSERT INTO public.chat_participants (chat_id, user_id)
SELECT id, user_a_id FROM public.chats
ON CONFLICT DO NOTHING;

INSERT INTO public.chat_participants (chat_id, user_id)
SELECT id, user_b_id FROM public.chats
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Trigger: keep chat_participants in sync when a new chat row is created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_chat_participants()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (NEW.id, NEW.user_a_id), (NEW.id, NEW.user_b_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_chat_participants ON public.chats;
CREATE TRIGGER trg_sync_chat_participants
  AFTER INSERT ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.sync_chat_participants();

-- ---------------------------------------------------------------------------
-- 3. Storage bucket: trucks
-- ---------------------------------------------------------------------------
-- Stores truck images at path: trucks/{user_id}/{truck_id}/{filename}
-- Public read (trucks are publicly listed), authenticated write by owner.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trucks',
  'trucks',
  true,
  10485760, -- 10 MiB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read trucks'
  ) THEN
    CREATE POLICY "Public read trucks"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'trucks');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Carriers upload own truck images'
  ) THEN
    CREATE POLICY "Carriers upload own truck images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'trucks'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Carriers update own truck images'
  ) THEN
    CREATE POLICY "Carriers update own truck images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'trucks'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'trucks'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Carriers delete own truck images'
  ) THEN
    CREATE POLICY "Carriers delete own truck images"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'trucks'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket: chat
-- ---------------------------------------------------------------------------
-- Stores chat media at path: chat/{chat_id}/{message_id}/{filename}
-- Private: only participants of the chat may read or write.
-- Supports images, video and PDF attachments.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat',
  'chat',
  false,
  52428800, -- 50 MiB (allows short video clips)
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  -- Read: only authenticated participants of the chat
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Chat participants can read chat files'
  ) THEN
    CREATE POLICY "Chat participants can read chat files"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'chat'
        AND EXISTS (
          SELECT 1 FROM public.chats c
          WHERE c.id::text = (storage.foldername(name))[1]
            AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
        )
      );
  END IF;

  -- Upload: authenticated sender must be a participant of that chat
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload chat files'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat files"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'chat'
        AND EXISTS (
          SELECT 1 FROM public.chats c
          WHERE c.id::text = (storage.foldername(name))[1]
            AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
        )
      );
  END IF;

  -- Delete: only participants may remove chat files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users delete own chat files'
  ) THEN
    CREATE POLICY "Users delete own chat files"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'chat'
        AND EXISTS (
          SELECT 1 FROM public.chats c
          WHERE c.id::text = (storage.foldername(name))[1]
            AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. audit_log TABLE (GDPR / security compliance)
-- ---------------------------------------------------------------------------
-- Append-only log of sensitive mutations. Only service_role (backend jobs)
-- and SECURITY DEFINER functions may write. No authenticated/anon SELECT
-- policy is created intentionally — direct client access is blocked by RLS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action (NULL if the user was deleted)
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- e.g. 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'PASSWORD_RESET'
  action      TEXT NOT NULL,

  -- Target table and primary key of the affected row
  table_name  TEXT,
  record_id   UUID,

  -- Snapshot of data before/after for auditable changes
  old_data    JSONB,
  new_data    JSONB,

  -- Request metadata (populated by backend / Edge Function)
  ip_address  INET,
  user_agent  TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- No permissive policies for anon/authenticated — service_role bypasses RLS.
-- This prevents any client from reading or writing audit data directly.

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON public.audit_log(table_name, record_id)
  WHERE table_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log(created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Fix messages RLS for legacy request_id / receiver_id path
-- ---------------------------------------------------------------------------
-- The original policies only check via chat_id, but the app also writes
-- messages using request_id + sender_id + receiver_id (Firebase-compat path).
-- These supplementary policies close that security gap.
-- ---------------------------------------------------------------------------

-- Allow reading messages sent/received directly via request_id
DROP POLICY IF EXISTS "Chat participants can view messages via request" ON public.messages;
CREATE POLICY "Chat participants can view messages via request"
  ON public.messages FOR SELECT
  USING (
    request_id IS NOT NULL
    AND chat_id IS NULL
    AND (
      auth.uid() = sender_id
      OR auth.uid() = receiver_id
      OR EXISTS (
        SELECT 1 FROM public.cargo_requests cr
        WHERE cr.id = request_id
          AND (
            cr.customer_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.bids b
              WHERE b.request_id = cr.id AND b.carrier_id = auth.uid()
            )
          )
      )
    )
  );

-- Allow sending messages via request_id (legacy path, no chat_id yet)
DROP POLICY IF EXISTS "Users can send messages via request" ON public.messages;
CREATE POLICY "Users can send messages via request"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND request_id IS NOT NULL
    AND chat_id IS NULL
  );

-- ---------------------------------------------------------------------------
-- 7. Realtime publications
-- ---------------------------------------------------------------------------
-- Add tables that benefit from live client subscriptions.
-- bids: real-time bid notifications for customers
-- orders: live order status for both parties
-- chat_participants: membership changes (e.g. user leaves a chat)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- bids
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
  END IF;

  -- orders
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  -- chat_participants
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Additional performance indexes
-- ---------------------------------------------------------------------------

-- messages: fast lookup of all messages sent by a user across all chats
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON public.messages(sender_id, created_at DESC);

-- messages: GIN index on media_type for filtering by attachment kind
CREATE INDEX IF NOT EXISTS idx_messages_media_type
  ON public.messages(media_type)
  WHERE media_type IS NOT NULL;

-- orders: composite index for status + created_at (common list queries)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders(status, created_at DESC);

-- bids: composite for filtering per request by status
CREATE INDEX IF NOT EXISTS idx_bids_request_status
  ON public.bids(request_id, status);

-- orders: JSONB GIN index for extensible metadata queries
CREATE INDEX IF NOT EXISTS idx_orders_metadata
  ON public.orders USING GIN(metadata);

-- escrow_payments: JSONB GIN index for extensible metadata queries
CREATE INDEX IF NOT EXISTS idx_escrow_metadata
  ON public.escrow_payments USING GIN(metadata);

-- notifications: partial index on undelivered push notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread_push
  ON public.notifications(user_id, created_at DESC)
  WHERE read = FALSE;
