-- Bayi onboarding wizard — profile-level state.
--
-- Multi-tenant: profiles tablosunda her tenant için ayrı row vardır.
-- onboarding state per-profile (her tenant'a ait profilde bağımsız akar).
-- Yatay yapı: aynı kolonlar diğer 5 SaaS adapter'ında da kullanılır.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_incomplete
  ON public.profiles(tenant_id)
  WHERE onboarding_completed = false;
