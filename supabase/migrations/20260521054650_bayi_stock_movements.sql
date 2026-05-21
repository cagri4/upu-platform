-- Bayi stok hareket log — stock in/out audit trail.
--
-- bayi_products.stock_quantity flat sayı tutuyor; hareket geçmişi yoktu.
-- WA komut sistemi (handleStok, handleKritikStok) kapatıldıktan sonra
-- panel UI'ının hareket geçmişi göstermesi için bu tablo eklendi.
--
-- Movement types:
--   in       — Tedarikçiden geliş, manuel sayım fazlası
--   out      — Sipariş çıkışı, fire/zayiat
--   adjust   — Sayım düzeltmesi (delta, +/- olabilir)
--   supplier_order — Manuel tedarikçi sipariş kaydı (henüz teslim alınmadı,
--                    stock_quantity'i ETKILEMEZ; UI'da "yolda" gösterimi)

CREATE TABLE IF NOT EXISTS public.bayi_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjust', 'supplier_order')),
  quantity NUMERIC(12,3) NOT NULL,    -- pozitif sayı; type alanı yön belirler
  reason TEXT,                        -- "Yeni mal alımı", "Bayi siparişi: ORD-001" vb.
  reference_id UUID,                  -- sipariş_id veya tedarikçi_id (opsiyonel)
  reference_type TEXT,                -- 'order', 'supplier', null
  unit_cost NUMERIC(12,2),            -- giriş için maliyet, raporlama için
  supplier_name TEXT,                 -- supplier_order için
  expected_arrival DATE,              -- supplier_order için
  created_by UUID,                    -- profile.id (kim kaydetti)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_mov_tenant_product
  ON public.bayi_stock_movements(tenant_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product
  ON public.bayi_stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type
  ON public.bayi_stock_movements(tenant_id, movement_type, created_at DESC);

ALTER TABLE public.bayi_stock_movements ENABLE ROW LEVEL SECURITY;
-- INSERT/UPDATE/DELETE sadece service role (panel API'leri).
