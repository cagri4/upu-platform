-- Sprint B-3 İş #4 — Bayi davet statik link
--
-- Dağıtıcı başına evergreen kebab-case slug. /davet/<slug> tıklayan bayi
-- form doldurur (telefon + isim + opsiyonel mağaza), otomatik hesap açılır.
-- Mevcut dynamic invite_code flow ile paralel yaşar — /davet/[code] hem
-- dealer_invitations.invite_code hem distributor_slugs.slug arar.

CREATE TABLE IF NOT EXISTS distributor_slugs (
  slug TEXT PRIMARY KEY,
  distributor_user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_dist_slugs_user ON distributor_slugs(distributor_user_id, tenant_id);
