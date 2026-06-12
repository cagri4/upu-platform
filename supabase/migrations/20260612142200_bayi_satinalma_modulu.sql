-- Faz 7 — Satın Alma (Purchasing) Modülü
--
-- Dağıtıcı firmaların tedarikçilerinden satın alma yönetimi:
-- tedarikçi CRUD, satın alma siparişi (PO) + satırlar, kısmi/tam mal kabul
-- (Faz 5 depo entegrasyonu — applyStockChange), basit tedarikçi cari hesap
-- (PO = borç, ödeme = mahsup). Faz 5/6 ile aynı izolasyon/pattern.
--
-- Konsept:
--   bayi_suppliers              — tedarikçi (vergi no, kontak, ödeme vadesi)
--   bayi_purchase_orders        — PO başlığı (durum akışı + beklenen teslim)
--   bayi_purchase_order_lines   — PO satırı (ürün, adet, birim fiyat, gelen adet)
--   bayi_supplier_payments      — tedarikçiye ödeme kayıtları (cari mahsup)
--
-- Cari hesap: ayrı tablo YOK — borç = non-draft PO toplamları, ödenen =
-- supplier_payments toplamı, kalan = borç − ödenen (API'de aggregate). Mal
-- kabul depo stoğunu Faz 5 atomik RPC (applyStockChange) ile artırır;
-- po_lines.received_qty güncellenir, PO durumu kısmi/tam hesaplanır.

-- ──────────────────────────────────────────────────────────────────────
-- 1) bayi_suppliers — tedarikçi
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_no TEXT,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  payment_term_days INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_suppliers_tenant
  ON public.bayi_suppliers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_suppliers_active
  ON public.bayi_suppliers (tenant_id, is_active) WHERE is_active = true;

ALTER TABLE public.bayi_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_suppliers;
CREATE POLICY "tenant_isolation" ON public.bayi_suppliers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 2) bayi_purchase_orders — PO başlığı
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.bayi_suppliers(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  -- 'draft' | 'sent' | 'partial' | 'received' | 'closed'
  status TEXT NOT NULL DEFAULT 'draft',
  expected_date DATE,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_po_tenant
  ON public.bayi_purchase_orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayi_po_supplier
  ON public.bayi_purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_bayi_po_status
  ON public.bayi_purchase_orders (tenant_id, status);

ALTER TABLE public.bayi_purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_purchase_orders;
CREATE POLICY "tenant_isolation" ON public.bayi_purchase_orders
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 3) bayi_purchase_order_lines — PO satırı
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  po_id UUID NOT NULL REFERENCES public.bayi_purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  received_qty NUMERIC(12, 3) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_po_lines_po
  ON public.bayi_purchase_order_lines (po_id);
CREATE INDEX IF NOT EXISTS idx_bayi_po_lines_tenant
  ON public.bayi_purchase_order_lines (tenant_id);

ALTER TABLE public.bayi_purchase_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_purchase_order_lines;
CREATE POLICY "tenant_isolation" ON public.bayi_purchase_order_lines
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 4) bayi_supplier_payments — tedarikçi ödeme kayıtları (cari mahsup)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.bayi_suppliers(id) ON DELETE CASCADE,
  po_id UUID REFERENCES public.bayi_purchase_orders(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  method TEXT,                                  -- 'transfer' | 'cash' | 'check' | ...
  note TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_supplier_payments_tenant
  ON public.bayi_supplier_payments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_supplier_payments_supplier
  ON public.bayi_supplier_payments (supplier_id, paid_at DESC);

ALTER TABLE public.bayi_supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_supplier_payments;
CREATE POLICY "tenant_isolation" ON public.bayi_supplier_payments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );
