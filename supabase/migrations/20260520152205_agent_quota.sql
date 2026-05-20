-- UPU AGENT QUOTA SİSTEMİ
-- 3 tablo: agent_plans (config) + agent_quotas (per-user monthly) + agent_usage_events (detail log)
-- Hem bayi hem emlak için aynı yapı (tenant_id ile izole).

-- Plan tier tanımları (config table)
CREATE TABLE IF NOT EXISTS agent_plans (
  key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  monthly_message_limit INTEGER NOT NULL,
  monthly_price_eur NUMERIC(8,2),
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO agent_plans (key, display_name, monthly_message_limit, monthly_price_eur) VALUES
  ('free',     'Deneme',        50,    0),
  ('starter',  'Başlangıç',    300,   99),
  ('pro',      'Profesyonel', 1500,  199),
  ('premium',  'Premium',     5000,  399)
ON CONFLICT (key) DO NOTHING;

-- Kullanıcı başına aylık quota (PRIMARY KEY user_id + period_start sayesinde
-- bir kullanıcı geçmiş periyotları da görebilir; aktif satır period_end > now())
CREATE TABLE IF NOT EXISTS agent_quotas (
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plan_key TEXT NOT NULL DEFAULT 'free' REFERENCES agent_plans(key),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  used_messages INTEGER NOT NULL DEFAULT 0,
  used_input_tokens BIGINT NOT NULL DEFAULT 0,
  used_output_tokens BIGINT NOT NULL DEFAULT 0,
  cache_read_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_quotas_user ON agent_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_quotas_period_end ON agent_quotas(period_end);
CREATE INDEX IF NOT EXISTS idx_quotas_tenant ON agent_quotas(tenant_id);

-- Power user transparency için detay log
CREATE TABLE IF NOT EXISTS agent_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  tool_calls TEXT[],
  model TEXT NOT NULL,
  cost_usd NUMERIC(10,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON agent_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_created ON agent_usage_events(tenant_id, created_at DESC);
