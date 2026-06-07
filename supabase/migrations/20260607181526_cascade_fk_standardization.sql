-- 20260607181526_cascade_fk_standardization.sql
--
-- KÖK SORUN: FK CASCADE stratejisi tablo başına ayrı ayrı seçilmiş.
-- Bazıları CASCADE, bazıları RESTRICT (default), bazıları SET NULL.
-- Tenant silmek istediğinde application-seviye 52 tablo manual cleanup
-- gerekiyordu (src/app/api/admin/saas/[key]/tenants/[id]/route.ts
-- DEPENDENT_TABLES); profile silmek için ekstra audit eksikti.
-- 2026-06-07 testte tenant silme `profiles_tenant_id_fkey` violation hatası.
--
-- ÇÖZÜM: tek standart, idempotent DO bloklarıyla mevcut tüm FK'ları
-- yeniden yarat:
--   - `tenant_id` REFERENCES public.tenants → ON DELETE CASCADE
--   - kolonu profiles tablosuna işaret eden FK (auth_user_id, profile_id,
--     user_id, vs.) → kolon NULLABLE ise SET NULL (audit korunur),
--     NOT NULL ise CASCADE.
--
-- Sonuç:
--   - Tenant silme tek SQL: DELETE FROM tenants WHERE id=X → cascade
--   - DEPENDENT_TABLES manuel listesi gereksiz, endpoint sadeleşir
--   - Yeni tablo eklenince otomatik kapsama girer (migration yeniden
--     uygulanırsa standardize eder)

-- ─────────────────────────────────────────────────────────────────────
-- 1) tenant_id FK'larını CASCADE'e standartlaştır
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  cmd TEXT;
BEGIN
  FOR r IN
    SELECT
      c.conrelid::regclass::text AS table_name,
      c.conname                    AS constraint_name,
      a.attname                    AS column_name
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum   = ANY (c.conkey)
    WHERE c.contype  = 'f'
      AND c.confrelid = 'public.tenants'::regclass
      AND c.confdeltype <> 'c'  -- CASCADE değilse standardize et
  LOOP
    cmd := format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      r.table_name, r.constraint_name
    );
    EXECUTE cmd;
    cmd := format(
      'ALTER TABLE %s ADD CONSTRAINT %I '
      || 'FOREIGN KEY (%I) REFERENCES public.tenants(id) ON DELETE CASCADE',
      r.table_name, r.constraint_name, r.column_name
    );
    EXECUTE cmd;
    RAISE NOTICE '[cascade-fk] tenant_id FK standardized: %.%', r.table_name, r.constraint_name;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) profile FK'larını SET NULL / CASCADE'e standartlaştır
--    (kolon NOT NULL ise CASCADE, NULLABLE ise SET NULL)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  cmd TEXT;
BEGIN
  FOR r IN
    SELECT
      c.conrelid::regclass::text AS table_name,
      c.conname                    AS constraint_name,
      a.attname                    AS column_name,
      a.attnotnull                 AS is_not_null
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum   = ANY (c.conkey)
    WHERE c.contype   = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND c.conrelid <> 'public.profiles'::regclass  -- profiles → profiles self-ref hariç (yoksa OK)
  LOOP
    IF r.is_not_null THEN
      -- NOT NULL: SET NULL imkansız → CASCADE
      IF (
        SELECT confdeltype
        FROM pg_constraint
        WHERE conname = r.constraint_name
          AND conrelid::regclass::text = r.table_name
      ) = 'c' THEN
        -- Zaten CASCADE, atla
        CONTINUE;
      END IF;
      cmd := format(
        'ALTER TABLE %s DROP CONSTRAINT %I',
        r.table_name, r.constraint_name
      );
      EXECUTE cmd;
      cmd := format(
        'ALTER TABLE %s ADD CONSTRAINT %I '
        || 'FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE CASCADE',
        r.table_name, r.constraint_name, r.column_name
      );
      EXECUTE cmd;
      RAISE NOTICE '[cascade-fk] profile FK (NOT NULL → CASCADE): %.%', r.table_name, r.constraint_name;
    ELSE
      -- NULLABLE: SET NULL (audit kaydı korunur)
      IF (
        SELECT confdeltype
        FROM pg_constraint
        WHERE conname = r.constraint_name
          AND conrelid::regclass::text = r.table_name
      ) = 'n' THEN
        -- Zaten SET NULL, atla
        CONTINUE;
      END IF;
      cmd := format(
        'ALTER TABLE %s DROP CONSTRAINT %I',
        r.table_name, r.constraint_name
      );
      EXECUTE cmd;
      cmd := format(
        'ALTER TABLE %s ADD CONSTRAINT %I '
        || 'FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
        r.table_name, r.constraint_name, r.column_name
      );
      EXECUTE cmd;
      RAISE NOTICE '[cascade-fk] profile FK (NULLABLE → SET NULL): %.%', r.table_name, r.constraint_name;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3) Doğrulama sorgusu (sadece migration loglarına)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tenant_non_cascade INTEGER;
  profile_non_compliant INTEGER;
BEGIN
  SELECT count(*) INTO tenant_non_cascade
  FROM pg_constraint
  WHERE contype = 'f'
    AND confrelid = 'public.tenants'::regclass
    AND confdeltype <> 'c';

  SELECT count(*) INTO profile_non_compliant
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum   = ANY (c.conkey)
  WHERE c.contype  = 'f'
    AND c.confrelid = 'public.profiles'::regclass
    AND c.conrelid <> 'public.profiles'::regclass
    AND (
      (a.attnotnull AND c.confdeltype <> 'c')
      OR (NOT a.attnotnull AND c.confdeltype <> 'n')
    );

  IF tenant_non_cascade > 0 THEN
    RAISE WARNING '[cascade-fk] AUDIT: % tenant_id FK still NOT CASCADE', tenant_non_cascade;
  ELSE
    RAISE NOTICE '[cascade-fk] AUDIT: all tenant_id FK = CASCADE ✓';
  END IF;

  IF profile_non_compliant > 0 THEN
    RAISE WARNING '[cascade-fk] AUDIT: % profile FK still non-compliant', profile_non_compliant;
  ELSE
    RAISE NOTICE '[cascade-fk] AUDIT: all profile FK compliant (NOT NULL→CASCADE, NULLABLE→SET NULL) ✓';
  END IF;
END $$;
