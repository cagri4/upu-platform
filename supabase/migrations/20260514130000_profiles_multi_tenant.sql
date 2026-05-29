-- Sprint Foundation — multi-tenant identity (2026-05-14)
--
-- Aynı whatsapp_phone'un birden fazla tenant'ta ayrı profile satırına
-- sahip olmasına izin ver. Eski tek-tenant unique constraint kaldırılıp
-- (whatsapp_phone, tenant_id) composite unique eklenir.
--
-- Hangi sorunu çözer:
--   1) Admin kullanıcı 5+ farklı SaaS'ı tek phone ile test edemiyor.
--   2) Gerçek müşteri aynı phone ile birden fazla SaaS'a üye olamıyor.
--
-- Defensive: profiles tablosu Supabase üzerinden manuel oluşturulmuş;
-- mevcut unique constraint adı net değil — muhtemel isimleri DROP IF
-- EXISTS ile temizleriz, transaction içinde atomic.
--
-- Veri ön kontrolü (çalıştırmadan önce manuel):
--   SELECT whatsapp_phone, tenant_id, count(*)
--   FROM profiles
--   GROUP BY whatsapp_phone, tenant_id
--   HAVING count(*) > 1;
--   → Boş çıkmalı. Boş değilse migration FAIL olur; önce dup'lar temizlenir.

BEGIN;

-- Eski (phone) unique constraint(ler) — muhtemel adları kaldır
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_unique;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_phone_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_whatsapp_phone_unique;

-- Eski unique index (constraint dışı varsa)
DROP INDEX IF EXISTS profiles_phone_idx;
DROP INDEX IF EXISTS profiles_whatsapp_phone_idx;

-- Yeni: composite unique — aynı phone farklı tenant'ta OK, aynı tenant'ta DUP YOK
ALTER TABLE profiles
  ADD CONSTRAINT profiles_whatsapp_phone_tenant_unique
  UNIQUE (whatsapp_phone, tenant_id);

-- Performans: phone-only lookup (regular message resolution, degistir komutu)
-- ve composite lookup için index'ler
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_phone
  ON profiles (whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_phone_tenant
  ON profiles (whatsapp_phone, tenant_id);

COMMIT;

-- Rollback (manuel):
--   ALTER TABLE profiles DROP CONSTRAINT profiles_whatsapp_phone_tenant_unique;
--   DROP INDEX IF EXISTS idx_profiles_whatsapp_phone_tenant;
--   DROP INDEX IF EXISTS idx_profiles_whatsapp_phone;
--   ALTER TABLE profiles ADD CONSTRAINT profiles_whatsapp_phone_key UNIQUE (whatsapp_phone);
-- Rollback öncesi: TENANT_AWARE_IDENTITY env var false yapılıp redeploy edilmeli;
-- aksi halde regular message lookup yanlış profile seçebilir (multi-profile state).
