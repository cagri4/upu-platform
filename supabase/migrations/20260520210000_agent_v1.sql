-- UPU AI Eleman V1 — Bayi tenant için kişisel AI asistan.
--
-- Karakter "UPU". Anthropic API (Sonnet 4.6 + Haiku 4.5 fallback) + 5
-- tool catalog (orders/kpi/cari/overdue/send). Sağ alt floating widget +
-- chat slide-in. V1 reactive only — proactive sabah özeti V2.

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content JSONB NOT NULL,
  tool_use_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_conv_user
  ON agent_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conv_tenant
  ON agent_conversations(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_profiles (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name TEXT,
  custom_prompt TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
