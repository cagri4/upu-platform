-- ──────────────────────────────────────────────────────────────────────────
-- Restoran Sprint 3 — QR menü + çoklu dil + upsell + samimi greeting
-- ──────────────────────────────────────────────────────────────────────────
-- ALTER mevcut (additive):
--   rst_restaurants  + enabled_languages, default_language, menu_greeting
--   rst_menu_items   + translations, upsell_ids
--   rst_menu_categories + translations
--
-- rst_tables.qr_token Sprint 2'de eklendi, dokunulmuyor.
-- rst_table_calls Sprint 2'de oluşturuldu (garson çağır + hesap iste için).
--
-- translations jsonb formatı:
--   { "en": { "name": "Adana Kebab", "description": "Spicy minced lamb..." },
--     "nl": { "name": "Adana Kebab", "description": "Pittige lamsgehakt..." } }
--   Default dil (tr genelde) kolonun kendi name/description'ında — translations
--   sadece ek diller için.
--
-- enabled_languages text[] — restoran'ın aktif dilleri ('tr','nl','en','fr','de','it')
-- default_language — public sayfada başlangıç dili
--
-- menu_greeting — QR menü üstünde gösterilen samimi karşılama
--   ("Hoş geldiniz! Bugün size ne ikram edelim?")
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE rst_restaurants
  ADD COLUMN IF NOT EXISTS enabled_languages TEXT[] NOT NULL DEFAULT ARRAY['tr','nl','en'],
  ADD COLUMN IF NOT EXISTS default_language TEXT NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS menu_greeting TEXT;

ALTER TABLE rst_menu_items
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS upsell_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE rst_menu_categories
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- default_language enabled_languages içinde mi? — DB-level kontrol şart değil,
-- API'de validate edilir.

-- enabled_languages valid değerleri: 6 dil whitelist
-- (CHECK constraint enabled_languages array elements kontrolü için trigger
-- gerekir; basit tutalım, API katmanında validate)
