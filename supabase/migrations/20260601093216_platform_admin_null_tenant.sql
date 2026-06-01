-- Platform admin tenant_id NULL (2026-06-01)
--
-- Kritik güvenlik düzeltmesinin DB tarafı. "admin" rolü iki anlamda
-- kullanılıyordu:
--   - tenant owner (SaaS sahibi) → role='admin' + tenant_id=<tenant>
--   - platform admin (UPU Dev) → role='admin' + tenant_id=??? (yanlış)
--
-- Çağrı'nın platform admin profili (846a103e) yanlışlıkla bir tenant'a
-- bağlanmıştı. Bu satır profil NULL tenant'a çekilir; aynı satıra
-- bağlı admin guard'lar (AdminGroupLayout + requireAdminUser) ardından
-- "role=admin AND tenant_id IS NULL" gerektirecek. Sonuç: Doğuş gibi
-- tenant-admin'leri /admin/* hiçbir endpoint'inde göremez.
--
-- ÖNCE bu migration uygulanır, SONRA guard değişiklikleri deploy edilir
-- (aksi halde Çağrı kendi adminpanel'inden kilitlenir).

BEGIN;

UPDATE profiles
   SET tenant_id = NULL
 WHERE id = '846a103e-b6a9-49a1-b99c-50a472db3618'
   AND role = 'admin';

-- Garanti: satır beklenildiği gibi NULL'a çekildi (idempotent re-run safe).
DO $$
DECLARE
  cur_tenant UUID;
BEGIN
  SELECT tenant_id INTO cur_tenant
    FROM profiles
   WHERE id = '846a103e-b6a9-49a1-b99c-50a472db3618';

  IF cur_tenant IS NOT NULL THEN
    RAISE EXCEPTION 'Platform admin (846a103e) tenant_id NULL değil: %', cur_tenant;
  END IF;
END $$;

COMMIT;

-- Rollback (manuel, gerekirse — eski state'i geri ister isen):
--   UPDATE profiles SET tenant_id = 'c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e'
--    WHERE id = '846a103e-b6a9-49a1-b99c-50a472db3618';
-- Ama bu yapılırsa admin guard yine boşa çıkar; sebebi düşünüp git.
