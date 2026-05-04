-- Müşterinin aradığı listing_type tek seçimden çoklu seçime taşınıyor.
-- looking_for text[] kolonu: 'satilik', 'kiralik' (her ikisi de seçilebilir).
-- Mevcut listing_type kolonu backward-compat amacıyla korunur.

ALTER TABLE emlak_customers
  ADD COLUMN IF NOT EXISTS looking_for text[];

-- Mevcut data backfill: tek seçimli listing_type'tan looking_for array'i türet.
-- 'hepsi' = her ikisi (önceki UI'da var olan değer).
UPDATE emlak_customers
SET looking_for =
  CASE
    WHEN listing_type = 'satilik' THEN ARRAY['satilik']::text[]
    WHEN listing_type = 'kiralik' THEN ARRAY['kiralik']::text[]
    WHEN listing_type = 'hepsi'   THEN ARRAY['satilik','kiralik']::text[]
    ELSE NULL
  END
WHERE looking_for IS NULL;

CREATE INDEX IF NOT EXISTS idx_emlak_customers_looking_for
  ON emlak_customers USING GIN (looking_for);
