-- ──────────────────────────────────────────────────────────────────────────
-- emlak_tracking_criteria — multi-row migration (2026-05-08)
--
-- Önceki: user başına UPSERT (UNIQUE constraint), tek kriter seti.
-- Şimdi:  her kullanıcı birden fazla takip kriteri tanımlayabilir,
--         her birine isim verebilir, ayrı ayrı durdurup düzenleyebilir.
--
-- Eklenen:
--   - name TEXT (kullanıcının verdiği etiket — örn "Yalıkavak villa kiralık")
--   - status TEXT (kullanıcı talebi: "active" / "paused" — active boolean ile mirror)
--
-- Korunan: id UUID PK (gen_random_uuid), active BOOLEAN (kod hala bunu kullanıyor)
-- Kaldırılan: uq_tracking_user UNIQUE (user_id) — multi-row açılır
--
-- Geri uyumluluk: Mevcut single-row kayıtlar bu migrasyonla otomatik isim alır
-- ("İlk takibim" veya lokasyon+tip'ten üretilen) ve aktif durumda kalır.
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

-- 3. status kolonu ekle (active boolean ile mirror)
ALTER TABLE emlak_tracking_criteria
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Mevcut rows: active=true → 'active', active=false → 'paused'
UPDATE emlak_tracking_criteria
SET status = CASE WHEN active THEN 'active' ELSE 'paused' END
WHERE status = 'active' AND active = false;

-- Constraint: status sadece active veya paused
ALTER TABLE emlak_tracking_criteria
  DROP CONSTRAINT IF EXISTS chk_tracking_status;
ALTER TABLE emlak_tracking_criteria
  ADD CONSTRAINT chk_tracking_status
  CHECK (status IN ('active', 'paused'));

-- 4. Index — kullanıcının takipleri sıralanmış görüntülensin
CREATE INDEX IF NOT EXISTS idx_tracking_user_created
  ON emlak_tracking_criteria(user_id, created_at DESC);

-- 5. (Opsiyonel) Per-user max takip limiti — uygulama tarafında kontrol edilir,
-- DB seviyesinde constraint koymadık. Önerilen: kullanıcı başına max 5 takip.

-- ──────────────────────────────────────────────────────────────────────────
-- Doğrulama sorguları (bu script'in altında değil, manuel kontrol için):
--
--   -- Kolonlar:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'emlak_tracking_criteria';
--
--   -- UNIQUE constraint kalktı mı?
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'emlak_tracking_criteria'::regclass;
--   -- (uq_tracking_user listede OLMAMALI)
--
--   -- Mevcut row'lar:
--   SELECT id, user_id, name, status, active, neighborhoods, listing_type
--   FROM emlak_tracking_criteria
--   ORDER BY created_at DESC LIMIT 10;
-- ──────────────────────────────────────────────────────────────────────────
