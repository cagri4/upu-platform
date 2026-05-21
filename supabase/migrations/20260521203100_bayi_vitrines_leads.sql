-- Faz C — 3.5 Online Vitrin + Lead Form Widget
--
-- bayi_vitrines: her bayinin public mini-katalog konfigürasyonu (slug, tema).
-- bayi_leads: vitrinden gelen sipariş talepleri; bayi onayladıkça
-- bayi_dealer_orders'a dönüşür.

CREATE TABLE IF NOT EXISTS public.bayi_vitrines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT,
  subtitle TEXT,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#4f46e5',
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_prices BOOLEAN NOT NULL DEFAULT true,
  visible_product_ids JSONB,
  theme JSONB DEFAULT '{}'::jsonb,
  view_count INTEGER NOT NULL DEFAULT 0,
  lead_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bayi_vitrines_dealer ON public.bayi_vitrines(dealer_user_id);
CREATE INDEX IF NOT EXISTS idx_bayi_vitrines_tenant_active ON public.bayi_vitrines(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS public.bayi_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_user_id UUID NOT NULL,
  vitrine_id UUID REFERENCES public.bayi_vitrines(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_message TEXT,
  items JSONB,
  est_total NUMERIC(12,2),
  currency TEXT DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','rejected','expired')),
  source TEXT DEFAULT 'vitrine',
  converted_order_id UUID,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_bayi_leads_dealer_status ON public.bayi_leads(dealer_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayi_leads_tenant_created ON public.bayi_leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bayi_leads_vitrine ON public.bayi_leads(vitrine_id);

ALTER TABLE public.bayi_vitrines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bayi_leads ENABLE ROW LEVEL SECURITY;

-- Vitrin public okuma (yalnız is_active=true).
DROP POLICY IF EXISTS bayi_vitrines_public_read ON public.bayi_vitrines;
CREATE POLICY bayi_vitrines_public_read ON public.bayi_vitrines
  FOR SELECT
  USING (is_active = true);

-- Lead anonim insert (vitrine_id+slug match yeterli; service role tarafından
-- gerçekleştirilir, RLS sade).
DROP POLICY IF EXISTS bayi_leads_anon_insert ON public.bayi_leads;
CREATE POLICY bayi_leads_anon_insert ON public.bayi_leads
  FOR INSERT
  WITH CHECK (true);

-- Bayi kendi lead'lerini okur.
DROP POLICY IF EXISTS bayi_leads_owner_read ON public.bayi_leads;
CREATE POLICY bayi_leads_owner_read ON public.bayi_leads
  FOR SELECT
  USING (
    dealer_user_id IN (
      SELECT p.id FROM profiles p WHERE p.auth_user_id = auth.uid()
    )
  );
