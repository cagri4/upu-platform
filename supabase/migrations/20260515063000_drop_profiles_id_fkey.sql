-- Hotfix: drop profiles_id_fkey to allow profile.id != auth.users.id
-- Required for multi-tenant identity (1 auth.user → N profile per tenant)
-- Without this drop, profile.id with fresh UUID fails FK to auth.users.id
BEGIN;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
COMMIT;
