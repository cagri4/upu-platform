-- Faz C — 3.7 Referans Programı (Bayi → Bayi Davet)
--
-- referral_codes: bayinin paylaşılabilir davet kodu (unique).
-- referrals: davet → kabul → ilk sipariş ledger.
-- dealer_credits: bayinin biriken kredi bakiyesi.
-- credit_movements: ledger (debit/credit kayıt — referans, kullanım, expire).

CREATE TABLE IF NOT EXISTS public.bayi_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 100.00,
  reward_currency TEXT NOT NULL DEFAULT 'TRY',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_dealer ON public.bayi_referral_codes(dealer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_tenant_active ON public.bayi_referral_codes(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS public.bayi_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_dealer_id UUID NOT NULL,
  referred_dealer_id UUID,
  referred_phone TEXT,
  referred_name TEXT,
  code_id UUID REFERENCES public.bayi_referral_codes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','earned','expired','rejected')),
  reward_amount NUMERIC(12,2),
  reward_currency TEXT DEFAULT 'TRY',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  earned_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  first_order_id UUID,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.bayi_referrals(referrer_dealer_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.bayi_referrals(referred_dealer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_tenant ON public.bayi_referrals(tenant_id, status, invited_at DESC);

CREATE TABLE IF NOT EXISTS public.bayi_dealer_credits (
  dealer_user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  lifetime_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_used NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dealer_credits_tenant ON public.bayi_dealer_credits(tenant_id);

CREATE TABLE IF NOT EXISTS public.bayi_credit_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_user_id UUID NOT NULL,
  delta NUMERIC(12,2) NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('referral_earn','order_apply','manual_adjust','expire')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);
CREATE INDEX IF NOT EXISTS idx_credit_mov_dealer ON public.bayi_credit_movements(dealer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_mov_tenant ON public.bayi_credit_movements(tenant_id, created_at DESC);
