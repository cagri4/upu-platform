-- Ölü tabloları DEVRE DIŞI bırak — RENAME (DROP DEĞİL, geri dönülebilir)
--
-- DB tasarım denetimi (.planning/DB-DESIGN-AUDIT-2026-06-12.md) net ölü
-- bulduğu, son grep doğrulamasında src/ içinde 0 SORGU referansı olan 7
-- tablo zzz_deprecated_ önekiyle yeniden adlandırılır. DROP YAPILMAZ — veri +
-- şema korunur, geri almak için RENAME tersi yeterli.
--
-- Veri yedeği: supabase/backups/dead-tables-2026-06-12/*.sql (INSERT'ler).
-- Şema: supabase/schema-baseline.sql.
--
-- ATLANANLAR (bu migration'da YOK — kod referansı var, riskli):
--   user_quest_state            → test-state.ts /sifirla temizlik listesinde
--   bayi_dealer_orders          → 49 aktif sorgu referansı (drip/referral/agent/API)
--   bayi_dealer_order_items     → 2 aktif insert
--   bayi_dealer_order_status_history → 5 aktif insert
--
-- IF EXISTS → idempotent (tekrar çalışırsa kaynak yoksa no-op).

ALTER TABLE IF EXISTS public.xp_events
  RENAME TO zzz_deprecated_xp_events;

ALTER TABLE IF EXISTS public.user_employee_progress
  RENAME TO zzz_deprecated_user_employee_progress;

ALTER TABLE IF EXISTS public.recommendation_rules
  RENAME TO zzz_deprecated_recommendation_rules;

ALTER TABLE IF EXISTS public.seasonal_events
  RENAME TO zzz_deprecated_seasonal_events;

ALTER TABLE IF EXISTS public.otel_guest_hotels
  RENAME TO zzz_deprecated_otel_guest_hotels;

ALTER TABLE IF EXISTS public.sy_meeting_decisions
  RENAME TO zzz_deprecated_sy_meeting_decisions;

ALTER TABLE IF EXISTS public.sy_announcement_reads
  RENAME TO zzz_deprecated_sy_announcement_reads;
