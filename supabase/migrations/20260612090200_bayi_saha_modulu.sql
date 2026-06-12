-- Faz 6 — Saha Satış (Field Sales) Modülü
--
-- Dağıtıcı firmaların saha satış elemanlarını (sales rep) yönetmesi:
-- eleman CRUD + atanmış bayiler, ziyaret planı (günlük/haftalık), mobil
-- saha akışı (check-in/out + not + foto + GPS), ziyaret sırasında bayi
-- adına sipariş. Offline destek IndexedDB (client) — server tarafı normal
-- REST. Faz 5 (depo) ile aynı izolasyon/pattern.
--
-- Konsept:
--   bayi_sales_reps        — saha satış elemanı (portal login: user_id → profile)
--   bayi_sales_rep_dealers — eleman × atanmış bayi (M:N)
--   bayi_visit_plans       — planlanmış ziyaret (eleman, bayi, tarih, saat)
--   bayi_visits            — gerçekleşen ziyaret (check-in/out, not, foto, GPS)
--   bayi_visit_orders      — ziyaret × sipariş linki (kim hangi ziyarette sipariş aldı)
--   bayi_orders            — +visit_id (opsiyonel; saha siparişi izi)
--
-- Saha elemanı = profiles satırı role='saha' (portal OTP login için). Eleman
-- oluşturulurken provision edilir (auth user + profile) ya da mevcut profil
-- linklenir. getDagiticiAuth saha rolünü KABUL ETMEZ (admin/user/satis) →
-- saha elemanı dağıtıcı paneline giremez; sadece /tr/saha portalına.

-- ──────────────────────────────────────────────────────────────────────
-- 1) bayi_sales_reps — saha satış elemanı
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_sales_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,                       -- normalized E.164
  region TEXT,
  user_id UUID,                              -- portal login için profiles.id (nullable)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_bayi_sales_reps_tenant
  ON public.bayi_sales_reps (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_sales_reps_user
  ON public.bayi_sales_reps (user_id);
CREATE INDEX IF NOT EXISTS idx_bayi_sales_reps_active
  ON public.bayi_sales_reps (tenant_id, is_active) WHERE is_active = true;

ALTER TABLE public.bayi_sales_reps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_sales_reps;
CREATE POLICY "tenant_isolation" ON public.bayi_sales_reps
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 2) bayi_sales_rep_dealers — eleman × atanmış bayi (M:N)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_sales_rep_dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES public.bayi_sales_reps(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sales_rep_id, dealer_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_rep_dealers_tenant
  ON public.bayi_sales_rep_dealers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_rep_dealers_rep
  ON public.bayi_sales_rep_dealers (sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_bayi_rep_dealers_dealer
  ON public.bayi_sales_rep_dealers (dealer_id);

ALTER TABLE public.bayi_sales_rep_dealers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_sales_rep_dealers;
CREATE POLICY "tenant_isolation" ON public.bayi_sales_rep_dealers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 3) bayi_visit_plans — planlanmış ziyaret
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_visit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES public.bayi_sales_reps(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  planned_time TEXT,                         -- 'HH:MM' opsiyonel
  note TEXT,
  status TEXT NOT NULL DEFAULT 'planned',    -- 'planned' | 'done' | 'skipped'
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayi_visit_plans_tenant
  ON public.bayi_visit_plans (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_visit_plans_rep_date
  ON public.bayi_visit_plans (sales_rep_id, planned_date);

ALTER TABLE public.bayi_visit_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_visit_plans;
CREATE POLICY "tenant_isolation" ON public.bayi_visit_plans
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 4) bayi_visits — gerçekleşen ziyaret (check-in/out + not + foto + GPS)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES public.bayi_sales_reps(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.bayi_visit_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',        -- 'open' | 'completed'
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_at TIMESTAMPTZ,
  gps_lat NUMERIC(9, 6),
  gps_lng NUMERIC(9, 6),
  photo_url TEXT,
  note TEXT,
  -- client-side offline idempotency anahtarı (aynı offline check-in iki kez
  -- senkronlanırsa tek satır olur)
  client_uuid UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_uuid)
);

CREATE INDEX IF NOT EXISTS idx_bayi_visits_tenant
  ON public.bayi_visits (tenant_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayi_visits_rep
  ON public.bayi_visits (sales_rep_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayi_visits_dealer
  ON public.bayi_visits (dealer_id);

ALTER TABLE public.bayi_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_visits;
CREATE POLICY "tenant_isolation" ON public.bayi_visits
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 5) bayi_visit_orders — ziyaret × sipariş linki
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_visit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES public.bayi_visits(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.bayi_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visit_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_bayi_visit_orders_tenant
  ON public.bayi_visit_orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bayi_visit_orders_visit
  ON public.bayi_visit_orders (visit_id);

ALTER TABLE public.bayi_visit_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_visit_orders;
CREATE POLICY "tenant_isolation" ON public.bayi_visit_orders
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- 6) bayi_orders — +visit_id (saha siparişi izi, opsiyonel)
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_orders
  ADD COLUMN IF NOT EXISTS visit_id UUID;

CREATE INDEX IF NOT EXISTS idx_bayi_orders_visit
  ON public.bayi_orders (visit_id);
