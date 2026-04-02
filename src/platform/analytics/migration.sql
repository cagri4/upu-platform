-- Platform Events — analytics & tracking table
CREATE TABLE IF NOT EXISTS platform_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,        -- 'command', 'error', 'onboarding', 'session', 'agent', 'login', 'signup'
  event_name text NOT NULL,        -- 'portfoyum', 'mulkekle_step_2', 'onboarding_complete', etc.
  user_id uuid,
  tenant_id uuid,
  tenant_key text,
  phone text,
  metadata jsonb DEFAULT '{}',     -- flexible extra data
  success boolean DEFAULT true,
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_type ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pe_user ON platform_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pe_tenant ON platform_events(tenant_key);
CREATE INDEX IF NOT EXISTS idx_pe_created ON platform_events(created_at);
