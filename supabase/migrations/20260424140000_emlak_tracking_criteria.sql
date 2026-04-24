-- ──────────────────────────────────────────────────────────────────────────
-- emlak_tracking_criteria
-- Kullanıcının her sabah "hangi sahibi ilanları bana gelsin" kriter seti
-- Maksimum 3 mahalle + 3 mülk tipi + 1 ilan tipi + fiyat aralığı
-- Her kullanıcı 1 kriter seti (user_id UNIQUE). Edit → upsert.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS emlak_tracking_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  neighborhoods TEXT[] NOT NULL DEFAULT '{}',   -- max 3 mahalle (ör: ["Yalıkavak", "Bitez", "Turgutreis"])
  property_types TEXT[] NOT NULL DEFAULT '{}',  -- max 3 tip (ör: ["daire", "villa"])
  listing_type TEXT,                             -- satilik / kiralik / NULL (hepsi)
  price_min BIGINT,                              -- NULL = alt sınır yok
  price_max BIGINT,                              -- NULL = üst sınır yok

  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_tracking_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_user ON emlak_tracking_criteria(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_active ON emlak_tracking_criteria(active) WHERE active = TRUE;

-- Enrich alanları artık kullanılmıyor (link-only mimariye geçtik)
-- Sahibinden detay sayfasına gitmiyoruz, IP block riski yok.
-- Kolonları null bırakıyoruz; gelecekte başka amaçla kullanılabilir.
-- ALTER TABLE emlak_daily_leads DROP COLUMN IF EXISTS owner_phone;
-- ALTER TABLE emlak_daily_leads DROP COLUMN IF EXISTS owner_name;
-- ALTER TABLE emlak_daily_leads DROP COLUMN IF EXISTS owner_enriched_at;
