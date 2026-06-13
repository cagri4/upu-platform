-- ──────────────────────────────────────────────────────────────────────────
-- Otel AI Asistan — Faz 5 (Onay Kuyruğu + Bilgi Bankası)
-- ──────────────────────────────────────────────────────────────────────────
-- 2026-06-13 · Plan ref: .planning/OTEL-SAAS-UCTAN-UCA-PLAN.md (FAZ 5)
--
-- AI Eleman tanımı (Çağrı): "Tekrar eden iş süreçlerini DEVRALAN, AI API
-- destekli web uygulaması. Chatbot DEĞİL. Sor-cevap değil, iş başlatıp
-- sona kadar götüren personel."
--
-- Pilot güvenlik: AI'ın ürettiği TÜM dışa giden mesajlar (misafire mail/WA,
-- yorum yanıtı, vb.) sahibinin onay kuyruğundan geçer. Onaylanmayan
-- otomatik gönderim YOK.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. otel_agent_approvals — onay kuyruğu ───────────────────────────────
CREATE TABLE IF NOT EXISTS otel_agent_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL,
  agent_role      TEXT NOT NULL,
                    -- 'direkt_rez' | 'itibar' | 'misafir_iletisim' | 'fiyatlama' | 'tahsilat'
  action_type     TEXT NOT NULL,
                    -- 'review_reply' | 'guest_message' | 'price_change' |
                    -- 'create_reservation' | 'send_invoice' | 'send_payment_link'
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'sent', 'failed')),
  draft_content   TEXT,                              -- AI'ın hazırladığı mesaj/aksiyon önerisi
  context         JSONB NOT NULL DEFAULT '{}'::jsonb, -- Hangi rez/misafir/yorum
  target_channel  TEXT,                              -- 'wa' | 'mail' | 'google_review' | 'system'
  target_address  TEXT,                              -- whatsapp / email / review_id
  related_entity_id   UUID,                          -- rez_id, yorum_id, vb.
  related_entity_type TEXT,
  approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  sent_at         TIMESTAMPTZ,
  send_response   JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_agent_approvals
        ADD CONSTRAINT otel_agent_approvals_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_agent_approvals_hotel_status
  ON otel_agent_approvals(hotel_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otel_agent_approvals_role
  ON otel_agent_approvals(hotel_id, agent_role, created_at DESC);

ALTER TABLE otel_agent_approvals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY otel_agent_approvals_select ON otel_agent_approvals
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
  CREATE POLICY otel_agent_approvals_modify ON otel_agent_approvals
    FOR ALL USING (
      hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 2. otel_agent_knowledge — bilgi bankası ──────────────────────────────
-- Sahibinin AI'a "Otelimi anlatmak için bilmen gerekenler" başlığı altında
-- ekleyeceği kısa not'lar. SSS, oda detayları, çevre, kurallar, vs.
-- AI prompt'una eklenir (token tasarrufu için max 3000 char).
CREATE TABLE IF NOT EXISTS otel_agent_knowledge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
                    -- general | rules | amenities | location | faq | rooms
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_agent_knowledge
        ADD CONSTRAINT otel_agent_knowledge_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_agent_knowledge_hotel
  ON otel_agent_knowledge(hotel_id, is_active, sort_order);

ALTER TABLE otel_agent_knowledge ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY otel_agent_knowledge_select ON otel_agent_knowledge
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
  CREATE POLICY otel_agent_knowledge_modify ON otel_agent_knowledge
    FOR ALL USING (
      hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 3. otel_external_reviews — mock Google review verisi ─────────────────
-- Gerçek GBP API gelene kadar yorumlar buraya manuel/mock olarak eklenir.
-- AI bunlardan unanswered olanları çekip yanıt taslağı yapar.
CREATE TABLE IF NOT EXISTS otel_external_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL,
  platform        TEXT NOT NULL DEFAULT 'google',
                    -- google | booking | tripadvisor | airbnb
  external_id     TEXT,                              -- platform ref id
  author_name     TEXT,
  rating          INT,                               -- 1-5
  language        TEXT DEFAULT 'tr',
  review_text     TEXT NOT NULL,
  review_at       TIMESTAMPTZ,
  reply_text      TEXT,                              -- onaylanıp yayınlanan yanıt
  reply_status    TEXT NOT NULL DEFAULT 'unanswered'
                    CHECK (reply_status IN ('unanswered', 'draft', 'pending_approval', 'published', 'skipped')),
  draft_reply     TEXT,                              -- AI taslağı
  is_mock         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_external_reviews
        ADD CONSTRAINT otel_external_reviews_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_external_reviews_hotel_status
  ON otel_external_reviews(hotel_id, reply_status, created_at DESC);

ALTER TABLE otel_external_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY otel_external_reviews_select ON otel_external_reviews
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
  CREATE POLICY otel_external_reviews_modify ON otel_external_reviews
    FOR ALL USING (
      hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
