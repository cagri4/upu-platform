-- AGENT İZOLASYON DEFENSE — Faz 1: phone GLOBAL UNIQUE
--
-- Çağrı kararı (2026-05-20, multi-saas test pattern üstüne):
--   "1 telefon = 1 UPU SaaS, net".
--
-- Bu migration eski tasarım kararını (20260514130000_profiles_multi_tenant)
-- TERSİNE ÇEVİRİR. Eski tasarım: composite unique (whatsapp_phone, tenant_id)
-- → aynı phone N tenant'a yazılı. Yeni: global unique (whatsapp_phone) →
-- aynı phone YALNIZCA 1 tenant'a.
--
-- Sonuç:
--   - Test telefonu 905066806262 ile 5 SaaS test pattern BOZULUR (kabul).
--   - Bir gerçek kullanıcı aynı tel ile farklı SaaS'a yazılamaz (kabul,
--     izolasyon önceliği).
--   - Yeni composite drop edilir — global daha katı (composite zaten subset).
--
-- Pre-check (uygulamadan önce çalıştırıldı, 2026-05-20):
--   SELECT whatsapp_phone, count(DISTINCT tenant_id)
--   FROM profiles
--   WHERE whatsapp_phone IS NOT NULL
--   GROUP BY whatsapp_phone
--   HAVING count(DISTINCT tenant_id) > 1;
--   → 0 satır. Duplicate yok. Migration güvenli.

BEGIN;

-- 1) Eski composite unique kaldır (global zaten daha katı, çift constraint
--    karmaşa yaratır + future insertler iki tarafı kontrol etmesin diye).
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_whatsapp_phone_tenant_unique;

-- 2) Eski composite index temizliği (constraint'e otomatik bağlı olabilir
--    ama bazı durumlarda ayrı index olabiliyor — defensive).
DROP INDEX IF EXISTS idx_profiles_whatsapp_phone_tenant;

-- 3) Phone-only lookup index korunur (idx_profiles_whatsapp_phone) — performans için.
--    Aşağıdaki UNIQUE index zaten PostgreSQL tarafından lookup için kullanılır
--    ama explicit non-unique index'in mevcut planları bozmaması için bırakıldı.

-- 4) Global unique constraint.
--    WHERE clause: NULL phone'lu profile'lara (system bot, test/staging,
--    organik signup başlamamış) izin verilir — yalnız NON-NULL phone tek olur.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_whatsapp_phone_global
  ON profiles (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL;

COMMIT;

-- Rollback (acil durum):
--   DROP INDEX IF EXISTS uniq_profiles_whatsapp_phone_global;
--   ALTER TABLE profiles
--     ADD CONSTRAINT profiles_whatsapp_phone_tenant_unique
--     UNIQUE (whatsapp_phone, tenant_id);
--   CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_phone_tenant
--     ON profiles (whatsapp_phone, tenant_id);
