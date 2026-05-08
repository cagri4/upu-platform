-- pg_cron + pg_net extensions enable
--
-- ⚠️ NOT (2026-05-08): Bu migration ilk hâlinde cron.schedule içine Bearer token
-- literal olarak gömülmüştü; GitGuardian sızıntıyı flag etti. Token rotate edildi,
-- bu dosya sanitized. cron.schedule çağrısı artık migration'da YAPILMIYOR;
-- Supabase Dashboard SQL Editor'dan manuel olarak çalıştırılmalı (sır gizliliği için).
--
-- Kurulum (bir kerelik, manuel):
--   Database > SQL Editor > New query >
--     SELECT cron.unschedule('emlak-takvim-dispatch');  -- varsa kaldır
--     SELECT cron.schedule('emlak-takvim-dispatch', '* * * * *', $$
--       SELECT net.http_post(
--         url := 'https://estateai.upudev.nl/api/calendar/send-reminder',
--         headers := jsonb_build_object(
--           'Authorization', 'Bearer <CRON_SECRET>',
--           'Content-Type', 'application/json'
--         ),
--         body := '{}'::jsonb
--       );
--     $$);
--
-- <CRON_SECRET> Vercel production env'inden alınır (vercel env ls + decrypt).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
