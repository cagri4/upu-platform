-- pg_cron extension + emlak-takvim-dispatch schedule
-- (extensions zaten yüklü, NOTICE skip)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron job (CRON_SECRET hard-coded — ALTER DATABASE permission denied Supabase)
DO $migration$
BEGIN
  -- Eski varsa unschedule
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'emlak-takvim-dispatch') THEN
    PERFORM cron.unschedule('emlak-takvim-dispatch');
  END IF;

  PERFORM cron.schedule(
    'emlak-takvim-dispatch',
    '* * * * *',
    $cmd$
    SELECT net.http_post(
      url := 'https://estateai.upudev.nl/api/calendar/send-reminder',
      headers := jsonb_build_object(
        'Authorization', 'Bearer 6e7f342fa38209ede0f96e2e474ea6ca7745027212f4ed01',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
    $cmd$
  );
END $migration$;
