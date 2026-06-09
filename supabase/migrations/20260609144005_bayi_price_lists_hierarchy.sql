-- Faz 1.2 — Bayi fiyat listesi hiyerarşisi
--
-- Konsept:
--   bayi_price_lists           — başlıklar (Default, A-segment, Ramazan kampanyası)
--   bayi_price_list_items      — liste içindeki ürün × birim fiyat
--   bayi_price_tiers           — item × min miktar → iskonto % (10 koli %5)
--   bayi_dealer_price_assignments — bayi × liste × öncelik (1=ilk bakılan)
--
-- bayi_products + bayi_categories ZATEN MEVCUT. Bu migration onlara
-- dokunmaz; yalnız price hierarchy katmanını ekler.
--
-- RLS: tüm tablolarda tenant_isolation policy (profil sahibi tenant'ı için
-- tüm satırlar görünür). rls_all_tenant_tables 20260601230742 pattern'i.

CREATE TABLE IF NOT EXISTS public.bayi_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Geçerlilik aralığı (NULL = sınırsız, bitiş NULL = açık uçlu)
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'TRY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_bayi_price_lists_tenant
  ON public.bayi_price_lists (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_price_lists_active
  ON public.bayi_price_lists (tenant_id, is_active)
  WHERE is_active = true;

ALTER TABLE public.bayi_price_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_price_lists;
CREATE POLICY "tenant_isolation" ON public.bayi_price_lists
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- bayi_price_list_items: liste × ürün × birim fiyat
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL REFERENCES public.bayi_price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  unit_price NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (price_list_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_price_list_items_list
  ON public.bayi_price_list_items (price_list_id);
CREATE INDEX IF NOT EXISTS idx_bayi_price_list_items_product
  ON public.bayi_price_list_items (product_id);
CREATE INDEX IF NOT EXISTS idx_bayi_price_list_items_tenant
  ON public.bayi_price_list_items (tenant_id);

ALTER TABLE public.bayi_price_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_price_list_items;
CREATE POLICY "tenant_isolation" ON public.bayi_price_list_items
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- bayi_price_tiers: kademe iskonto (10 koli %5, 50 koli %12)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_list_item_id UUID NOT NULL REFERENCES public.bayi_price_list_items(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity >= 1),
  discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (price_list_item_id, min_quantity)
);

CREATE INDEX IF NOT EXISTS idx_bayi_price_tiers_item
  ON public.bayi_price_tiers (price_list_item_id, min_quantity);
CREATE INDEX IF NOT EXISTS idx_bayi_price_tiers_tenant
  ON public.bayi_price_tiers (tenant_id);

ALTER TABLE public.bayi_price_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_price_tiers;
CREATE POLICY "tenant_isolation" ON public.bayi_price_tiers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- bayi_dealer_price_assignments: bayi × liste × öncelik
--
-- Bir bayiye birden çok liste atanabilir (default + segment + kampanya);
-- priority düşük olan önce bakılır. resolveDealerPrice() bu sıraya göre
-- ilk eşleşen listeyi kullanır.
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_dealer_price_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL REFERENCES public.bayi_price_lists(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dealer_id, price_list_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_dealer_price_assignments_dealer
  ON public.bayi_dealer_price_assignments (dealer_id, priority);
CREATE INDEX IF NOT EXISTS idx_bayi_dealer_price_assignments_list
  ON public.bayi_dealer_price_assignments (price_list_id);
CREATE INDEX IF NOT EXISTS idx_bayi_dealer_price_assignments_tenant
  ON public.bayi_dealer_price_assignments (tenant_id);

ALTER TABLE public.bayi_dealer_price_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_price_assignments;
CREATE POLICY "tenant_isolation" ON public.bayi_dealer_price_assignments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );
