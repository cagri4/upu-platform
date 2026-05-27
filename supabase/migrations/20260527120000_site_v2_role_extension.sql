-- Site SaaS V2 — Sprint 1 Migration 1/3
-- profiles.role enum genişletme + RLS helper SQL functions
--
-- 4 yeni site-spesifik rol eklenir: sakin, yonetici, denetci, muhasebeci_site
-- (muhasebeci_site suffix'i muhasebe SaaS tenant'ından ayırt etmek için).
--
-- 2 helper function:
--   sy_user_building_ids(uuid)  → kullanıcının bağlı olduğu bina(lar)
--   sy_user_unit_ids(uuid)       → kullanıcının bağlı olduğu daire(ler)
-- Her ikisi de SECURITY DEFINER + STABLE: RLS policy'lerinde recursion'a
-- girmeden lookup yapar (sy_user_residents bridge tablosundan).

BEGIN;

-- ===== 1) profiles.role constraint genişletme =====

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY[
    'admin',            -- mevcut: platform admin
    'employee',         -- mevcut: çalışan
    'dealer',           -- mevcut: bayi
    'system',           -- mevcut: sistem hesabı
    'user',             -- mevcut: default kullanıcı
    'guest',            -- mevcut: misafir
    'sakin',            -- YENİ: site sakini (kendi unit'i + bildirim okur)
    'yonetici',         -- YENİ: site yöneticisi (binayı yönetir)
    'denetci',          -- YENİ: site denetçisi (mali okuma-only)
    'muhasebeci_site'   -- YENİ: site muhasebecisi (gelir/gider yazar)
  ]));

-- ===== 2) Helper function: kullanıcı → bağlı bina(lar) =====
-- sy_user_residents bridge'ten array dönderir. RLS policy'lerinde
-- her satır için subquery yerine = ANY(fn(uid)) ile sabit lookup yapılır.

CREATE OR REPLACE FUNCTION public.sy_user_building_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT building_id), ARRAY[]::uuid[])
  FROM public.sy_user_residents
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.sy_user_building_ids(uuid) IS
  'Kullanıcının sy_user_residents bridge tablosunda eşleştirildiği bina ID listesi. RLS policy'' lerinde sakin/yönetici scope''u belirlemek için.';

-- ===== 3) Helper function: kullanıcı → bağlı daire(ler) =====
-- sy_dues_ledger gibi unit-bazlı tablolarda sakin'in sadece kendi
-- daire(leri)nin satırlarını görmesi için.

CREATE OR REPLACE FUNCTION public.sy_user_unit_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT r.unit_id), ARRAY[]::uuid[])
  FROM public.sy_user_residents ur
  JOIN public.sy_residents r ON r.id = ur.resident_id
  WHERE ur.user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.sy_user_unit_ids(uuid) IS
  'Kullanıcının sy_user_residents üzerinden eşleştirildiği daire (sy_units) ID listesi. Sakin RLS policy''lerinde kullanılır.';

-- ===== 4) Helper function: kullanıcı site rolü =====
-- profiles.role kolonundan tek satır siteyonetim role'unu döner.
-- Cross-tenant lookup için profiles.tenant_id filtresi caller'a bırakılır.

CREATE OR REPLACE FUNCTION public.sy_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.auth_user_id = p_user_id
     OR p.id = p_user_id
  ORDER BY (CASE WHEN p.role IN ('yonetici','denetci','muhasebeci_site','sakin') THEN 0 ELSE 1 END)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.sy_user_role(uuid) IS
  'auth.uid()''den siteyonetim profili role''unu döner. Aynı auth_user_id''ye sahip multi-tenant profillerden site-rolü önceliklenir (sakin/yonetici/denetci/muhasebeci_site).';

-- ===== 5) Yetkilendirme — anon ve authenticated rollerine EXECUTE =====

GRANT EXECUTE ON FUNCTION public.sy_user_building_ids(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sy_user_unit_ids(uuid)      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sy_user_role(uuid)          TO anon, authenticated, service_role;

COMMIT;
