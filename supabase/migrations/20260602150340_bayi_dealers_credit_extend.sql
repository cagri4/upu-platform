-- Bayi dealers extend — credit_limit + finansal alanlar (2026-06-02)
--
-- Planning migration (.planning/migrations/2026-05-04-bayi-dealers-extend.sql)
-- production'a uygulanmamıştı. Birçok endpoint (`bayiler/[id]`,
-- `bayi-kullanicilar/list`, demo seed) bu kolonları zaten SELECT/INSERT
-- ediyordu → silent fail. Bu migration audit'in #106 (kredi limiti
-- enforcement) için zorunlu prerequisite.
--
-- Hepsi ADD COLUMN IF NOT EXISTS — production data kaybı yok.

-- ── İletişim & adres ─────────────────────────────────────────────────
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS address_line TEXT;

-- ── Vergi & banka ────────────────────────────────────────────────────
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS tax_number TEXT;
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS tax_office TEXT;
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS iban TEXT;

-- ── Finansal sözleşme ────────────────────────────────────────────────
-- credit_limit NULL = limitsiz (eski davranış); NUMERIC = bayi'nin
-- maksimum açık bakiye + sipariş tutarı tavanı.
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2);
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS payment_term_days INTEGER;
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5, 2);

-- ── Risk & etiket ────────────────────────────────────────────────────
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS risk_status TEXT DEFAULT 'clean';
ALTER TABLE public.bayi_dealers ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- ── Index ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bayi_dealers_risk_status ON public.bayi_dealers (risk_status);
CREATE INDEX IF NOT EXISTS idx_bayi_dealers_tags ON public.bayi_dealers USING GIN (tags);

-- ── Audit log (kredi limiti değişiklikleri) ──────────────────────────
-- Her UPDATE sonrası satır → kim ne zaman ne değiştirdi.
CREATE TABLE IF NOT EXISTS public.bayi_credit_limit_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.bayi_dealers(id) ON DELETE CASCADE,
  changed_by_user_id UUID,
  old_limit NUMERIC(14, 2),
  new_limit NUMERIC(14, 2),
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_audit_dealer ON public.bayi_credit_limit_audit (dealer_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_audit_tenant ON public.bayi_credit_limit_audit (tenant_id, changed_at DESC);

ALTER TABLE public.bayi_credit_limit_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_credit_limit_audit;
CREATE POLICY "tenant_isolation" ON public.bayi_credit_limit_audit
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
