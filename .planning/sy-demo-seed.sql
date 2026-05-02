-- ═══════════════════════════════════════════════════════════════
-- SiteYönetim DEMO SEED — bugünkü müşteri görüşmesi için
-- ═══════════════════════════════════════════════════════════════
--
-- Çalıştırma sırası:
--
-- 1) Yönetici (gösterimi yapacak telefon) UPU bot'a "merhaba" yazsın.
--    → Onboarding 4 sorudan geçer → sy_buildings'e manager_id ile bina
--    eklenir. Bina adı: "Yeşilköy Sitesi A Blok" gir, daire: 31-50,
--    aidat: 1500, brifing: evet.
--
-- 2) Aşağıdaki YONETICI_USER_ID'yi gerçek profile id ile değiştir.
--    Supabase dashboard → SQL editör:
--      SELECT id, display_name, whatsapp_phone FROM profiles
--      WHERE whatsapp_phone = '<yöneticinin TR formatında numarası>';
--
-- 3) Bu dosyayı Supabase SQL editörde yapıştır + Run.
--    (CLAUDE.md "Never modify user data without permission" politikası
--    gereği bu insert'leri Claude değil sen elle çalıştırırsın.)
--
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  YONETICI_USER_ID uuid := '<BURAYA_YONETICI_PROFILE_ID>';   -- ← değiştir
  TENANT_ID        uuid := 'c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e';
  bid              uuid;
  uid              uuid;
  rid              uuid;
BEGIN
  -- Yöneticinin onboarding'de yarattığı binayı bul
  SELECT id INTO bid
  FROM sy_buildings
  WHERE manager_id = YONETICI_USER_ID
    AND tenant_id  = TENANT_ID
  LIMIT 1;

  IF bid IS NULL THEN
    RAISE EXCEPTION 'Yönetici için bina bulunamadı. Önce WhatsApp''tan onboarding''i tamamla.';
  END IF;

  -- ─── Önceki demo verisini sil (idempotent çalışsın) ───
  DELETE FROM sy_dues_ledger        WHERE building_id = bid;
  DELETE FROM sy_maintenance_tickets WHERE building_id = bid;
  DELETE FROM sy_income_expenses    WHERE building_id = bid;
  DELETE FROM sy_residents          WHERE building_id = bid;
  DELETE FROM sy_units              WHERE building_id = bid;

  -- ─── 20 daire (5 kat × 4 daire) ─────────────────────
  INSERT INTO sy_units (id, building_id, unit_number) VALUES
    (gen_random_uuid(), bid, '1A'),
    (gen_random_uuid(), bid, '1B'),
    (gen_random_uuid(), bid, '1C'),
    (gen_random_uuid(), bid, '1D'),
    (gen_random_uuid(), bid, '2A'),
    (gen_random_uuid(), bid, '2B'),
    (gen_random_uuid(), bid, '2C'),
    (gen_random_uuid(), bid, '2D'),
    (gen_random_uuid(), bid, '3A'),
    (gen_random_uuid(), bid, '3B'),
    (gen_random_uuid(), bid, '3C'),
    (gen_random_uuid(), bid, '3D'),
    (gen_random_uuid(), bid, '4A'),
    (gen_random_uuid(), bid, '4B'),
    (gen_random_uuid(), bid, '4C'),
    (gen_random_uuid(), bid, '4D'),
    (gen_random_uuid(), bid, '5A'),
    (gen_random_uuid(), bid, '5B'),
    (gen_random_uuid(), bid, '5C'),
    (gen_random_uuid(), bid, '5D');

  -- ─── 18 sakin (2 daire boş) ─────────────────────────
  -- Telefonlar gerçek dışı → /duyuru broadcast hiçbir gerçek
  -- numaraya gitmez (905XX prefix'i dummy).
  INSERT INTO sy_residents (id, building_id, unit_id, name, phone, is_active)
  SELECT
    gen_random_uuid(), bid, u.id, n.name, n.phone, true
  FROM (
    VALUES
      ('1A', 'Mehmet Yılmaz',     '905001000001'),
      ('1B', 'Ayşe Demir',        '905001000002'),
      ('1C', 'Fatma Kaya',        '905001000003'),
      ('1D', 'Hüseyin Çelik',     '905001000004'),
      ('2A', 'Zeynep Şahin',      '905001000005'),
      ('2B', 'Mustafa Aydın',     '905001000006'),
      ('2C', 'Elif Öztürk',       '905001000007'),
      ('2D', 'Ahmet Kara',        '905001000008'),
      ('3A', 'Hatice Arslan',     '905001000009'),
      ('3B', 'İbrahim Doğan',     '905001000010'),
      ('3C', 'Hayriye Kılıç',     '905001000011'),
      ('3D', 'Osman Aslan',       '905001000012'),
      ('4A', 'Emine Polat',       '905001000013'),
      ('4B', 'Yusuf Yıldız',      '905001000014'),
      ('4C', 'Sevim Aksoy',       '905001000015'),
      ('5A', 'Ali Korkmaz',       '905001000016'),
      ('5B', 'Selma Erdoğan',     '905001000017'),
      ('5D', 'Murat Çetin',       '905001000018')
      -- 4D ve 5C boş
  ) AS n(unit_label, name, phone)
  JOIN sy_units u ON u.building_id = bid AND u.unit_number = n.unit_label;

  -- ─── Aidat ledger — son 3 ay (Şubat/Mart/Nisan 2026) ───
  -- Tutarlar kurus cinsinden (1500 TL = 150000 kurus)
  -- Şubat: hepsi ödendi
  -- Mart:  16/18 ödendi (2 daire borçlu)
  -- Nisan: 11/18 ödendi (7 daire borçlu, vadesi yeni geçti)

  -- Şubat 2026 — hepsi ödendi
  INSERT INTO sy_dues_ledger
    (id, building_id, unit_id, period, amount, paid_amount, is_paid, late_charge_kurus, created_at)
  SELECT
    gen_random_uuid(), bid, u.id, '2026-02', 150000, 150000, true, 0, '2026-02-01'
  FROM sy_units u
  WHERE u.building_id = bid
    AND u.unit_number IN (SELECT DISTINCT u2.unit_number
                          FROM sy_units u2
                          JOIN sy_residents r ON r.unit_id = u2.id
                          WHERE u2.building_id = bid);

  -- Mart 2026 — 16/18 ödendi (1A ve 4B borçlu)
  INSERT INTO sy_dues_ledger
    (id, building_id, unit_id, period, amount, paid_amount, is_paid, late_charge_kurus, created_at)
  SELECT
    gen_random_uuid(), bid, u.id, '2026-03',
    150000,
    CASE WHEN u.unit_number IN ('1A','4B') THEN 0 ELSE 150000 END,
    CASE WHEN u.unit_number IN ('1A','4B') THEN false ELSE true END,
    CASE WHEN u.unit_number IN ('1A','4B') THEN 7500 ELSE 0 END,  -- 75 TL gecikme
    '2026-03-01'
  FROM sy_units u
  JOIN sy_residents r ON r.unit_id = u.id
  WHERE u.building_id = bid;

  -- Nisan 2026 — 11/18 ödendi
  INSERT INTO sy_dues_ledger
    (id, building_id, unit_id, period, amount, paid_amount, is_paid, late_charge_kurus, created_at)
  SELECT
    gen_random_uuid(), bid, u.id, '2026-04',
    150000,
    CASE WHEN u.unit_number IN ('1A','1C','2B','3A','3D','4B','5A') THEN 0 ELSE 150000 END,
    CASE WHEN u.unit_number IN ('1A','1C','2B','3A','3D','4B','5A') THEN false ELSE true END,
    CASE WHEN u.unit_number IN ('1A','4B') THEN 1500 ELSE 0 END,  -- 15 TL gecikme (yeni)
    '2026-04-01'
  FROM sy_units u
  JOIN sy_residents r ON r.unit_id = u.id
  WHERE u.building_id = bid;

  -- ─── 3 açık arıza ─────────────────────────────────────
  INSERT INTO sy_maintenance_tickets
    (id, building_id, unit_id, reported_by_user_id, category, priority, description, status, created_at)
  VALUES
    (gen_random_uuid(), bid, NULL, YONETICI_USER_ID,
     'asansor', 'acil',
     'Sağ asansör 3. katta takılıyor, kapı tam kapanmıyor. Bugün servis gelecek.',
     'acik', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), bid,
     (SELECT id FROM sy_units WHERE building_id = bid AND unit_number = '2C' LIMIT 1),
     YONETICI_USER_ID,
     'su', 'normal',
     'Daire 2C banyodan su kaçıyor, alt daireye sızıyor.',
     'acik', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), bid, NULL, YONETICI_USER_ID,
     'elektrik', 'acil',
     'B blok merdiven aydınlatması çalışmıyor, akşam karanlık.',
     'acik', NOW() - INTERVAL '6 hours');

  -- ─── Gelir-gider hareketleri ─────────────────────────
  INSERT INTO sy_income_expenses
    (id, building_id, type, category, description, amount_kurus, period, created_at)
  VALUES
    (gen_random_uuid(), bid, 'income',  'aidat',     'Şubat 2026 aidat tahsilatı',          2700000, '2026-02', '2026-02-15'),
    (gen_random_uuid(), bid, 'income',  'aidat',     'Mart 2026 aidat tahsilatı',           2400000, '2026-03', '2026-03-15'),
    (gen_random_uuid(), bid, 'income',  'aidat',     'Nisan 2026 aidat tahsilatı (kısmi)',  1650000, '2026-04', '2026-04-20'),
    (gen_random_uuid(), bid, 'expense', 'temizlik',  'Genel temizlik personeli maaşı',       450000, '2026-04', '2026-04-05'),
    (gen_random_uuid(), bid, 'expense', 'elektrik',  'Ortak alan elektrik faturası',          85000, '2026-04', '2026-04-12'),
    (gen_random_uuid(), bid, 'expense', 'asansor',   'Asansör yıllık bakım sözleşmesi',      120000, '2026-03', '2026-03-20'),
    (gen_random_uuid(), bid, 'expense', 'guvenlik',  'Güvenlik kamerası onarımı',             65000, '2026-04', '2026-04-25'),
    (gen_random_uuid(), bid, 'expense', 'su',        'Ortak alan su faturası',                32000, '2026-04', '2026-04-18');

  RAISE NOTICE 'DEMO SEED OK — Bina: %, Daire: 20, Sakin: 18, Aidat dönemi: 3', bid;
END $$;
