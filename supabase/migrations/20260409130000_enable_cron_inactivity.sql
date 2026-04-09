-- Enable pg_cron + pg_net to run scheduled HTTP calls from inside Postgres.
-- Used by the gamification engine to drive /api/cron/inactivity-check at a
-- 15-minute interval. Vercel Hobby plan rejects sub-daily crons, so we
-- schedule from Supabase (Pro) and let it call the Vercel endpoint over HTTP.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Drop any previous version of this schedule so re-running the migration
-- is idempotent. cron.unschedule throws if the job doesn't exist, so wrap it.
DO $$
BEGIN
  PERFORM cron.unschedule('inactivity-check-15min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule: every 15 minutes, GET the Vercel endpoint. The endpoint itself
-- enforces quiet hours, cooldowns, and opt-out — we only need the tick.
SELECT cron.schedule(
  'inactivity-check-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://panel.upudev.nl/api/cron/inactivity-check',
    timeout_milliseconds := 30000
  );
  $$
);
