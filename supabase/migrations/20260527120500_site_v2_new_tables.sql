-- Site SaaS V2 — Sprint 1 Migration 2/3
-- 8 yeni tablo + sy_buildings.arsa_payi_denominator kolonu
--
-- Modül kapsamı:
--   M3: sy_announcements + sy_announcement_reads
--   M4: sy_meetings + sy_meeting_decisions (KMK 634)
--   M5: sy_personnel + sy_suppliers
--   M6: sy_maintenance_schedule
--   M2: sy_budget_categories
--   M4 ek: sy_buildings.arsa_payi_denominator (toplam arsa payı)
--
-- Tüm tablolar RLS ENABLE + geçici service-role policy (USING true).
-- RLS sıkılaştırma migration 3'te.

BEGIN;

-- ===== 0) sy_buildings — arsa_payi_denominator =====
-- KMK 634 toplantı çoğunluk hesaplama için toplam arsa payı şart.
-- sy_units.arsa_payi_numerator zaten mevcut. Default null — yönetici girer.

ALTER TABLE public.sy_buildings
  ADD COLUMN IF NOT EXISTS arsa_payi_denominator integer;

COMMENT ON COLUMN public.sy_buildings.arsa_payi_denominator IS
  'Binanın toplam arsa payı (KMK 634 çoğunluk hesaplama). Yönetici tarafından girilir; sy_units.arsa_payi_numerator toplamı ile eşleşmeli.';

-- ===== 1) sy_announcements (M3: Duyuru & İletişim) =====

CREATE TABLE IF NOT EXISTS public.sy_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  building_id uuid NOT NULL REFERENCES public.sy_buildings(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  target_scope text NOT NULL DEFAULT 'all'
    CHECK (target_scope IN ('all', 'block', 'role')),
  target_block text,        -- 'A blok' vb. target_scope='block' ise dolu
  target_role text          -- 'sakin'/'yonetici' vb. target_scope='role' ise dolu
    CHECK (target_role IS NULL OR target_role IN ('sakin','yonetici','denetci','muhasebeci_site')),
  channels text[] NOT NULL DEFAULT ARRAY['inbox']::text[],
  wa_template_id text,                -- Meta WA template adı, örn 'duyuru_v1'
  wa_template_vars jsonb DEFAULT '{}'::jsonb,
  scheduled_for timestamptz,          -- delay broadcast (null = anında)
  sent_at timestamptz,                -- gönderildi marker
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_recipients integer NOT NULL DEFAULT 0,
  read_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sy_announcements_building_idx ON public.sy_announcements(building_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sy_announcements_tenant_idx ON public.sy_announcements(tenant_id);
CREATE INDEX IF NOT EXISTS sy_announcements_scheduled_idx ON public.sy_announcements(scheduled_for) WHERE scheduled_for IS NOT NULL;

ALTER TABLE public.sy_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_announcements_service" ON public.sy_announcements
  USING (true) WITH CHECK (true);

-- ===== 2) sy_announcement_reads (M3 bridge: okundu işareti) =====

CREATE TABLE IF NOT EXISTS public.sy_announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.sy_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS sy_announcement_reads_user_idx ON public.sy_announcement_reads(user_id);

ALTER TABLE public.sy_announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_announcement_reads_service" ON public.sy_announcement_reads
  USING (true) WITH CHECK (true);

-- ===== 3) sy_meetings (M4: Toplantı — KMK 634) =====

CREATE TABLE IF NOT EXISTS public.sy_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  building_id uuid NOT NULL REFERENCES public.sy_buildings(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_type text NOT NULL DEFAULT 'olagan'
    CHECK (meeting_type IN ('olagan', 'olaganustu')),
  agenda jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{madde:..., oylama_turu:...}]
  scheduled_at timestamptz NOT NULL,
  location text,
  invitees jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [resident_id, ...]
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{resident_id, arsa_payi, katildi:bool}]
  quorum_required_percent integer NOT NULL DEFAULT 51,
  quorum_actual_percent numeric(5,2),           -- arsa_payi toplam / building denominator
  status text NOT NULL DEFAULT 'cagrildi'
    CHECK (status IN ('cagrildi', 'yapildi', 'iptal')),
  karar_defteri_pdf_url text,                   -- yasal arşiv (Sprint 3)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sy_meetings_building_idx ON public.sy_meetings(building_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS sy_meetings_status_idx ON public.sy_meetings(status);

ALTER TABLE public.sy_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_meetings_service" ON public.sy_meetings
  USING (true) WITH CHECK (true);

-- ===== 4) sy_meeting_decisions (M4: KMK 634 karar defteri) =====

CREATE TABLE IF NOT EXISTS public.sy_meeting_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.sy_meetings(id) ON DELETE CASCADE,
  agenda_item_no integer NOT NULL,
  madde text NOT NULL,
  lehte_arsa_payi numeric(10,2) NOT NULL DEFAULT 0,
  aleyhte_arsa_payi numeric(10,2) NOT NULL DEFAULT 0,
  cekimser_arsa_payi numeric(10,2) NOT NULL DEFAULT 0,
  sonuc text NOT NULL DEFAULT 'ertelendi'
    CHECK (sonuc IN ('kabul', 'red', 'ertelendi')),
  karar_metni text,                            -- yasal yazım (final tutanağa girer)
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, agenda_item_no)
);

CREATE INDEX IF NOT EXISTS sy_meeting_decisions_meeting_idx ON public.sy_meeting_decisions(meeting_id);

ALTER TABLE public.sy_meeting_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_meeting_decisions_service" ON public.sy_meeting_decisions
  USING (true) WITH CHECK (true);

-- ===== 5) sy_personnel (M5: Personel) =====

CREATE TABLE IF NOT EXISTS public.sy_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  building_id uuid NOT NULL REFERENCES public.sy_buildings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL,                          -- kapıcı, güvenlik, temizlikçi
  phone text,
  monthly_salary_kurus integer,                -- maaş (kuruş)
  sgk_no text,                                 -- SGK numarası
  start_date date,
  contract_end date,
  is_active boolean NOT NULL DEFAULT true,
  contract_pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sy_personnel_building_idx ON public.sy_personnel(building_id);
CREATE INDEX IF NOT EXISTS sy_personnel_active_idx ON public.sy_personnel(building_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS sy_personnel_contract_end_idx ON public.sy_personnel(contract_end) WHERE contract_end IS NOT NULL;

ALTER TABLE public.sy_personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_personnel_service" ON public.sy_personnel
  USING (true) WITH CHECK (true);

-- ===== 6) sy_suppliers (M5: Tedarikçi) =====

CREATE TABLE IF NOT EXISTS public.sy_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  building_id uuid NOT NULL REFERENCES public.sy_buildings(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  sector text NOT NULL,                        -- asansör, peyzaj, güvenlik...
  contact_name text,
  contact_phone text,
  contact_email text,
  service text,                                -- "Aylık peyzaj bakımı" vb.
  monthly_fee_kurus integer,
  contract_start date,
  contract_end date,
  contract_pdf_url text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sy_suppliers_building_idx ON public.sy_suppliers(building_id);
CREATE INDEX IF NOT EXISTS sy_suppliers_active_idx ON public.sy_suppliers(building_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS sy_suppliers_contract_end_idx ON public.sy_suppliers(contract_end) WHERE contract_end IS NOT NULL;

ALTER TABLE public.sy_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_suppliers_service" ON public.sy_suppliers
  USING (true) WITH CHECK (true);

-- ===== 7) sy_maintenance_schedule (M6: Bakım planı) =====

CREATE TABLE IF NOT EXISTS public.sy_maintenance_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  building_id uuid NOT NULL REFERENCES public.sy_buildings(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,                      -- asansor, yangin, jenerator, peyzaj...
  period_days integer NOT NULL,                -- 180 (6 ay), 365 (yıllık)
  last_done_at timestamptz,
  next_due_at timestamptz NOT NULL,
  assigned_supplier_id uuid REFERENCES public.sy_suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'overdue')),
  legal_basis text,                            -- "TS EN 81-20 asansör yıllık muayene"
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sy_maintenance_schedule_building_idx ON public.sy_maintenance_schedule(building_id);
CREATE INDEX IF NOT EXISTS sy_maintenance_schedule_due_idx ON public.sy_maintenance_schedule(next_due_at);
CREATE INDEX IF NOT EXISTS sy_maintenance_schedule_status_idx ON public.sy_maintenance_schedule(status);

ALTER TABLE public.sy_maintenance_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_maintenance_schedule_service" ON public.sy_maintenance_schedule
  USING (true) WITH CHECK (true);

-- ===== 8) sy_budget_categories (M2: Bütçe) =====

CREATE TABLE IF NOT EXISTS public.sy_budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  building_id uuid NOT NULL REFERENCES public.sy_buildings(id) ON DELETE CASCADE,
  category text NOT NULL,                      -- asansor, peyzaj, güvenlik...
  year integer NOT NULL,
  yearly_planned_kurus integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, category, year)
);

CREATE INDEX IF NOT EXISTS sy_budget_categories_building_year_idx
  ON public.sy_budget_categories(building_id, year);

ALTER TABLE public.sy_budget_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy_budget_categories_service" ON public.sy_budget_categories
  USING (true) WITH CHECK (true);

COMMIT;
