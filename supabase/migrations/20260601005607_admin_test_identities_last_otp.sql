-- Test Identity OTP Capture (2026-06-01)
--
-- Admin'in oluşturduğu sanal telefonlar (admin_test_identities) için OTP
-- kodlarını WhatsApp'a göndermek yerine doğrudan admin paneline yazmak
-- amacıyla 2 kolon eklenir.
--
-- Akış: /api/auth/otp/request → phone admin_test_identities'te ise WA send
-- yerine last_otp_code + last_otp_at update; UI 5sn polling ile gösterir
-- + tek-tık kopyala butonu.
--
-- Normal (gerçek) telefonlar bu tabloyu kullanmaz; mevcut WA send akışı
-- aynen çalışmaya devam eder.

BEGIN;

ALTER TABLE admin_test_identities
  ADD COLUMN IF NOT EXISTS last_otp_code TEXT,
  ADD COLUMN IF NOT EXISTS last_otp_at TIMESTAMPTZ;

COMMIT;

-- Rollback (manuel):
--   ALTER TABLE admin_test_identities
--     DROP COLUMN last_otp_code,
--     DROP COLUMN last_otp_at;
