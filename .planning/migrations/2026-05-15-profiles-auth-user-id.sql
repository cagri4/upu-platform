-- Deep Foundation v2 — profiles.auth_user_id kolonu (2026-05-15)
--
-- Multi-tenant identity tam karşılığı için profile.id artık auth.users.id'ye
-- bağlı değil. Bir auth.user → N profile (her tenant'ta ayrı) olabilsin.
--
-- Geriye uyumluluk:
--   - Mevcut profile.id satırları olduğu gibi kalır (legacy: profile.id = auth.users.id)
--   - UPDATE backfill: auth_user_id = id (mevcut satırlarda auth_user = profile.id)
--   - Yeni profile satırları: id = gen_random_uuid(), auth_user_id = auth.users.id
--
-- Sprint Foundation migration ile birlikte: (whatsapp_phone, tenant_id) unique
-- + (auth_user_id, tenant_id) unique → aynı auth.user aynı tenant'ta sadece
-- 1 profile'a sahip olabilir; aynı phone farklı tenant'larda ayrı profile'lara.

BEGIN;

-- 1) Kolonu ekle (önce nullable — backfill yapabilmek için)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) Backfill: mevcut profile.id zaten auth.users.id'ye eşit (legacy 1-1 pattern)
UPDATE profiles SET auth_user_id = id WHERE auth_user_id IS NULL;

-- 3) NOT NULL kısıtı ekle (backfill sonrası güvenli)
ALTER TABLE profiles ALTER COLUMN auth_user_id SET NOT NULL;

-- 4) Lookup index'leri
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id
  ON profiles (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_tenant
  ON profiles (auth_user_id, tenant_id);

-- 5) Composite unique — bir auth.user aynı tenant'ta ikinci profile yaratamaz
ALTER TABLE profiles
  ADD CONSTRAINT profiles_auth_user_tenant_unique
  UNIQUE (auth_user_id, tenant_id);

COMMIT;

-- Rollback (manuel):
--   ALTER TABLE profiles DROP CONSTRAINT profiles_auth_user_tenant_unique;
--   DROP INDEX IF EXISTS idx_profiles_auth_user_tenant;
--   DROP INDEX IF EXISTS idx_profiles_auth_user_id;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS auth_user_id;
-- Rollback öncesi: TENANT_AWARE_IDENTITY=false yapılıp redeploy edilmeli.
