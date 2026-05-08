-- ──────────────────────────────────────────────────────────────────────────
-- emlak_calendar_events — Takvim/Hatırlatıcı (2026-05-08)
--
-- Kullanıcı tarih + saat girer, scheduled_at zamanı geldiğinde pg_cron
-- job /api/calendar/send-reminder endpoint'ini çağırır → pending events
-- işlenir → WA mesajı gönderilir → status='sent'.
--
-- Dakika precision Supabase Pro pg_cron ile sağlanır (Vercel cron 5dk min
-- limitini bypass).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS emlak_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / sent / failed / cancelled
  message_template TEXT,                    -- opsiyonel custom mesaj

  related_customer_id UUID REFERENCES emlak_customers(id) ON DELETE SET NULL,
  related_property_id UUID REFERENCES emlak_properties(id) ON DELETE SET NULL,

  sent_at TIMESTAMPTZ,
  error_message TEXT,                       -- failed durumunda log

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_calendar_status CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'))
);

-- pg_cron worker bu index'le pending events'i hızlıca scan eder
CREATE INDEX IF NOT EXISTS idx_calendar_pending_scheduled
  ON emlak_calendar_events(status, scheduled_at)
  WHERE status = 'pending';

-- UI listesi: kullanıcının events'i tarih sırasıyla
CREATE INDEX IF NOT EXISTS idx_calendar_user_scheduled
  ON emlak_calendar_events(user_id, scheduled_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- pg_cron job (manuel olarak Supabase Dashboard SQL Editor'da uygulanır)
-- ──────────────────────────────────────────────────────────────────────────
-- 1. Extension enable (Database > Extensions > pg_cron, pg_net):
--      CREATE EXTENSION IF NOT EXISTS pg_cron;
--      CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- 2. CRON_SECRET'i postgres setting olarak ayarla (Database > Settings):
--      ALTER DATABASE postgres SET app.cron_secret = 'YOUR_CRON_SECRET_HERE';
--      -- (Vercel env CRON_SECRET ile aynı değer)
--
-- 3. Cron job:
--      SELECT cron.schedule(
--        'emlak-takvim-dispatch',
--        '* * * * *',  -- her dakika
--        $$
--        SELECT net.http_post(
--          url := 'https://estateai.upudev.nl/api/calendar/send-reminder',
--          headers := jsonb_build_object(
--            'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
--            'Content-Type', 'application/json'
--          ),
--          body := '{}'::jsonb
--        );
--        $$
--      );
--
-- 4. Doğrulama: SELECT * FROM cron.job WHERE jobname = 'emlak-takvim-dispatch';
-- ──────────────────────────────────────────────────────────────────────────
