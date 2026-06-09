-- Faz 1.3 — Kampanya + Sipariş Onay Akışı
--
-- bayi_campaigns + bayi_orders + bayi_order_items zaten mevcut (basit
-- şemada). Bu migration onlara eksik kolonları ekler + 3 yeni tablo:
--   bayi_campaign_targets        kampanya hedefleme (all/segment/region/dealer)
--   bayi_campaign_rules          kural detay (tip + jsonb params)
--   bayi_order_status_history    audit log
--
-- bayi_campaign_triggers + bayi_campaign_executions DOKUNULMADI; onlar
-- event-bazlı drip-marketing motorudur (Faz 0'da flag arkasına alındı).

-- ──────────────────────────────────────────────────────────────────────
-- 1) bayi_campaigns — eksik kolonlar
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_campaigns ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE public.bayi_campaigns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.bayi_campaigns ADD COLUMN IF NOT EXISTS max_usage INTEGER;
ALTER TABLE public.bayi_campaigns ADD COLUMN IF NOT EXISTS per_dealer_max_usage INTEGER;
ALTER TABLE public.bayi_campaigns ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.bayi_campaigns ADD COLUMN IF NOT EXISTS created_by_profile_id UUID;

-- type enum kontrolü (5 tip)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bayi_campaigns_type_check') THEN
    ALTER TABLE public.bayi_campaigns
      ADD CONSTRAINT bayi_campaigns_type_check
      CHECK ("type" IS NULL OR "type" IN
        ('percent_discount', 'volume_discount', 'coupon', 'gift_product', 'free_shipping'));
  END IF;
END $$;

-- status enum kontrolü
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bayi_campaigns_status_check') THEN
    ALTER TABLE public.bayi_campaigns
      ADD CONSTRAINT bayi_campaigns_status_check
      CHECK (status IN ('draft', 'active', 'paused', 'ended'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bayi_campaigns_tenant_status
  ON public.bayi_campaigns (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bayi_campaigns_coupon
  ON public.bayi_campaigns (tenant_id, coupon_code)
  WHERE coupon_code IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 2) bayi_campaign_targets — hedefleme
--    target_type: all (target_value NULL) / segment ("A") / region ("Marmara") / dealer (uuid)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.bayi_campaigns(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'segment', 'region', 'dealer')),
  target_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_campaign_targets_campaign
  ON public.bayi_campaign_targets (campaign_id);
CREATE INDEX IF NOT EXISTS idx_bayi_campaign_targets_tenant
  ON public.bayi_campaign_targets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_campaign_targets_dealer_lookup
  ON public.bayi_campaign_targets (target_type, target_value);

ALTER TABLE public.bayi_campaign_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_campaign_targets;
CREATE POLICY "tenant_isolation" ON public.bayi_campaign_targets
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 3) bayi_campaign_rules — kural detay (params jsonb)
--   percent_discount: { discount_percent: 10, applies_to: "all"|"category:<id>"|"product:<id>" }
--   volume_discount:  { buy: 30, free: 5, applies_to: "product:<id>" }
--   coupon:           { discount_percent: 15 } (kod bayi_campaigns.coupon_code'da)
--   gift_product:     { min_total: 1000, gift_product_id: "<uuid>", gift_quantity: 1 }
--   free_shipping:    { min_total: 500 }
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_campaign_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.bayi_campaigns(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_campaign_rules_campaign
  ON public.bayi_campaign_rules (campaign_id);
CREATE INDEX IF NOT EXISTS idx_bayi_campaign_rules_tenant
  ON public.bayi_campaign_rules (tenant_id);

ALTER TABLE public.bayi_campaign_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_campaign_rules;
CREATE POLICY "tenant_isolation" ON public.bayi_campaign_rules
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 4) bayi_orders — onay akışı kolonları
--    Mevcut status_id (FK lookup) korunur; ek text status alanı hot-path
--    query'leri için. approved_at/rejected_at/reject_reason audit dahil
--    snapshot.
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.bayi_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.bayi_orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.bayi_orders ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE public.bayi_orders ADD COLUMN IF NOT EXISTS approved_by_profile_id UUID;
ALTER TABLE public.bayi_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bayi_orders_status_check') THEN
    ALTER TABLE public.bayi_orders
      ADD CONSTRAINT bayi_orders_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'preparing', 'shipped', 'delivered', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bayi_orders_tenant_status
  ON public.bayi_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bayi_orders_dealer_created
  ON public.bayi_orders (dealer_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────
-- 5) bayi_order_items — kampanya/iskonto izlemesi
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_order_items ADD COLUMN IF NOT EXISTS line_discount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.bayi_order_items ADD COLUMN IF NOT EXISTS campaign_id UUID
  REFERENCES public.bayi_campaigns(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 6) bayi_order_status_history — audit log
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.bayi_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_profile_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_order_status_history_order
  ON public.bayi_order_status_history (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayi_order_status_history_tenant
  ON public.bayi_order_status_history (tenant_id);

ALTER TABLE public.bayi_order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_order_status_history;
CREATE POLICY "tenant_isolation" ON public.bayi_order_status_history
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 7) bayi_order_statuses — sistem seed (idempotent, code unique değil)
--    Bayi_orders.status text kolonunu kullanıyoruz; bu lookup tablosu
--    UI label'ları için (statusName) kullanılır.
-- ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN
    SELECT * FROM (VALUES
      ('pending', 'Bekliyor', 10),
      ('approved', 'Onaylandı', 20),
      ('rejected', 'Reddedildi', 30),
      ('preparing', 'Hazırlanıyor', 40),
      ('shipped', 'Kargoda', 50),
      ('delivered', 'Teslim edildi', 60),
      ('cancelled', 'İptal', 70)
    ) AS t(code, name, display_order)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.bayi_order_statuses WHERE code = s.code) THEN
      INSERT INTO public.bayi_order_statuses (code, name, display_order)
      VALUES (s.code, s.name, s.display_order);
    END IF;
  END LOOP;
END $$;
