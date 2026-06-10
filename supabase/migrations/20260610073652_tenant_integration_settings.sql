-- Faz 3 Sprint F — Tenant entegrasyon ayarları
--
-- tenant_integration_settings — dağıtıcının kullandığı dış entegrasyonlar
-- (Logo Tiger, iyzico, Mollie, Foriba/Mikrohizmet e-Fatura, Aras/Yurtiçi/MNG
-- kargo). Her tenant × provider için tek satır (provider başına config).
--
-- secrets jsonb DB-side basit. PostgreSQL `pgcrypto` ile column encryption
-- de yapılabilir; MVP'de RLS + service_role koruması yeterli (secrets
-- yalnız service-side erişilir, API'de redact edilir).

CREATE TABLE IF NOT EXISTS public.tenant_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  -- Non-sensitive config (örn. host/port/firma_kodu/api_url)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Sensitive credentials (API key, secret, password). API GET'te redact edilir.
  secrets JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integration_settings_tenant
  ON public.tenant_integration_settings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integration_settings_active
  ON public.tenant_integration_settings (tenant_id, provider)
  WHERE is_active = true;

ALTER TABLE public.tenant_integration_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.tenant_integration_settings;
CREATE POLICY "tenant_isolation" ON public.tenant_integration_settings
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles
      WHERE auth_user_id = auth.uid() OR id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- bayi_payments → online ödeme provider kolonları (Sprint G prep)
-- Mevcut tablo manuel dekont upload pattern; Mollie/iyzico için
-- provider/provider_payment_id/checkout_url/paid_at kolonları gerek.
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_payments
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.bayi_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bayi_payments_provider_payment_id
  ON public.bayi_payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bayi_payments_order
  ON public.bayi_payments (order_id)
  WHERE order_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- bayi_orders → kargo + fatura kolonları (Sprint H/I prep)
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bayi_orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.bayi_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipment_carrier TEXT,
  ADD COLUMN IF NOT EXISTS shipment_tracking_no TEXT,
  ADD COLUMN IF NOT EXISTS shipment_status TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bayi_orders_invoice
  ON public.bayi_orders (invoice_id)
  WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bayi_orders_tracking
  ON public.bayi_orders (shipment_carrier, shipment_tracking_no)
  WHERE shipment_tracking_no IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bayi_orders_payment_status_check') THEN
    ALTER TABLE public.bayi_orders
      ADD CONSTRAINT bayi_orders_payment_status_check
      CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'pending', 'paid', 'refunded', 'failed'));
  END IF;
END $$;
