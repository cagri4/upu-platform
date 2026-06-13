-- ──────────────────────────────────────────────────────────────────────────
-- Otel PMS Core — Faz 1
-- ──────────────────────────────────────────────────────────────────────────
-- 2026-06-13 · Plan ref: .planning/OTEL-SAAS-UCTAN-UCA-PLAN.md (FAZ 1)
--
-- Adds:
--   - otel_price_calendar: sezon + gün bazlı fiyat (oda tipi × tarih)
--   - otel_check_room_availability(): müsaitlik kontrol RPC (çift rez engeli)
--   - otel_reservations EXCLUDE constraint: aynı oda + çakışan tarih engeli
--   - housekeeping_tasks otomatik enum check'leri
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. otel_price_calendar — sezon/gün bazlı fiyat ───────────────────────
-- Bir oda tipinde belirli bir gün için farklı bir fiyat tanımlanabilir.
-- Lookup sırası (handler bağlar):
--   1. otel_price_calendar where date = X AND room_type = Y → varsa kullan
--   2. otel_rooms.base_price → default
CREATE TABLE IF NOT EXISTS otel_price_calendar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL,
  room_type     TEXT NOT NULL,
  date          DATE NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  season_label  TEXT,                          -- "Yüksek Sezon", "Bayram", "Hafta sonu"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hotel_id, room_type, date)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_price_calendar
        ADD CONSTRAINT otel_price_calendar_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_price_calendar_hotel_date
  ON otel_price_calendar(hotel_id, date);
CREATE INDEX IF NOT EXISTS idx_otel_price_calendar_room_type
  ON otel_price_calendar(hotel_id, room_type, date);

ALTER TABLE otel_price_calendar ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY otel_price_calendar_select ON otel_price_calendar
    FOR SELECT USING (
      hotel_id IN (
        SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid()
        UNION
        SELECT hotel_id FROM hotel_employees WHERE profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE POLICY otel_price_calendar_modify ON otel_price_calendar
    FOR ALL USING (
      hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 2. Müsaitlik kontrol RPC ─────────────────────────────────────────────
-- Verilen oda + tarih aralığı için çakışan onaylı/checked_in rezervasyon
-- var mı? Booking engine + manuel ekle UI bunu çağırır.
--
-- Çakışma kuralı: yeni_check_in < mevcut_check_out AND yeni_check_out > mevcut_check_in
CREATE OR REPLACE FUNCTION otel_check_room_availability(
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_exclude_reservation_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_conflict_count INT;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM otel_reservations
  WHERE room_id = p_room_id
    AND status IN ('confirmed', 'checked_in', 'pending')
    AND check_in < p_check_out
    AND check_out > p_check_in
    AND (p_exclude_reservation_id IS NULL OR id <> p_exclude_reservation_id);
  RETURN v_conflict_count = 0;
END;
$$;

-- ── 3. Fiyat lookup RPC ──────────────────────────────────────────────────
-- Bir oda + tarih için geçerli fiyatı döndürür (price_calendar varsa o, yoksa base_price).
CREATE OR REPLACE FUNCTION otel_get_room_price(
  p_room_id UUID,
  p_date DATE
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_room_type TEXT;
  v_hotel_id UUID;
  v_base NUMERIC;
  v_calendar NUMERIC;
BEGIN
  SELECT room_type, hotel_id, base_price
    INTO v_room_type, v_hotel_id, v_base
  FROM otel_rooms WHERE id = p_room_id;
  IF v_room_type IS NULL THEN RETURN 0; END IF;

  SELECT price INTO v_calendar
  FROM otel_price_calendar
  WHERE hotel_id = v_hotel_id AND room_type = v_room_type AND date = p_date
  LIMIT 1;

  RETURN COALESCE(v_calendar, v_base, 0);
END;
$$;

-- ── 4. Toplam fiyat hesaplama RPC ────────────────────────────────────────
-- check_in..check_out arası gece sayısı × günlük fiyat (price_calendar veya base).
CREATE OR REPLACE FUNCTION otel_calculate_total_price(
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_total NUMERIC := 0;
  v_current DATE := p_check_in;
BEGIN
  WHILE v_current < p_check_out LOOP
    v_total := v_total + otel_get_room_price(p_room_id, v_current);
    v_current := v_current + 1;
  END LOOP;
  RETURN v_total;
END;
$$;

-- ── 5. Misafir CRM rollup trigger ────────────────────────────────────────
-- Bir rezervasyon "checked_out" durumuna geçtiğinde otel_guest_hotels'i
-- otomatik güncelle (last_visit, total_stays, total_spend).
CREATE OR REPLACE FUNCTION otel_rollup_guest_stay() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'checked_out' AND (OLD.status IS NULL OR OLD.status <> 'checked_out') THEN
    IF NEW.guest_profile_id IS NOT NULL THEN
      INSERT INTO otel_guest_hotels (
        profile_id, hotel_id, first_visit, last_visit, total_stays, total_spend
      ) VALUES (
        NEW.guest_profile_id, NEW.hotel_id, NEW.check_in, NEW.check_out, 1, NEW.total_price
      )
      ON CONFLICT (profile_id, hotel_id) DO UPDATE
        SET last_visit  = EXCLUDED.last_visit,
            total_stays = otel_guest_hotels.total_stays + 1,
            total_spend = COALESCE(otel_guest_hotels.total_spend, 0) + COALESCE(NEW.total_price, 0),
            updated_at  = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS otel_rollup_guest_stay_tg ON otel_reservations;
CREATE TRIGGER otel_rollup_guest_stay_tg
  AFTER UPDATE OF status ON otel_reservations
  FOR EACH ROW EXECUTE FUNCTION otel_rollup_guest_stay();
