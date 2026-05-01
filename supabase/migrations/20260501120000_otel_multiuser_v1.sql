-- ──────────────────────────────────────────────────────────────────────────
-- Otel Multi-User v1 — Personnel + Guest CRM + Online Check-in
-- ──────────────────────────────────────────────────────────────────────────
-- 2026-05-01 · Plan ref: .planning/otel-multiuser-plan.md (MVP1)
--
-- Adds:
--   - hotel_employees: per-hotel capability override (multi-property scope)
--   - otel_pre_checkins: online check-in form data (kimlik foto + imza + tercih)
--   - otel_guest_hotels: lifetime loyalty rollup per guest×hotel (MVP1: empty,
--                        MVP2: cron populates)
--   - otel_reservations.pre_checkin_complete, guest_profile_id
--   - otel_housekeeping_tasks.assigned_to (own filter için)
--
-- Seeds existing otel-tenant admin profiles with capabilities=['*'] so
-- they pass the capability gate immediately.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. hotel_employees — per-hotel capability override ───────────────────
-- profile.capabilities = global default. hotel_employees row exists →
-- those capabilities apply ONLY when querying that hotel's rows.
-- For owners (capabilities='*') no row needed; the wildcard wins.
CREATE TABLE IF NOT EXISTS hotel_employees (
  hotel_id      UUID NOT NULL,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  capabilities  TEXT[] NOT NULL DEFAULT '{}',
  position      TEXT,                          -- "Resepsiyonist", "Kat Görevlisi"
  shift_hours   TEXT,                          -- "08:00-16:00", "Gece"
  assigned_floors INT[] DEFAULT '{}',          -- Kat görevlisi için
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hotel_id, profile_id)
);

-- otel_hotels FK — defensive: only add if otel_hotels exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE hotel_employees
        ADD CONSTRAINT hotel_employees_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_hotel_employees_profile ON hotel_employees(profile_id);
CREATE INDEX IF NOT EXISTS idx_hotel_employees_hotel ON hotel_employees(hotel_id);

-- ── 2. otel_pre_checkins — online check-in form data ─────────────────────
CREATE TABLE IF NOT EXISTS otel_pre_checkins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id      UUID NOT NULL,
  hotel_id            UUID NOT NULL,
  guest_profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  id_photo_url        TEXT,                    -- Supabase Storage path
  signature_url       TEXT,
  preferences         JSONB NOT NULL DEFAULT '{}',  -- pillow, allergies, eta
  kvkk_accepted_at    TIMESTAMPTZ,
  marketing_opt_in    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at        TIMESTAMPTZ,             -- NULL = form açıldı ama submit edilmedi
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_reservations') THEN
    BEGIN
      ALTER TABLE otel_pre_checkins
        ADD CONSTRAINT otel_pre_checkins_rez_fk
        FOREIGN KEY (reservation_id) REFERENCES otel_reservations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_pre_checkins
        ADD CONSTRAINT otel_pre_checkins_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_pre_checkins_rez ON otel_pre_checkins(reservation_id);
CREATE INDEX IF NOT EXISTS idx_otel_pre_checkins_hotel ON otel_pre_checkins(hotel_id);
CREATE INDEX IF NOT EXISTS idx_otel_pre_checkins_guest ON otel_pre_checkins(guest_profile_id);

-- ── 3. otel_reservations — pre_checkin_complete + guest_profile_id ───────
ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS pre_checkin_complete BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS guest_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_otel_reservations_guest_profile
  ON otel_reservations(guest_profile_id) WHERE guest_profile_id IS NOT NULL;

-- ── 4. otel_housekeeping_tasks.assigned_to — own filter için ─────────────
ALTER TABLE otel_housekeeping_tasks
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_otel_housekeeping_tasks_assigned
  ON otel_housekeeping_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- ── 5. otel_guest_hotels — lifetime loyalty rollup ───────────────────────
-- MVP1: empty. MVP2: cron populates (segments — "12+ ay sessiz", "VIP 3+", vb).
CREATE TABLE IF NOT EXISTS otel_guest_hotels (
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hotel_id      UUID NOT NULL,
  first_visit   DATE,
  last_visit    DATE,
  total_stays   INT NOT NULL DEFAULT 0,
  total_spend   NUMERIC(12,2),                -- MVP2 segment için
  last_message_at TIMESTAMPTZ,                -- 90 gün spam guard
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, hotel_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_guest_hotels
        ADD CONSTRAINT otel_guest_hotels_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_guest_hotels_hotel ON otel_guest_hotels(hotel_id);
CREATE INDEX IF NOT EXISTS idx_otel_guest_hotels_last_visit ON otel_guest_hotels(last_visit);

-- ── 6. magic_link_tokens.purpose — bayi'den miras, doğrulama ─────────────
-- Bayi migration zaten ekledi. Defensive ekleme — eksikse no-op.
ALTER TABLE magic_link_tokens
  ADD COLUMN IF NOT EXISTS purpose TEXT;

-- ── 7. profiles.role — 'guest' enum genişletme ───────────────────────────
-- profiles.role TEXT olduğu için constraint check yoksa direkt yazılabilir.
-- Eğer CHECK constraint varsa, bu migration onu güncellemeyi dener.
DO $$
BEGIN
  -- Mevcut constraint'i bul ve drop et
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE 'profiles_role_check%'
    AND conrelid = 'profiles'::regclass
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE profiles DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conname LIKE 'profiles_role_check%'
      AND conrelid = 'profiles'::regclass
      LIMIT 1
    );
  END IF;
END$$;

-- Yeni constraint — 'guest' eklenmiş
DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'employee', 'dealer', 'system', 'user', 'guest'));
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 8. Otel admin profiles seed — capabilities='*' ───────────────────────
-- Bayi capability migration'ı sadece bayi-tenant admin'lerini seedledi.
-- Otel admin'leri henüz capability'siz, gate hepsini reddediyor olacak.
UPDATE profiles
SET capabilities = ARRAY['*']
WHERE tenant_id IN (SELECT id FROM tenants WHERE saas_type = 'otel')
  AND role IN ('admin', 'user')
  AND (capabilities IS NULL OR capabilities = '{}');

-- ── 9. RLS policies — hotel_id-scoped ────────────────────────────────────
-- WhatsApp router servis-rolü kullanır (RLS bypass), ama web panel/API'ler
-- anon-rol ile auth.uid() üzerinden RLS uygular. Multi-property ölçek için
-- her otel_* tablosuna hotel_id filter'ı.
--
-- Mantık:
--   - Owner (capabilities '*' içinde): otel_user_hotels'taki tüm hotel_id'ler
--   - Employee: hotel_employees'taki hotel_id'ler
--   - Guest (role='guest'): kendi rezervasyonu (guest_profile_id eşleşmesi)
--
-- Helper fonksiyon: tek noktada kural, tüm tablolarda kullanılır.
CREATE OR REPLACE FUNCTION otel_user_can_see_hotel(target_hotel_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND '*' = ANY(p.capabilities)
        AND EXISTS (SELECT 1 FROM otel_user_hotels ouh WHERE ouh.user_id = p.id AND ouh.hotel_id = target_hotel_id)
    )
    OR EXISTS (
      SELECT 1 FROM hotel_employees he
      WHERE he.profile_id = auth.uid() AND he.hotel_id = target_hotel_id
    );
$$;

-- otel_reservations RLS
ALTER TABLE otel_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otel_reservations_select ON otel_reservations;
CREATE POLICY otel_reservations_select ON otel_reservations
  FOR SELECT
  USING (
    otel_user_can_see_hotel(hotel_id)
    OR guest_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS otel_reservations_modify ON otel_reservations;
CREATE POLICY otel_reservations_modify ON otel_reservations
  FOR ALL
  USING (otel_user_can_see_hotel(hotel_id))
  WITH CHECK (otel_user_can_see_hotel(hotel_id));

-- otel_pre_checkins RLS
ALTER TABLE otel_pre_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otel_pre_checkins_select ON otel_pre_checkins;
CREATE POLICY otel_pre_checkins_select ON otel_pre_checkins
  FOR SELECT
  USING (
    otel_user_can_see_hotel(hotel_id)
    OR guest_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS otel_pre_checkins_modify ON otel_pre_checkins;
CREATE POLICY otel_pre_checkins_modify ON otel_pre_checkins
  FOR ALL
  USING (
    otel_user_can_see_hotel(hotel_id)
    OR guest_profile_id = auth.uid()
  )
  WITH CHECK (
    otel_user_can_see_hotel(hotel_id)
    OR guest_profile_id = auth.uid()
  );

-- otel_housekeeping_tasks RLS — assigned_to görüntüleme + own filter
ALTER TABLE otel_housekeeping_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otel_housekeeping_tasks_select ON otel_housekeeping_tasks;
CREATE POLICY otel_housekeeping_tasks_select ON otel_housekeeping_tasks
  FOR SELECT
  USING (
    -- Only employees of this hotel see anything; "own" filter is applied
    -- in the application layer based on capabilities (HOUSEKEEPING_VIEW_OWN
    -- vs HOUSEKEEPING_VIEW). DB allows both; gate decides.
    otel_user_can_see_hotel(hotel_id)
  );

DROP POLICY IF EXISTS otel_housekeeping_tasks_modify ON otel_housekeeping_tasks;
CREATE POLICY otel_housekeeping_tasks_modify ON otel_housekeeping_tasks
  FOR ALL
  USING (otel_user_can_see_hotel(hotel_id))
  WITH CHECK (otel_user_can_see_hotel(hotel_id));

-- otel_guest_hotels RLS — owner görür, misafir kendi rollupını görür
ALTER TABLE otel_guest_hotels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otel_guest_hotels_select ON otel_guest_hotels;
CREATE POLICY otel_guest_hotels_select ON otel_guest_hotels
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR otel_user_can_see_hotel(hotel_id)
  );

-- hotel_employees RLS — sadece otel sahibi (owner) düzenler
ALTER TABLE hotel_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_employees_select ON hotel_employees;
CREATE POLICY hotel_employees_select ON hotel_employees
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR otel_user_can_see_hotel(hotel_id)
  );

DROP POLICY IF EXISTS hotel_employees_modify ON hotel_employees;
CREATE POLICY hotel_employees_modify ON hotel_employees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND '*' = ANY(p.capabilities)
        AND EXISTS (SELECT 1 FROM otel_user_hotels ouh WHERE ouh.user_id = p.id AND ouh.hotel_id = hotel_employees.hotel_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND '*' = ANY(p.capabilities)
        AND EXISTS (SELECT 1 FROM otel_user_hotels ouh WHERE ouh.user_id = p.id AND ouh.hotel_id = hotel_employees.hotel_id)
    )
  );
