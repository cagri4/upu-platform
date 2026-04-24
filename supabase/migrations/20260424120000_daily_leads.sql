-- ──────────────────────────────────────────────────────────────────────────
-- Daily Leads Feature
-- ──────────────────────────────────────────────────────────────────────────
-- Her sabah yenilenen sahibi ilan havuzu (7 gün rolling window).
-- Eski emlak_properties tablosundaki ~5000 sahibinden kaydı artık buraya
-- taşınıyor, sade amaçlı bir tablo: "bugün aranacak lead'ler".
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS emlak_daily_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_id TEXT NOT NULL,              -- sahibinden ilan id (ör: 1312809960)
  source_url TEXT NOT NULL,
  snapshot_date DATE NOT NULL,          -- hangi günün snapshot'ı

  title TEXT NOT NULL,
  type TEXT NOT NULL,                   -- daire/villa/arsa/...
  listing_type TEXT NOT NULL,           -- satilik/kiralik/devren
  price BIGINT,
  area INT,
  rooms TEXT,                           -- 3+1, 2+1, studyo
  location_city TEXT,
  location_district TEXT,
  location_neighborhood TEXT,
  listing_date DATE,                    -- sahibinden'in yayın tarihi
  image_url TEXT,

  owner_name TEXT,
  owner_phone TEXT,
  owner_enriched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_daily_leads_source_snapshot UNIQUE (source_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_leads_snapshot ON emlak_daily_leads(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_leads_district ON emlak_daily_leads(location_district, location_neighborhood);
CREATE INDEX IF NOT EXISTS idx_daily_leads_type ON emlak_daily_leads(type, listing_type);
CREATE INDEX IF NOT EXISTS idx_daily_leads_owner_enrich ON emlak_daily_leads(owner_enriched_at) WHERE owner_enriched_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- Call log — kullanıcı hangi ilanı arandı
-- source_id FK değil: daily_leads 7 günde döner, calls kalıcıdır.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS emlak_lead_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,

  status TEXT NOT NULL,                 -- called / no_answer / interested / not_interested / listed
  note TEXT,

  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_lead_calls_user_source UNIQUE (user_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_calls_user ON emlak_lead_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_calls_source ON emlak_lead_calls(source_id);
