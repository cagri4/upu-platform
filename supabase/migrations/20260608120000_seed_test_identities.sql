-- Seed 10 sabit-OTP test identities (2026-06-08)
--
-- Çağrı sürekli admin panelden random kod kopyalamayı bitirsin diye sabit
-- OTP sistemi: admin_test_identities'teki her telefon 112233 ile giriş yapar.
-- otp.ts requestOtp test identity bulduğunda kodu "112233" olarak zorlar.

BEGIN;

INSERT INTO admin_test_identities (admin_user_id, virtual_phone, display_name, target_tenant, notes)
SELECT
  admin.auth_user_id,
  vp.phone,
  vp.name,
  vp.target,
  'Sabit OTP 112233 — Çağrı''nın test kullanımı için'
FROM (
  SELECT auth_user_id
  FROM profiles
  WHERE is_platform_admin = true
  ORDER BY created_at ASC
  LIMIT 1
) admin
CROSS JOIN (VALUES
  ('31600000001', 'Test 1 — Bayi',     'bayi'),
  ('31600000002', 'Test 2 — Emlak',    'emlak'),
  ('31600000003', 'Test 3 — Market',   'market'),
  ('31600000004', 'Test 4 — Otel',     'otel'),
  ('31600000005', 'Test 5 — Restoran', 'restoran'),
  ('31600000006', 'Test 6 — Site',     'site'),
  ('31600000007', 'Test 7 — Muhasebe', 'muhasebe'),
  ('31600000008', 'Test 8 — Esnek',    NULL),
  ('31600000009', 'Test 9 — Esnek',    NULL),
  ('31600000010', 'Test 10 — Esnek',   NULL)
) AS vp(phone, name, target)
ON CONFLICT (virtual_phone) DO NOTHING;

COMMIT;
