-- =============================================================================
-- TruckInfoX — Security, Indexing, Triggers & Activity Log Migration
-- =============================================================================
-- Addresses the expanded Supabase audit checklist:
--   1. Admin RLS policies for trucks, chats, messages
--      (owner-only visibility; administrator gets full access)
--   2. Additional performance indexes
--      (created_at, country_code, user_id, chat_id)
--   3. Storage media cleanup triggers
--      (delete Storage objects when a trucks / messages row is deleted)
--   4. activity_log table + log_activity() helper function
--      (user-facing event log, separate from the security audit_log)
--   5. Storage bucket admin policies
--      (only owner or administrator may read/write private buckets)
--   6. Backup strategy documentation (see SUPABASE_MIGRATION_PLAN.md §9)
--
-- Security notes
--   • is_admin() is a SECURITY DEFINER function so the underlying query
--     always runs as the function owner (postgres), preventing privilege
--     escalation through the profiles table.
--   • Storage cleanup triggers also run as SECURITY DEFINER so they can
--     bypass the storage.objects RLS that would otherwise block the delete.
--   • activity_log has NO permissive SELECT policy for regular users —
--     only service_role (backend) and SECURITY DEFINER functions may write.
--   • All new policies use IF NOT EXISTS guards so the migration is
--     idempotent and safe to re-apply.
--
-- GDPR compliance
--   • activity_log.user_id sets NULL on profile deletion (soft anonymisation).
--   • Storage cleanup triggers ensure physical media is removed when a
--     truck or message record is hard-deleted (right to erasure).
--
-- Future scaling
--   • is_admin() result can be cached per session with SET LOCAL / GUC if
--     call volume becomes a concern.
--   • Additional indexes use partial predicates and composite keys to keep
--     their size small even at millions of rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: identify administrators
-- ---------------------------------------------------------------------------
-- Admins are profiles where is_admin = TRUE.
-- The column is set to FALSE for every new user by default and can only be
-- flipped by a backend job using the service_role key (bypasses RLS).
-- The function runs as SECURITY DEFINER so that the profiles lookup is never
-- subject to the calling user's RLS context.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles(is_admin)
  WHERE is_admin = TRUE;

-- Returns TRUE when the currently authenticated user is an administrator.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Admin RLS policies — trucks
-- ---------------------------------------------------------------------------
-- Owners (carrier_id = auth.uid()) already have write access via existing
-- policies.  Administrators get unrestricted CRUD over every truck record,
-- which is required for moderation (e.g. removing fraudulent listings).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trucks'
      AND policyname = 'Admins have full access to trucks'
  ) THEN
    CREATE POLICY "Admins have full access to trucks"
      ON public.trucks FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1b. Admin RLS policies — chats
-- ---------------------------------------------------------------------------
-- Chat participants already can read/write their own chats.
-- Admins get full visibility for dispute resolution and GDPR investigations.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chats'
      AND policyname = 'Admins have full access to chats'
  ) THEN
    CREATE POLICY "Admins have full access to chats"
      ON public.chats FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1c. Admin RLS policies — messages
-- ---------------------------------------------------------------------------
-- Message authors can already update/soft-delete their own messages.
-- Admins can read and hard-delete any message (e.g. illegal content removal).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'Admins have full access to messages'
  ) THEN
    CREATE POLICY "Admins have full access to messages"
      ON public.messages FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Additional performance indexes
-- ---------------------------------------------------------------------------
-- Trucks ─ frequently filtered by creation time for "newest listings" queries
CREATE INDEX IF NOT EXISTS idx_trucks_created_at
  ON public.trucks(created_at DESC);

-- Trucks ─ carrier + creation time (carrier's own fleet list, paginated)
CREATE INDEX IF NOT EXISTS idx_trucks_carrier_created
  ON public.trucks(carrier_id, created_at DESC);

-- Chats ─ creation time for admin dashboards and pagination
CREATE INDEX IF NOT EXISTS idx_chats_created_at
  ON public.chats(created_at DESC);

-- Chats ─ user + creation time (list of chats for a user, newest first)
CREATE INDEX IF NOT EXISTS idx_chats_user_a_created
  ON public.chats(user_a_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_user_b_created
  ON public.chats(user_b_id, created_at DESC);

-- Messages ─ creation time for admin dashboards
CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON public.messages(created_at DESC);

-- Messages ─ composite (chat_id, created_at) already exists as
-- idx_messages_chat_id with ASC order; add DESC variant for "latest N"
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_desc
  ON public.messages(chat_id, created_at DESC);

-- Profiles ─ country_code already indexed; add combined with created_at
-- for "newest users per country" admin reports
CREATE INDEX IF NOT EXISTS idx_profiles_country_created
  ON public.profiles(country_code, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Storage media cleanup triggers
-- ---------------------------------------------------------------------------
-- When a truck row is deleted, remove all Storage objects stored under
--   trucks/{carrier_id}/{truck_id}/*
-- When a message row is deleted AND it has a media_url, remove Storage
-- objects stored under  chat/{chat_id}/{message_id}/*
--
-- Both functions run as SECURITY DEFINER so they can execute
--   DELETE FROM storage.objects
-- even though the calling session may be a regular user.
--
-- NOTE: Supabase Storage stores the object name WITHOUT the bucket prefix,
-- so the path inside the 'trucks' bucket is  carrier_id/truck_id/filename
-- and inside 'chat' is  chat_id/message_id/filename.
-- ---------------------------------------------------------------------------

-- 3a. Truck media cleanup
CREATE OR REPLACE FUNCTION public.delete_truck_storage_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove all images stored for this truck.
  -- Path structure: {carrier_id}/{truck_id}/{filename}
  DELETE FROM storage.objects
  WHERE bucket_id = 'trucks'
    AND name LIKE (OLD.carrier_id::text || '/' || OLD.id::text || '/%');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_truck_media ON public.trucks;
CREATE TRIGGER trg_delete_truck_media
  AFTER DELETE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.delete_truck_storage_media();

-- 3b. Message media cleanup
CREATE OR REPLACE FUNCTION public.delete_message_storage_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only run if the message had an attached media file.
  IF OLD.media_url IS NOT NULL THEN
    -- Path structure: {chat_id}/{message_id}/{filename}
    DELETE FROM storage.objects
    WHERE bucket_id = 'chat'
      AND name LIKE (OLD.chat_id::text || '/' || OLD.id::text || '/%');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_message_media ON public.messages;
CREATE TRIGGER trg_delete_message_media
  AFTER DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.delete_message_storage_media();

-- ---------------------------------------------------------------------------
-- 4. activity_log TABLE + log_activity() helper
-- ---------------------------------------------------------------------------
-- activity_log records high-level application events (user logged in,
-- truck created, order placed …). It is distinct from audit_log which
-- records low-level security mutations with before/after data snapshots.
--
-- Typical callers: Edge Functions, backend services (service_role key).
-- The helper function log_activity() runs as SECURITY DEFINER so it can
-- insert into activity_log even from a restricted session context.
--
-- GDPR: user_id is SET NULL on profile deletion (anonymisation).
--       Records are never deleted automatically; a scheduled job should
--       purge rows older than the retention period (e.g. 2 years).
--
-- Example usage:
--   SELECT public.log_activity(
--     auth.uid(),
--     'truck.created',
--     'trucks',
--     '550e8400-e29b-41d4-a716-446655440000'::uuid,
--     '{"plate_number": "AB12345"}'::jsonb
--   );
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor (NULL after the user account is deleted – GDPR anonymisation)
  user_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Dot-separated event name, e.g. 'truck.created', 'order.status_changed'
  action       TEXT        NOT NULL,

  -- Which table / domain entity the event relates to
  entity_type  TEXT,
  entity_id    UUID,

  -- Arbitrary structured payload (no sensitive PII – use audit_log for that)
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
-- No permissive SELECT/INSERT policy for authenticated users.
-- service_role (backend jobs, Edge Functions) bypasses RLS automatically.

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON public.activity_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON public.activity_log(entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON public.activity_log(created_at DESC);

-- Helper: insert one activity_log record from any SQL context.
-- Parameters:
--   p_user_id     – actor (pass NULL for system events)
--   p_action      – event name (e.g. 'message.deleted')
--   p_entity_type – target table name (e.g. 'messages'), nullable
--   p_entity_id   – primary key of the affected row, nullable
--   p_metadata    – arbitrary JSON payload
-- Returns the new log record's UUID.
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id     UUID,
  p_action      TEXT,
  p_entity_type TEXT    DEFAULT NULL,
  p_entity_id   UUID    DEFAULT NULL,
  p_metadata    JSONB   DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Storage bucket admin policies
-- ---------------------------------------------------------------------------
-- Admins must be able to manage all objects in private buckets (chat, trucks,
-- avatars, cargo) for moderation and GDPR erasure requests.
-- Each policy is idempotent (DO $$ IF NOT EXISTS … END $$).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Admin: full access to the trucks bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins have full access to trucks bucket'
  ) THEN
    CREATE POLICY "Admins have full access to trucks bucket"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'trucks'
        AND public.is_admin()
      )
      WITH CHECK (
        bucket_id = 'trucks'
        AND public.is_admin()
      );
  END IF;

  -- Admin: full access to the chat bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins have full access to chat bucket'
  ) THEN
    CREATE POLICY "Admins have full access to chat bucket"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'chat'
        AND public.is_admin()
      )
      WITH CHECK (
        bucket_id = 'chat'
        AND public.is_admin()
      );
  END IF;

  -- Admin: full access to the avatars bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins have full access to avatars bucket'
  ) THEN
    CREATE POLICY "Admins have full access to avatars bucket"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'avatars'
        AND public.is_admin()
      )
      WITH CHECK (
        bucket_id = 'avatars'
        AND public.is_admin()
      );
  END IF;

  -- Admin: full access to the cargo bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins have full access to cargo bucket'
  ) THEN
    CREATE POLICY "Admins have full access to cargo bucket"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'cargo'
        AND public.is_admin()
      )
      WITH CHECK (
        bucket_id = 'cargo'
        AND public.is_admin()
      );
  END IF;
END $$;
