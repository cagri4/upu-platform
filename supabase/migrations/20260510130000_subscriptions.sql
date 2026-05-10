-- Subscriptions schema additive — mevcut tablo provider-agnostic
-- (payment_provider, provider_customer_id, provider_subscription_id) zaten
-- vardı. Bu migration eksik kolonları ve indexleri ekler, RLS açar,
-- trial backfill yapar.
--
-- Tier semantik (bu repoda):
-- plan='trial' + trial_ends_at>now() → effective Pro
-- plan in ('pro_monthly','pro_yearly') + status='active' → Pro
-- diğer her şey → Free

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_subs_status
  ON public.subscriptions(status, current_period_end);

CREATE INDEX IF NOT EXISTS idx_subs_trial
  ON public.subscriptions(plan, trial_ends_at)
  WHERE plan = 'trial';

CREATE INDEX IF NOT EXISTS idx_subs_provider_sub
  ON public.subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own" ON public.subscriptions;
CREATE POLICY "users_read_own"
  ON public.subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Insert/update sadece service role (signup hook + Mollie webhook + cron).

-- updated_at trigger — generic helper varsa kullan, yoksa oluştur
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subs_updated_at ON public.subscriptions;
CREATE TRIGGER subs_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_updated_at();

-- Backfill 1: Trial başlayıp trial_ends_at NULL olan satırlara 14 gün ekle
-- (tipik: existing trial rows created_at + 14 gün)
UPDATE public.subscriptions
SET trial_ends_at = created_at + interval '14 days'
WHERE plan = 'trial' AND trial_ends_at IS NULL;

-- Backfill 2: Subscription kaydı olmayan profiller için trial başlat
INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at)
SELECT id, 'trial', 'active', now() + interval '14 days'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id
);
