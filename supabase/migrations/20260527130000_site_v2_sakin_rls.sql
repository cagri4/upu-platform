-- Site SaaS V2 — Sprint 2 Migration 2.1
-- Sakin RLS policies (Sprint 1'den ertelenmişti, Sprint 2 başında ekleniyor)
--
-- Sakin scope:
--   - Kendi unit'ine ait sy_dues_ledger (READ)
--   - Kendi unit'i veya reported_by_user_id=self olan sy_maintenance_tickets (RW)
--   - Kendi bağlı bina sy_announcements (READ; target_scope filter)
--   - Kendi user_id sy_announcement_reads (RW)
--   - Kendi bağlı bina sy_meetings (READ — invitee filter app tarafında)
--   - sy_meeting_decisions READ (meeting'in invitee'siyse — V2'de detaylanır)
--   - Kendi sy_user_residents (READ)
--   - sy_residents kendi bridge'inden (READ — diğer sakinleri görmek için)
--   - sy_buildings (READ) — bina bilgilerini görür
--   - sy_units (READ) — daire numaraları
--   - sy_maintenance_schedule (READ) — bakım takvimini görür (şeffaflık)

BEGIN;

-- ===== 1) Helper function: sakin scope check =====

CREATE OR REPLACE FUNCTION public.sy_is_sakin_of_building(p_building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'sakin'
      AND p_building_id = ANY (public.sy_user_building_ids(auth.uid()))
  );
$$;

GRANT EXECUTE ON FUNCTION public.sy_is_sakin_of_building(uuid) TO anon, authenticated, service_role;

-- ===== 2) sy_buildings — sakin kendi binasını görür (READ) =====

DROP POLICY IF EXISTS sy_buildings_sakin_read ON public.sy_buildings;
CREATE POLICY sy_buildings_sakin_read ON public.sy_buildings FOR SELECT TO authenticated
  USING (public.sy_is_sakin_of_building(id));

-- ===== 3) sy_units — sakin kendi bina daire listesini görür =====

DROP POLICY IF EXISTS sy_units_sakin_read ON public.sy_units;
CREATE POLICY sy_units_sakin_read ON public.sy_units FOR SELECT TO authenticated
  USING (public.sy_is_sakin_of_building(building_id));

-- ===== 4) sy_residents — sakin kendi binadaki diğer sakinleri görür =====
-- Telefon vs gibi PII bilgileri için app katmanı opsiyonel mask yapar.

DROP POLICY IF EXISTS sy_residents_sakin_read ON public.sy_residents;
CREATE POLICY sy_residents_sakin_read ON public.sy_residents FOR SELECT TO authenticated
  USING (public.sy_is_sakin_of_building(building_id));

-- ===== 5) sy_dues_ledger — sakin SADECE kendi unit'lerini görür =====

DROP POLICY IF EXISTS sy_dues_ledger_sakin_read ON public.sy_dues_ledger;
CREATE POLICY sy_dues_ledger_sakin_read ON public.sy_dues_ledger FOR SELECT TO authenticated
  USING (
    unit_id = ANY (public.sy_user_unit_ids(auth.uid()))
    AND public.sy_is_sakin_of_building(building_id)
  );

-- ===== 6) sy_maintenance_tickets — sakin kendi unit'i + kendi raporladığı =====

DROP POLICY IF EXISTS sy_maintenance_tickets_sakin_read ON public.sy_maintenance_tickets;
CREATE POLICY sy_maintenance_tickets_sakin_read ON public.sy_maintenance_tickets FOR SELECT TO authenticated
  USING (
    public.sy_is_sakin_of_building(building_id)
    AND (
      unit_id IS NULL                                            -- ortak alan ticket'ları herkes görür
      OR unit_id = ANY (public.sy_user_unit_ids(auth.uid()))     -- kendi daire ticket'ı
      OR reported_by_user_id = auth.uid()                        -- kendi raporladığı
    )
  );

-- Sakin yeni ticket aç (kendi unit veya ortak alan)
DROP POLICY IF EXISTS sy_maintenance_tickets_sakin_insert ON public.sy_maintenance_tickets;
CREATE POLICY sy_maintenance_tickets_sakin_insert ON public.sy_maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (
    public.sy_is_sakin_of_building(building_id)
    AND reported_by_user_id = auth.uid()
    AND (unit_id IS NULL OR unit_id = ANY (public.sy_user_unit_ids(auth.uid())))
  );

-- ===== 7) sy_user_residents — sakin kendi bridge satırını görür =====

DROP POLICY IF EXISTS sy_user_residents_self_read ON public.sy_user_residents;
CREATE POLICY sy_user_residents_self_read ON public.sy_user_residents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ===== 8) sy_announcements — sakin kendi binasının duyurularını görür =====
-- target_scope=block + target_block app tarafında filtre. target_role filter da
-- app tarafında (RLS subquery yerine perf için).

DROP POLICY IF EXISTS sy_announcements_sakin_read ON public.sy_announcements;
CREATE POLICY sy_announcements_sakin_read ON public.sy_announcements FOR SELECT TO authenticated
  USING (
    public.sy_is_sakin_of_building(building_id)
    AND sent_at IS NOT NULL                                   -- gönderilmemiş taslakları gizle
  );

-- ===== 9) sy_announcement_reads — sakin kendi okundu kaydı (RW) =====

DROP POLICY IF EXISTS sy_announcement_reads_sakin_all ON public.sy_announcement_reads;
CREATE POLICY sy_announcement_reads_sakin_all ON public.sy_announcement_reads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===== 10) sy_meetings — sakin bina toplantılarını görür =====

DROP POLICY IF EXISTS sy_meetings_sakin_read ON public.sy_meetings;
CREATE POLICY sy_meetings_sakin_read ON public.sy_meetings FOR SELECT TO authenticated
  USING (public.sy_is_sakin_of_building(building_id));

-- ===== 11) sy_meeting_decisions — sakin meeting üzerinden okur =====

DROP POLICY IF EXISTS sy_meeting_decisions_sakin_read ON public.sy_meeting_decisions;
CREATE POLICY sy_meeting_decisions_sakin_read ON public.sy_meeting_decisions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sy_meetings m
    WHERE m.id = sy_meeting_decisions.meeting_id
      AND public.sy_is_sakin_of_building(m.building_id)
  ));

-- ===== 12) sy_maintenance_schedule — sakin görür (şeffaflık) =====

DROP POLICY IF EXISTS sy_maintenance_schedule_sakin_read ON public.sy_maintenance_schedule;
CREATE POLICY sy_maintenance_schedule_sakin_read ON public.sy_maintenance_schedule FOR SELECT TO authenticated
  USING (public.sy_is_sakin_of_building(building_id));

-- ===== NOT: sakin'in görmediği tablolar =====
-- sy_income_expenses  — yalnız yönetici/denetci/muhasebeci
-- sy_personnel        — yalnız yönetici/denetci (maaş hassas)
-- sy_suppliers        — yalnız yönetici/denetci/muhasebeci
-- sy_budget_categories — yalnız yönetici/denetci/muhasebeci

COMMIT;
