-- Portföy Büyütme: sahibinden ilanlarının detay sayfalarından çekilecek
-- iletişim bilgileri için sütunlar. Scraper enrich script'i doldurur.
ALTER TABLE emlak_properties ADD COLUMN IF NOT EXISTS owner_phone text;
ALTER TABLE emlak_properties ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE emlak_properties ADD COLUMN IF NOT EXISTS owner_enriched_at timestamptz;

-- "İlgilendim" aksiyonları için tracking (aramalı, mesajlı olanlar)
CREATE TABLE IF NOT EXISTS emlak_contact_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  property_id uuid NOT NULL,
  action_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emlak_contact_actions_user ON emlak_contact_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emlak_contact_actions_prop ON emlak_contact_actions(property_id);
