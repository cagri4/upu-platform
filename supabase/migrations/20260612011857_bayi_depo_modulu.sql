-- Faz 5 — Depo (Warehouse) Modülü
--
-- Multi-depo stok yönetimi: tenant başına N depo, ürün × depo kantite,
-- depolar arası transfer, fiziki sayım (stocktake), mal kabul, min/max
-- eşik. Mevcut bayi_stock_movements tablosu hareket/audit kaydı için
-- reuse edilir (warehouse_id eklenir). bayi_products.stock_quantity
-- tenant-toplam olarak korunur (sipariş/katalog backward-compat) — depo
-- işlemleri bunu warehouse_stock toplamıyla senkron tutar.
--
-- Konsept:
--   bayi_warehouses          — depo başlıkları (Ana Depo, Şube)
--   bayi_warehouse_stock     — depo × ürün × kantite
--   bayi_stock_transfers     — depolar arası aktarım kaydı
--   bayi_stocktake_sessions  — fiziki sayım oturumu
--   bayi_stocktake_items     — sayım satırları (beklenen vs sayılan)
--   bayi_stock_movements     — +warehouse_id (hareket/audit)
--   bayi_products            — +max_stock_threshold (min = low_stock_threshold)

-- ──────────────────────────────────────────────────────────────────────
-- 1) bayi_warehouses — depo başlıkları
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  manager_user_id UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_warehouses_tenant
  ON public.bayi_warehouses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_warehouses_active
  ON public.bayi_warehouses (tenant_id, is_active)
  WHERE is_active = true;

ALTER TABLE public.bayi_warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_warehouses;
CREATE POLICY "tenant_isolation" ON public.bayi_warehouses
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 2) bayi_warehouse_stock — depo × ürün × kantite
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.bayi_warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_wh_stock_tenant
  ON public.bayi_warehouse_stock (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_wh_stock_warehouse
  ON public.bayi_warehouse_stock (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_bayi_wh_stock_product
  ON public.bayi_warehouse_stock (product_id);

ALTER TABLE public.bayi_warehouse_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_warehouse_stock;
CREATE POLICY "tenant_isolation" ON public.bayi_warehouse_stock
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 3) bayi_stock_transfers — depolar arası aktarım
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_warehouse_id UUID NOT NULL REFERENCES public.bayi_warehouses(id) ON DELETE CASCADE,
  to_warehouse_id UUID NOT NULL REFERENCES public.bayi_warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_transfers_tenant
  ON public.bayi_stock_transfers (tenant_id, created_at DESC);

ALTER TABLE public.bayi_stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_stock_transfers;
CREATE POLICY "tenant_isolation" ON public.bayi_stock_transfers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 4) bayi_stocktake_sessions — fiziki sayım oturumu
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_stocktake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.bayi_warehouses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'closed'
  category_id UUID,
  brand TEXT,
  note TEXT,
  started_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by UUID,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bayi_stocktake_tenant
  ON public.bayi_stocktake_sessions (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayi_stocktake_warehouse_open
  ON public.bayi_stocktake_sessions (warehouse_id, status);

ALTER TABLE public.bayi_stocktake_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_stocktake_sessions;
CREATE POLICY "tenant_isolation" ON public.bayi_stocktake_sessions
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 5) bayi_stocktake_items — sayım satırları
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_stocktake_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.bayi_stocktake_sessions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  expected_qty NUMERIC(12, 3) NOT NULL DEFAULT 0,
  counted_qty NUMERIC(12, 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_stocktake_items_session
  ON public.bayi_stocktake_items (session_id);
CREATE INDEX IF NOT EXISTS idx_bayi_stocktake_items_tenant
  ON public.bayi_stocktake_items (tenant_id);

ALTER TABLE public.bayi_stocktake_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_stocktake_items;
CREATE POLICY "tenant_isolation" ON public.bayi_stocktake_items
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 6) bayi_stock_movements — depo desteği (mevcut hareket/audit tablosu)
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_stock_movements
  ADD COLUMN IF NOT EXISTS warehouse_id UUID;

CREATE INDEX IF NOT EXISTS idx_stock_mov_warehouse
  ON public.bayi_stock_movements (warehouse_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────
-- 7) bayi_products — max stok eşiği (min zaten low_stock_threshold)
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_products
  ADD COLUMN IF NOT EXISTS max_stock_threshold NUMERIC(12, 3);
