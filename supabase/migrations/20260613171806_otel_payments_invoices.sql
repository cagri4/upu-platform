-- ──────────────────────────────────────────────────────────────────────────
-- Otel Tahsilat (Mollie) + e-Fatura Mock — Faz 4
-- ──────────────────────────────────────────────────────────────────────────
-- 2026-06-13 · Plan ref: .planning/OTEL-SAAS-UCTAN-UCA-PLAN.md (FAZ 4)
--
-- Adds:
--   - otel_payments: rezervasyon başına ödeme/kapora kayıtları (Mollie + mock)
--   - otel_invoices: e-Fatura/e-Arşiv kayıtları (mock entegratör)
--   - otel_reservations.paid_amount + deposit_required (ödeme durumu)
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. otel_payments ─────────────────────────────────────────────────────
-- Kapora veya tam ödeme. Provider: mollie (gerçek) | iyzico | manual_iban
-- (sahibinin elle "geldi" işaretlemesi) | refund.
CREATE TABLE IF NOT EXISTS otel_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id        UUID NOT NULL,
  hotel_id              UUID NOT NULL,
  amount                NUMERIC(10,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'TRY',
  payment_type          TEXT NOT NULL
                          CHECK (payment_type IN ('deposit', 'full', 'partial', 'refund')),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'open', 'paid', 'canceled', 'expired', 'failed', 'refunded')),
  provider              TEXT NOT NULL DEFAULT 'mollie',
                          -- mollie | iyzico | manual_iban | cash
  provider_payment_id   TEXT,                    -- mollie payment id (tr_xxx)
  checkout_url          TEXT,                    -- Mollie checkoutUrl
  paid_at               TIMESTAMPTZ,
  description           TEXT,
  metadata              JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_reservations') THEN
    BEGIN
      ALTER TABLE otel_payments
        ADD CONSTRAINT otel_payments_rez_fk
        FOREIGN KEY (reservation_id) REFERENCES otel_reservations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_payments
        ADD CONSTRAINT otel_payments_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_payments_rez ON otel_payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_otel_payments_hotel_status ON otel_payments(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_otel_payments_provider_id ON otel_payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otel_payments_created ON otel_payments(created_at DESC);

ALTER TABLE otel_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY otel_payments_select ON otel_payments
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
  CREATE POLICY otel_payments_modify ON otel_payments
    FOR ALL USING (
      hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 2. otel_invoices (e-Fatura mock) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS otel_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id      UUID NOT NULL,
  hotel_id            UUID NOT NULL,
  invoice_type        TEXT NOT NULL DEFAULT 'e_arsiv'
                        CHECK (invoice_type IN ('e_fatura', 'e_arsiv')),
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'failed')),
  invoice_number      TEXT,                          -- Entegratör tarafından dönen no
  invoice_uuid        TEXT,                          -- e-Fatura UUID (mock)
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url             TEXT,
  total_amount        NUMERIC(10,2),
  currency            TEXT DEFAULT 'TRY',
  is_mock             BOOLEAN NOT NULL DEFAULT TRUE,
  integrator_response JSONB,
  error_message       TEXT,
  sent_at             TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_reservations') THEN
    BEGIN
      ALTER TABLE otel_invoices
        ADD CONSTRAINT otel_invoices_rez_fk
        FOREIGN KEY (reservation_id) REFERENCES otel_reservations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='otel_hotels') THEN
    BEGIN
      ALTER TABLE otel_invoices
        ADD CONSTRAINT otel_invoices_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES otel_hotels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_otel_invoices_rez ON otel_invoices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_otel_invoices_hotel_status ON otel_invoices(hotel_id, status);

ALTER TABLE otel_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY otel_invoices_select ON otel_invoices
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
  CREATE POLICY otel_invoices_modify ON otel_invoices
    FOR ALL USING (
      hotel_id IN (SELECT hotel_id FROM otel_user_hotels WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 3. otel_reservations.paid_amount + deposit_required ──────────────────
ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS deposit_required NUMERIC(10,2);  -- NULL = kapora gerekmez

-- ── 4. Trigger — payment paid olunca rez.paid_amount güncelle ────────────
CREATE OR REPLACE FUNCTION otel_sync_paid_amount() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM otel_payments
  WHERE reservation_id = COALESCE(NEW.reservation_id, OLD.reservation_id)
    AND status = 'paid'
    AND payment_type IN ('deposit', 'full', 'partial');

  -- Refund'ları çıkar
  v_total := v_total - COALESCE((
    SELECT SUM(amount) FROM otel_payments
    WHERE reservation_id = COALESCE(NEW.reservation_id, OLD.reservation_id)
      AND status = 'paid' AND payment_type = 'refund'
  ), 0);

  UPDATE otel_reservations
  SET paid_amount = v_total, updated_at = NOW()
  WHERE id = COALESCE(NEW.reservation_id, OLD.reservation_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS otel_payment_sync_tg ON otel_payments;
CREATE TRIGGER otel_payment_sync_tg
  AFTER INSERT OR UPDATE OF status, amount OR DELETE ON otel_payments
  FOR EACH ROW EXECUTE FUNCTION otel_sync_paid_amount();
