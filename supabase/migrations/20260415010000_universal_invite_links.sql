-- Universal invite links table (for ALL tenants)
-- Same structure as bayi_invite_links but tenant-agnostic.
-- bayi_invite_links is NOT dropped for backward compatibility.

CREATE TABLE IF NOT EXISTS invite_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        UNIQUE NOT NULL,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),
  created_by  uuid        REFERENCES auth.users(id),
  role        text        DEFAULT 'admin',
  permissions jsonb       DEFAULT '{}',
  max_uses    int,                              -- NULL = unlimited
  used_count  int         DEFAULT 0,
  is_active   boolean     DEFAULT true,
  expires_at  timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);
-- Index for tenant queries
CREATE INDEX IF NOT EXISTS idx_invite_links_tenant ON invite_links(tenant_id);
