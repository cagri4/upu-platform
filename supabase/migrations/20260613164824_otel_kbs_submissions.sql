-- ──────────────────────────────────────────────────────────────────────────
-- Otel KBS (Konaklama Bildirim Sistemi) + Online Check-in zenginleştirme — Faz 3
-- ──────────────────────────────────────────────────────────────────────────
-- 2026-06-13 · Plan ref: .planning/OTEL-SAAS-UCTAN-UCA-PLAN.md (FAZ 3)
--
-- Adds:
--   - otel_pre_checkins: KBS-uyumlu kimlik alanları (tc_no, birth_date, vb.)
--   - otel_kbs_submissions: her rezervasyon için KBS gönderim kaydı
--   - status enum: pending | sent | accepted | rejected | failed
--   - Real entegrasyon için credential gelene kadar mock client kullanılır.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. otel_pre_checkins — KBS-uyumlu kimlik alanları ────────────────────
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS tc_no TEXT;
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE otel_pre_checkins ADD COLUMN IF NOT EXISTS gender TEXT;

-- ── 2. otel_kbs_submissions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otel_kbs_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL,
  hotel_id        UUID NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'accepted', 'rejected', 'failed')),
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  kbs_response    JSONB,                    -- mock veya real KBS yanıtı
  kbs_reference   TEXT,                     -- KBS tarafından dönen ref no
  is_mock         BOOLEAN NOT NULL DEFAULT TRUE,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_reservations') THEN
    BEGIN
      ALTER TABLE otel_kbs_submissions
        ADD CONSTRAINT otel_kbs_submissions_rez_fk
        FOREIGN KEY (reservation_id) REFERENCES otel_reservations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_kbs_submissions
        ADD CONSTRAINT otel_kbs_submissions_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_kbs_subs_rez ON otel_kbs_submissions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_otel_kbs_subs_hotel_status ON otel_kbs_submissions(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_otel_kbs_subs_created ON otel_kbs_submissions(created_at DESC);

-- Bir rezervasyon için tek aktif (sent/accepted) kayıt önerilir; defensive,
-- ama UNIQUE değil çünkü rejected sonrası tekrar gönderilebilmeli.

ALTER TABLE otel_kbs_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY otel_kbs_submissions_select ON otel_kbs_submissions
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
  CREATE POLICY otel_kbs_submissions_modify ON otel_kbs_submissions
    FOR ALL USING (
      hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
