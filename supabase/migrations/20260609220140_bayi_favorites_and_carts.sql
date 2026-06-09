-- Faz 2 Sprint B/C — bayi tarafı favori + sepet kalıcılığı
--
--   bayi_favorites   alıcının kalp attığı ürünler
--   bayi_carts       açık sepet (her bayi×kullanıcı için tek aktif)
--   bayi_cart_items  sepet satırları
--
-- Tüm tablolar RLS + tenant_isolation pattern.

-- ──────────────────────────────────────────────────────────────────────
-- 1) bayi_favorites
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_favorites_user
  ON public.bayi_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_bayi_favorites_dealer
  ON public.bayi_favorites (dealer_id);
CREATE INDEX IF NOT EXISTS idx_bayi_favorites_tenant
  ON public.bayi_favorites (tenant_id);

ALTER TABLE public.bayi_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_favorites;
CREATE POLICY "tenant_isolation" ON public.bayi_favorites
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 2) bayi_carts — açık sepet (alıcı başına 1 tane)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checked_out', 'abandoned')),
  coupon_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bayi × user başına tek 'open' sepet
CREATE UNIQUE INDEX IF NOT EXISTS uq_bayi_carts_open_per_user
  ON public.bayi_carts (user_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_bayi_carts_tenant
  ON public.bayi_carts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_carts_dealer
  ON public.bayi_carts (dealer_id);

ALTER TABLE public.bayi_carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_carts;
CREATE POLICY "tenant_isolation" ON public.bayi_carts
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 3) bayi_cart_items — sepet satırları
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cart_id UUID NOT NULL REFERENCES public.bayi_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_cart_items_cart
  ON public.bayi_cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_bayi_cart_items_product
  ON public.bayi_cart_items (product_id);
CREATE INDEX IF NOT EXISTS idx_bayi_cart_items_tenant
  ON public.bayi_cart_items (tenant_id);

ALTER TABLE public.bayi_cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_cart_items;
CREATE POLICY "tenant_isolation" ON public.bayi_cart_items
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );
