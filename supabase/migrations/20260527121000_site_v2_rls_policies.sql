-- Site SaaS V2 — Sprint 1 Migration 3/3
-- RLS sıkılaştırma + RBAC iskeleti (yönetici/denetci/muhasebeci_site)
--
-- Mevcut "*_service" policy'leri USING(true) idi — anon/authenticated dahil
-- HERKES geçiyordu. Defense-in-depth için her policy auth.role()='service_role'
-- olarak sıkılaştırılır. Service role API endpoint'leri bypass eder zaten.
--
-- Yönetici/denetci/muhasebeci_site policy'leri JWT cookie session ile gelen
-- admin UI fetch'leri için. Sakin policy'leri Sprint 2 başında eklenecek
-- (Çağrı onayı 2026-05-27).

BEGIN;

-- ===== 1) Helper functions — role + building scope checks =====

-- Yönetici/admin/employee: tüm binayı yönetir
CREATE OR REPLACE FUNCTION public.sy_is_admin_of_building(p_building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.sy_buildings b ON b.manager_id = p.id
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role IN ('yonetici','admin','employee')
      AND (b.id = p_building_id OR p_building_id = ANY (public.sy_user_building_ids(auth.uid())))
  );
$$;

-- Denetci: mali okuma-only (binaya bağlı)
CREATE OR REPLACE FUNCTION public.sy_is_denetci_of_building(p_building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'denetci'
      AND p_building_id = ANY (public.sy_user_building_ids(auth.uid()))
  );
$$;

-- Muhasebeci_site: mali yazma (binaya bağlı)
CREATE OR REPLACE FUNCTION public.sy_is_muhasebeci_of_building(p_building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'muhasebeci_site'
      AND p_building_id = ANY (public.sy_user_building_ids(auth.uid()))
  );
$$;

GRANT EXECUTE ON FUNCTION public.sy_is_admin_of_building(uuid)        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sy_is_denetci_of_building(uuid)      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sy_is_muhasebeci_of_building(uuid)   TO anon, authenticated, service_role;

-- ===== 2) Mevcut "*_service" policy'leri sıkılaştır =====
-- USING(true) → auth.role() = 'service_role' (defense-in-depth).
-- Service role API endpoint'leri zaten RLS bypass eder; bu sadece anon JWT
-- kazara sızmaması için.

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sy_buildings', 'sy_units', 'sy_residents', 'sy_dues_ledger',
    'sy_maintenance_tickets', 'sy_income_expenses', 'sy_user_residents',
    'sy_announcements', 'sy_announcement_reads',
    'sy_meetings', 'sy_meeting_decisions',
    'sy_personnel', 'sy_suppliers',
    'sy_maintenance_schedule', 'sy_budget_categories'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_service', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_service', tbl
    );
  END LOOP;
END $$;

-- ===== 3) Yönetici policy'leri — admin UI JWT cookie session için =====
-- 15 tablo (sy_user_residents hariç çünkü kendi user_id sorgusu farklı).
-- Yönetici binasının tüm satırlarına okuma + yazma.

-- 3a) building_id kolonu olan tablolar (12 tablo)
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sy_units', 'sy_residents', 'sy_dues_ledger', 'sy_maintenance_tickets',
    'sy_income_expenses', 'sy_announcements', 'sy_meetings',
    'sy_personnel', 'sy_suppliers', 'sy_maintenance_schedule',
    'sy_budget_categories', 'sy_user_residents'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_yonetici_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.sy_is_admin_of_building(building_id)) WITH CHECK (public.sy_is_admin_of_building(building_id))',
      tbl || '_yonetici_all', tbl
    );
  END LOOP;
END $$;

-- 3b) sy_buildings — id ile check
DROP POLICY IF EXISTS sy_buildings_yonetici_all ON public.sy_buildings;
CREATE POLICY sy_buildings_yonetici_all ON public.sy_buildings FOR ALL TO authenticated
  USING (public.sy_is_admin_of_building(id))
  WITH CHECK (public.sy_is_admin_of_building(id));

-- 3c) sy_meeting_decisions — meeting_id üzerinden building'e bağlı
DROP POLICY IF EXISTS sy_meeting_decisions_yonetici_all ON public.sy_meeting_decisions;
CREATE POLICY sy_meeting_decisions_yonetici_all ON public.sy_meeting_decisions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sy_meetings m
    WHERE m.id = sy_meeting_decisions.meeting_id
      AND public.sy_is_admin_of_building(m.building_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sy_meetings m
    WHERE m.id = sy_meeting_decisions.meeting_id
      AND public.sy_is_admin_of_building(m.building_id)
  ));

-- 3d) sy_announcement_reads — user_id ile okur, building_id yok
DROP POLICY IF EXISTS sy_announcement_reads_yonetici_read ON public.sy_announcement_reads;
CREATE POLICY sy_announcement_reads_yonetici_read ON public.sy_announcement_reads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sy_announcements a
    WHERE a.id = sy_announcement_reads.announcement_id
      AND public.sy_is_admin_of_building(a.building_id)
  ));

-- ===== 4) Denetci policy'leri — mali okuma-only =====
-- 4 mali tablo: dues_ledger, income_expenses, suppliers (sözleşme), budget_categories

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sy_dues_ledger', 'sy_income_expenses', 'sy_suppliers',
    'sy_budget_categories', 'sy_personnel'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_denetci_read', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.sy_is_denetci_of_building(building_id))',
      tbl || '_denetci_read', tbl
    );
  END LOOP;
END $$;

-- Denetci sy_buildings: kendi bina okuma
DROP POLICY IF EXISTS sy_buildings_denetci_read ON public.sy_buildings;
CREATE POLICY sy_buildings_denetci_read ON public.sy_buildings FOR SELECT TO authenticated
  USING (public.sy_is_denetci_of_building(id));

-- ===== 5) Muhasebeci_site policy'leri — gelir/gider yazma =====
-- 3 mali tablo: dues_ledger, income_expenses, budget_categories

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sy_dues_ledger', 'sy_income_expenses', 'sy_budget_categories'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_muhasebeci_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.sy_is_muhasebeci_of_building(building_id)) WITH CHECK (public.sy_is_muhasebeci_of_building(building_id))',
      tbl || '_muhasebeci_all', tbl
    );
  END LOOP;
END $$;

-- Muhasebeci_site sy_buildings: kendi bina okuma (yazma yok, yönetici yapar)
DROP POLICY IF EXISTS sy_buildings_muhasebeci_read ON public.sy_buildings;
CREATE POLICY sy_buildings_muhasebeci_read ON public.sy_buildings FOR SELECT TO authenticated
  USING (public.sy_is_muhasebeci_of_building(id));

-- Muhasebeci_site sy_suppliers: okur (sözleşme bilgisi gerekli, yazmaz)
DROP POLICY IF EXISTS sy_suppliers_muhasebeci_read ON public.sy_suppliers;
CREATE POLICY sy_suppliers_muhasebeci_read ON public.sy_suppliers FOR SELECT TO authenticated
  USING (public.sy_is_muhasebeci_of_building(building_id));

-- ===== 6) Sprint 2 başında eklenecek (sakin policy'leri) =====
-- Sakin için RLS politikaları + sakin panel UI Sprint 2 başında. O migration:
--   - sy_*_sakin_read (kendi unit/building'e scoped)
--   - sy_announcements_sakin_read (target_scope filter)
--   - sy_maintenance_tickets_sakin_write (kendi ticket'ı insert)
--   - sy_announcement_reads_sakin_rw (kendi user_id)

COMMIT;
