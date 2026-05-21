-- Faz C — 3.6 Marketing Automation (Drip + Segment)
--
-- Drip = zamana yayılmış mesaj dizileri. Trigger (3.4) anlık tek mesaj, drip
-- N-step delay'li dizi. Audience JSONB = segment kriterleri.

CREATE TABLE IF NOT EXISTS public.bayi_drip_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email','both')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  enrollment_mode TEXT NOT NULL DEFAULT 'manual' CHECK (enrollment_mode IN ('manual','auto','one_time')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);
CREATE INDEX IF NOT EXISTS idx_drip_camp_tenant_active ON public.bayi_drip_campaigns(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS public.bayi_drip_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.bayi_drip_campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  subject TEXT,
  body TEXT NOT NULL,
  send_condition JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign ON public.bayi_drip_steps(campaign_id, step_order);

CREATE TABLE IF NOT EXISTS public.bayi_drip_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.bayi_drip_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  dealer_user_id UUID NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled','failed')),
  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (campaign_id, dealer_user_id)
);
CREATE INDEX IF NOT EXISTS idx_drip_enrol_next ON public.bayi_drip_enrollments(status, next_send_at);
CREATE INDEX IF NOT EXISTS idx_drip_enrol_dealer ON public.bayi_drip_enrollments(dealer_user_id);

CREATE TABLE IF NOT EXISTS public.bayi_drip_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.bayi_drip_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.bayi_drip_steps(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_drip_sends_enrol ON public.bayi_drip_sends(enrollment_id, sent_at DESC);
