-- Migration: bayi_dealers genişletme — 2026-05-04
-- Bayi detay paneli için Logo/Exact entegrasyonundan çekilebilecek alanlar.
-- Demo modda sektör seed dataset'ten doldurulur.
--
-- Çalıştırma: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run
-- Geri alma: aşağıdaki ROLLBACK bloğu var.

-- ── İletişim & adres ─────────────────────────────────────────────────
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS address_line TEXT;

-- ── Vergi & banka ────────────────────────────────────────────────────
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS tax_number TEXT;
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS tax_office TEXT;
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS iban TEXT;

-- ── Finansal sözleşme ────────────────────────────────────────────────
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2);
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS payment_term_days INTEGER;
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5, 2);
  -- 0-100 arası yüzde; 12.50 = %12.5 sürekli iskonto.

-- ── Risk & etiket ────────────────────────────────────────────────────
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS risk_status TEXT DEFAULT 'clean';
  -- enum: 'clean' | 'watch' | 'blacklist' (text, app-side validate)
ALTER TABLE bayi_dealers ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
  -- string[] — örn: ['VIP'], ['kritik'], ['yeni'], ['kurumsal']

-- ── Index ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bayi_dealers_risk_status ON bayi_dealers (risk_status);
CREATE INDEX IF NOT EXISTS idx_bayi_dealers_tags ON bayi_dealers USING GIN (tags);

-- ── Doğrulama ───────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'bayi_dealers' ORDER BY ordinal_position;

-- ── ROLLBACK (gerekirse) ─────────────────────────────────────────────
-- ALTER TABLE bayi_dealers
--   DROP COLUMN IF EXISTS email,
--   DROP COLUMN IF EXISTS address_line,
--   DROP COLUMN IF EXISTS tax_number,
--   DROP COLUMN IF EXISTS tax_office,
--   DROP COLUMN IF EXISTS iban,
--   DROP COLUMN IF EXISTS credit_limit,
--   DROP COLUMN IF EXISTS payment_term_days,
--   DROP COLUMN IF EXISTS discount_rate,
--   DROP COLUMN IF EXISTS risk_status,
--   DROP COLUMN IF EXISTS tags;
-- DROP INDEX IF EXISTS idx_bayi_dealers_risk_status;
-- DROP INDEX IF EXISTS idx_bayi_dealers_tags;
