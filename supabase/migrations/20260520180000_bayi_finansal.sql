-- Faz 1B — Bayi finansal modüller (cari/vade/tahsilat/fatura)
--
-- Banka POS gerçek entegrasyon + Logo muhasebe sync ileride; bu sprint
-- manuel akışlar (tahsilat dekont upload + admin onay + fatura admin
-- upload). Cari ekstre ayrı tablo yerine view (orders + invoices +
-- payments UNION).

-- Tahsilat (manuel kayıt akışı)
CREATE TABLE IF NOT EXISTS bayi_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TRY',
  payment_date DATE NOT NULL,
  dekont_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON bayi_payments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_dealer ON bayi_payments(dealer_user_id);

-- Fatura (manual upload + Logo/Mikro sync için yer)
CREATE TABLE IF NOT EXISTS bayi_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_user_id UUID NOT NULL,
  invoice_no TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TRY',
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','overdue','cancelled')),
  external_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_no)
);
CREATE INDEX IF NOT EXISTS idx_invoices_dealer_status ON bayi_invoices(dealer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON bayi_invoices(due_date);

-- Cari ekstre view — orders (borç) + invoices (borç) + payments (alacak).
-- Bayi adına borç = dealer'a verdiğimiz mal/hizmet, alacak = bayi ödemesi.
CREATE OR REPLACE VIEW bayi_account_statement AS
SELECT
  'order'::text AS entry_type,
  o.id AS reference_id,
  o.dealer_user_id,
  o.tenant_id,
  o.created_at AS entry_date,
  o.total_amount AS debit,
  0::numeric AS credit,
  'Sipariş #' || substring(o.id::text, 1, 8) AS description
FROM bayi_dealer_orders o
WHERE o.status NOT IN ('cancelled', 'rejected')

UNION ALL

SELECT
  'invoice'::text,
  i.id,
  i.dealer_user_id,
  i.tenant_id,
  i.issue_date::timestamptz,
  i.amount,
  0::numeric,
  'Fatura ' || i.invoice_no
FROM bayi_invoices i
WHERE i.status != 'cancelled'

UNION ALL

SELECT
  'payment'::text,
  p.id,
  p.dealer_user_id,
  p.tenant_id,
  p.payment_date::timestamptz,
  0::numeric,
  p.amount,
  'Tahsilat ' || COALESCE(p.notes, p.payment_date::text)
FROM bayi_payments p
WHERE p.status = 'approved';
