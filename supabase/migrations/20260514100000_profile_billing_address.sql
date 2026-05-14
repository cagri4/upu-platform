-- Faz 7.1b — Mollie ödeme sonrası fatura adresi senkronu.
--
-- Mollie webhook'unda payment.billingAddress (varsa) profiles.billing_address
-- jsonb alanına yazılır. Manuel düzenleme ileride panel-ayarları üzerinden
-- mümkün olabilir; şu an salt webhook tarafından doldurulur.
--
-- Idempotent — ALTER TABLE ADD COLUMN IF NOT EXISTS güvenli.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_address jsonb;
