-- ──────────────────────────────────────────────────────────────────────────
-- emlak_tracking_criteria — multi-row migration (2026-05-08)
--
-- Önceki: user başına UPSERT (UNIQUE constraint), tek kriter seti.
-- Şimdi:  her kullanıcı birden fazla takip kriteri tanımlayabilir,
--         her birine isim verebilir, ayrı ayrı durdurup düzenleyebilir.
--
-- Alanlar:
--   - name TEXT (kullanıcının verdiği etiket — örn "Yalıkavak villa kiralık")
--   - active BOOLEAN ZATEN VAR (önceden tanımlı — Durdur/Aktif toggle için kullanılır)
--
-- Geri uyumluluk: Mevcut single-row kayıtlar bu migrasyonla otomatik isim alır
-- ("İlk takibim") ve aktif durumda kalır.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. UNIQUE (user_id) constraint kaldır — multi-row açılır
ALTER TABLE emlak_tracking_criteria
  DROP CONSTRAINT IF EXISTS uq_tracking_user;

-- 2. name kolonu ekle (mevcut row'lara default ata)
ALTER TABLE emlak_tracking_criteria
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'İlk takibim';

-- Mevcut rows için anlamlı isim üret (lokasyon/tip varsa)
UPDATE emlak_tracking_criteria
SET name = COALESCE(
  NULLIF(
    CONCAT_WS(' ',
      NULLIF(array_to_string(neighborhoods, ', '), ''),
      CASE WHEN listing_type = 'kiralik' THEN 'kiralık'
           WHEN listing_type = 'satilik' THEN 'satılık'
           ELSE NULL END
    ),
    ''
  ),
  'İlk takibim'
)
WHERE name = 'İlk takibim';

-- 3. Index — kullanıcının takipleri sıralanmış görüntülensin
CREATE INDEX IF NOT EXISTS idx_tracking_user_created
  ON emlak_tracking_criteria(user_id, created_at DESC);

-- 4. (Opsiyonel) Per-user max takip limiti — uygulama tarafında kontrol edilir,
-- DB seviyesinde constraint koymadık. Önerilen: kullanıcı başına max 5 takip.
