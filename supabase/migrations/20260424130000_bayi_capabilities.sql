-- Phase 1 — UPU pivot foundation
--
-- Capability-based permissions. Replaces the legacy "8 virtual employees"
-- model: every user (owner, employee, dealer) sees one UPU assistant and a
-- menu filtered by their capabilities.
--
-- "*" = wildcard (owner default = full access).
-- Non-owners get specific capability strings (e.g. "orders:create",
-- "finance:balance-own"). Dealer preset + employee invite flow populate
-- this column later.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] NOT NULL DEFAULT '{}';

-- Seed: every existing bayi-tenant profile is an owner right now (no
-- employee/dealer onboarding exists in production yet), so grant wildcard.
UPDATE profiles
SET capabilities = ARRAY['*']
WHERE tenant_id IN (
  SELECT id FROM tenants WHERE saas_type = 'bayi'
)
AND capabilities = '{}';

-- Index for membership lookups (hasCapability lookups + push fan-out)
CREATE INDEX IF NOT EXISTS idx_profiles_capabilities ON profiles USING GIN (capabilities);
