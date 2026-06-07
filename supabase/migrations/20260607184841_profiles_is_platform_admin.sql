-- 20260607184841_profiles_is_platform_admin.sql
--
-- MİMARİ HEDEF: profiles.role + tenant_id kombinasyonu iki çok farklı
-- seviyenin rolünü tek slot'a sıkıştırıyordu:
--   - role='admin' + tenant_id=NULL → platform admin (UPU Dev sahibi)
--   - role='admin' + tenant_id=X    → tenant sahibi (Ruhi can gibi)
--   - role='user'                   → çalışan
--   - role='system'                 → bot
--
-- Bu yüzden her admin gate'te 2 koşul (`role='admin' AND tenant_id IS NULL`)
-- gerekiyor; yeni kayıt akışında karışıklık riski var (#97 fix öncesi
-- gerçekleşti). Daha temiz: `profiles.is_platform_admin BOOLEAN` ayrı
-- bayrak ekle.
--
-- Geçiş stratejisi:
--   1) Column ekle (default false)
--   2) Backfill: mevcut role='admin' + tenant_id IS NULL kayıtlar → true
--   3) Trigger: gelecek INSERT/UPDATE'lerde bayrağı role/tenant_id'den
--      otomatik türet — kod tarafında elle set etmeyi unutulsun bug'ı
--      doğmasın.

-- ─────────────────────────────────────────────────────────────────
-- 1) Column
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin
  ON public.profiles(is_platform_admin)
  WHERE is_platform_admin = true;

-- ─────────────────────────────────────────────────────────────────
-- 2) Backfill
-- ─────────────────────────────────────────────────────────────────
UPDATE public.profiles
SET is_platform_admin = true
WHERE role = 'admin'
  AND tenant_id IS NULL
  AND is_platform_admin = false;

-- ─────────────────────────────────────────────────────────────────
-- 3) Trigger — gelecek değişikliklerde otomatik türet
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_set_is_platform_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_platform_admin := (NEW.role = 'admin' AND NEW.tenant_id IS NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_is_platform_admin ON public.profiles;
CREATE TRIGGER trg_profiles_set_is_platform_admin
  BEFORE INSERT OR UPDATE OF role, tenant_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_set_is_platform_admin();

-- ─────────────────────────────────────────────────────────────────
-- 4) Doğrulama
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  flag_count INTEGER;
  legacy_count INTEGER;
BEGIN
  SELECT count(*) INTO flag_count FROM public.profiles WHERE is_platform_admin;
  SELECT count(*) INTO legacy_count
    FROM public.profiles
    WHERE role = 'admin' AND tenant_id IS NULL;

  IF flag_count <> legacy_count THEN
    RAISE WARNING '[profiles.is_platform_admin] BACKFILL MISMATCH: flag=%, legacy=%', flag_count, legacy_count;
  ELSE
    RAISE NOTICE '[profiles.is_platform_admin] backfill OK: % platform admin', flag_count;
  END IF;
END $$;
