-- Faz B — 3.3 Cross-sell + 3.4 Otomatik Kampanya + 3.8 Aktif Öneri Motoru.
--
-- Tek migration tüm faz tablolarını ekler — Vercel cron her birine ayrı
-- schedule alır (recommendations saatlik, cross-sell günlük, kampanya saatlik).
--
-- Tüm tablolar additive, IF NOT EXISTS (CLAUDE.md kuralı).

-- ────────────────────────────────────────────────────────────────────────
-- 3.3 Cross-sell pairs (item-item co-occurrence)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayi_cross_sell_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_a_id UUID NOT NULL,
  product_b_id UUID NOT NULL,
  co_occurrence_count INTEGER NOT NULL DEFAULT 0,
  dealer_count INTEGER NOT NULL DEFAULT 0,   -- kaç farklı bayi A+B birlikte aldı
  score NUMERIC(6,3) NOT NULL DEFAULT 0,     -- log-weighted co-occurrence
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, product_a_id, product_b_id)
);

CREATE INDEX IF NOT EXISTS idx_cross_sell_a ON public.bayi_cross_sell_pairs(tenant_id, product_a_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_cross_sell_b ON public.bayi_cross_sell_pairs(tenant_id, product_b_id, score DESC);

-- ────────────────────────────────────────────────────────────────────────
-- 3.4 Otomatik Kampanya tetikleyicileri
-- ────────────────────────────────────────────────────────────────────────
-- event_type: 'orderless_n_days' / 'overdue_days' / 'score_below' /
--             'new_product' / 'birthday' (placeholder, ileride)
-- action_type: 'wa_message' (sendNotification freeform) / 'coupon_mint'
--              (gelecek faz) / 'admin_alert' (sadece admin'e push)
CREATE TABLE IF NOT EXISTS public.bayi_campaign_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,   -- ör: {"days": 30, "min_orders_prev": 1}
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  cooldown_days INTEGER NOT NULL DEFAULT 30,       -- aynı bayi×rule tekrarı için
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camp_triggers_tenant_active
  ON public.bayi_campaign_triggers(tenant_id, is_active, last_run_at);

-- Execution log — idempotency için (aynı bayi × rule × cooldown içinde tekrar yok)
CREATE TABLE IF NOT EXISTS public.bayi_campaign_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES public.bayi_campaign_triggers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealer_id UUID,
  target_user_id UUID,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL,             -- 'sent' | 'failed' | 'skipped' | 'dry_run'
  payload_snapshot JSONB,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_camp_exec_trigger_dealer
  ON public.bayi_campaign_executions(trigger_id, dealer_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_camp_exec_tenant
  ON public.bayi_campaign_executions(tenant_id, executed_at DESC);

-- ────────────────────────────────────────────────────────────────────────
-- 3.8 Aktif Öneri Motoru (yatay — tüm SaaS'larda aynı engine)
-- ────────────────────────────────────────────────────────────────────────
-- recommendation_rules: config tablosu, her tenant kendi kurallarını
-- adapter'da hardcoded listeden insert eder. Cron evaluate eder.
CREATE TABLE IF NOT EXISTS public.recommendation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key TEXT NOT NULL,               -- 'bayi' / 'emlak' / vb.
  code TEXT NOT NULL,                     -- 'inactive_dealers' / 'critical_stock' / 'quota_nearing' ...
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  action_type TEXT NOT NULL,              -- 'wa_broadcast' / 'navigate' / 'create_order' / 'mint_coupon' / 'upgrade_plan'
  action_payload JSONB DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'normal',-- 'low' / 'normal' / 'high'
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_key, code)
);

-- recommendation_runs: gerçek üretilen öneriler — kullanıcı görür, act/dismiss eder.
CREATE TABLE IF NOT EXISTS public.recommendation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rule_code TEXT NOT NULL,
  title TEXT NOT NULL,                    -- rendered (template + payload)
  body TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB DEFAULT '{}'::jsonb,
  target_ids JSONB,                       -- ['dealer1', 'dealer2', ...] vb.
  severity TEXT NOT NULL DEFAULT 'normal',
  score NUMERIC(6,2) NOT NULL DEFAULT 0,  -- recency × impact × actionability
  status TEXT NOT NULL DEFAULT 'open',    -- 'open' / 'acted' / 'dismissed' / 'expired'
  acted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_runs_user_open
  ON public.recommendation_runs(user_id, status, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_runs_tenant_rule
  ON public.recommendation_runs(tenant_id, rule_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_runs_expires
  ON public.recommendation_runs(expires_at)
  WHERE status = 'open';

-- RLS — runs kullanıcı kendi satırlarını okur/günceller.
ALTER TABLE public.recommendation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_recs" ON public.recommendation_runs;
CREATE POLICY "users_read_own_recs" ON public.recommendation_runs FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users_update_own_recs" ON public.recommendation_runs;
CREATE POLICY "users_update_own_recs" ON public.recommendation_runs FOR UPDATE
  USING (user_id = auth.uid());
-- Insert sadece service role.

ALTER TABLE public.bayi_cross_sell_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bayi_campaign_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bayi_campaign_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_rules ENABLE ROW LEVEL SECURITY;
