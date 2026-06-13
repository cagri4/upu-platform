-- ──────────────────────────────────────────────────────────────────────────
-- Otel Booking Engine + Web Sitesi — Faz 2
-- ──────────────────────────────────────────────────────────────────────────
-- 2026-06-13 · Plan ref: .planning/OTEL-SAAS-UCTAN-UCA-PLAN.md (FAZ 2)
--
-- Adds:
--   - otel_hotels.slug         — public URL identifier (örn: caretta-pansiyon)
--   - otel_hotels.public_settings JSONB
--                                — hero_title, hero_subtitle, gallery_urls[],
--                                  description, address, contact (phone/email),
--                                  amenities[], policies (checkin_time, kvkk_text),
--                                  show_on_web (boolean, default false)
--   - otel_hotels.web_published BOOLEAN — quick flag (slug + show_on_web)
--   - slug unique constraint
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE otel_hotels
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE otel_hotels
  ADD COLUMN IF NOT EXISTS public_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE otel_hotels
  ADD COLUMN IF NOT EXISTS web_published BOOLEAN NOT NULL DEFAULT FALSE;

-- otel_reservations.notes — booking talebinde misafirin notu / email / guests
ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- otel_reservations.guest_email — direkt web booking için
ALTER TABLE otel_reservations
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

-- Slug unique (NULL'lar düşer)
CREATE UNIQUE INDEX IF NOT EXISTS uq_otel_hotels_slug
  ON otel_hotels(LOWER(slug)) WHERE slug IS NOT NULL AND slug <> '';

-- Slug formatı: kebab-case, sadece alfanumerik+tire
ALTER TABLE otel_hotels
  DROP CONSTRAINT IF EXISTS otel_hotels_slug_format;
ALTER TABLE otel_hotels
  ADD CONSTRAINT otel_hotels_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Public read: yayınlanmış otelleri herkes okusun (anon kullanıcı için)
-- Bunu service-role bypass eder; anon role için ayrı policy
DO $$
BEGIN
  CREATE POLICY otel_hotels_public_read ON otel_hotels
    FOR SELECT
    USING (web_published = TRUE AND slug IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE POLICY otel_rooms_public_read ON otel_rooms
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM otel_hotels h
        WHERE h.id = otel_rooms.hotel_id AND h.web_published = TRUE
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
