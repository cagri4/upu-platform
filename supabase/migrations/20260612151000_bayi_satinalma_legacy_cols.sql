-- Faz 7 düzeltme — bayi_suppliers / bayi_purchase_orders eksik kolonlar.
--
-- bayi_suppliers ve bayi_purchase_orders production'da migration-dışı (manuel)
-- oluşturulmuş minimal şemayla mevcuttu; 20260612142200'deki CREATE TABLE IF
-- NOT EXISTS bu yüzden atlandı ve yeni kolonlar eklenmedi. Bu migration
-- eksik kolonları idempotent ekler (additive, veri kaybı yok).

ALTER TABLE public.bayi_suppliers
  ADD COLUMN IF NOT EXISTS tax_no TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS payment_term_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.bayi_purchase_orders
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS expected_date DATE,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bayi_po_status
  ON public.bayi_purchase_orders (tenant_id, status);
