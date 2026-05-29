-- Admin Test Phone Mechanism (2026-05-14)
--
-- Admin (platform sahibi) tek telefon numarasıyla 5+ SaaS test edemiyor.
-- Bu tablo, admin'in kendi hesabına bağlı "sahte test telefonları" oluşturup
-- WA webhook simulation endpoint'i ile bot davranışlarını test etmesine
-- izin verir.
--
-- Verbose adı (admin_test_identities) çünkü "fake_phones" iş ortamında
-- yanlış anlaşılır — bu telefonlar gerçek değil, "kullanıcı kimliği test
-- amaçlı sahte".

BEGIN;

CREATE TABLE IF NOT EXISTS admin_test_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  virtual_phone TEXT UNIQUE NOT NULL CHECK (virtual_phone ~ '^[0-9]+$'),
  display_name TEXT,
  target_tenant TEXT,           -- bayi / market / restoran / emlak / otel / siteyonetim / muhasebe
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_test_identities_admin
  ON admin_test_identities (admin_user_id);

COMMIT;

-- Rollback (manuel):
--   DROP TABLE IF EXISTS admin_test_identities;
