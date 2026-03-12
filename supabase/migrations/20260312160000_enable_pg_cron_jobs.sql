-- =============================================================================
-- pg_cron: scheduled background jobs
-- Requires: Supabase Pro plan — enable the pg_cron extension in the
--           Supabase dashboard (Database → Extensions → pg_cron) BEFORE
--           pushing this migration.
--
-- Jobs registered here:
--   1. expire-stale-bids       — hourly,  marks pending bids expired after 48 h
--   2. auto-confirm-deliveries — 03:00 UTC daily, auto-completes 3-day-old deliveries
--   3. cleanup-old-tracking    — 02:00 UTC daily, deletes tracking points > 30 days
--   4. cleanup-old-notifications — 04:00 UTC daily, deletes read notifications > 90 days
-- =============================================================================

-- Enable extension (no-op if already enabled; fails gracefully on free tier)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role (Supabase requires this)
GRANT USAGE ON SCHEMA cron TO postgres;

-- ---------------------------------------------------------------------------
-- Helper: schedule or reschedule a job (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN

  -- 1. expire-stale-bids: every hour at :00
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-bids') THEN
    PERFORM cron.unschedule('expire-stale-bids');
  END IF;
  PERFORM cron.schedule(
    'expire-stale-bids',
    '0 * * * *',
    'SELECT public.expire_stale_bids()'
  );

  -- 2. auto-confirm-deliveries: daily at 03:00 UTC
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-deliveries') THEN
    PERFORM cron.unschedule('auto-confirm-deliveries');
  END IF;
  PERFORM cron.schedule(
    'auto-confirm-deliveries',
    '0 3 * * *',
    'SELECT public.auto_confirm_deliveries()'
  );

  -- 3. cleanup-old-tracking: daily at 02:00 UTC
  --    Deletes GPS tracking points older than 30 days.
  --    The tracking table can grow to millions of rows quickly; this keeps it lean.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-tracking') THEN
    PERFORM cron.unschedule('cleanup-old-tracking');
  END IF;
  PERFORM cron.schedule(
    'cleanup-old-tracking',
    '0 2 * * *',
    $$
      DELETE FROM public.tracking
      WHERE recorded_at < NOW() - INTERVAL '30 days'
    $$
  );

  -- 4. cleanup-old-notifications: daily at 04:00 UTC
  --    Deletes read notifications older than 90 days to keep the table small.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-notifications') THEN
    PERFORM cron.unschedule('cleanup-old-notifications');
  END IF;
  PERFORM cron.schedule(
    'cleanup-old-notifications',
    '0 4 * * *',
    $$
      DELETE FROM public.notifications
      WHERE read = true
        AND created_at < NOW() - INTERVAL '90 days'
    $$
  );

END;
$$;

-- ---------------------------------------------------------------------------
-- Verify: list all registered jobs (shows up in migration output)
-- ---------------------------------------------------------------------------
SELECT jobid, jobname, schedule, command
FROM cron.job
ORDER BY jobname;
