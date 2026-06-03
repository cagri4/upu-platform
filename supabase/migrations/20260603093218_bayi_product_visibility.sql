-- Bayi-spesifik ürün görünürlüğü (#109)
--
-- Sorun: Tüm bayiler tüm ürünleri görüyordu. Çoğu B2B distribütör SaaS'ta
-- bayi başına SKU gizleme zorunlu (sözleşme, rakipler, bölgesel
-- kısıtlama, deneme bayisi vb).
--
-- Strateji: opt-out. Row yoksa → görünür (default davranış korunur).
-- Admin bir ürünü bir bayiye saklamak istediğinde visible=false ile satır
-- ekler. UNIQUE (dealer_id, product_id) ile çift kayıt engellenir.

CREATE TABLE IF NOT EXISTS public.bayi_product_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.bayi_products(id) ON DELETE CASCADE,
  visible BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id UUID,
  UNIQUE (dealer_id, product_id)
);

-- Hot path: bayi list endpoint'inden "bu dealer için hangi ürünler hidden"
-- sorgusu — dealer_id + visible=false.
CREATE INDEX IF NOT EXISTS idx_product_visibility_dealer_hidden
  ON public.bayi_product_visibility (dealer_id, product_id)
  WHERE visible = false;

CREATE INDEX IF NOT EXISTS idx_product_visibility_product
  ON public.bayi_product_visibility (product_id);

CREATE INDEX IF NOT EXISTS idx_product_visibility_tenant
  ON public.bayi_product_visibility (tenant_id);

ALTER TABLE public.bayi_product_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_product_visibility;
CREATE POLICY "tenant_isolation" ON public.bayi_product_visibility
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
       WHERE auth_user_id = auth.uid()
          OR id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
       WHERE auth_user_id = auth.uid()
          OR id = auth.uid()
    )
  );
