-- Quest State Machine: chapter-based progression with data-driven transitions
-- Replaces linear 11-mission chain with 5-chapter, 34-mission system.

-- ── 1. Add chapter column to platform_missions ─────────────────────
ALTER TABLE platform_missions ADD COLUMN IF NOT EXISTS chapter integer;
ALTER TABLE platform_missions ADD COLUMN IF NOT EXISTS chapter_order integer;

-- ── 2. User quest state table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_quest_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_key text NOT NULL,
  current_chapter integer NOT NULL DEFAULT 1,
  active_mission_key text,  -- current active mission (corridor: only one)
  commands_used text[] NOT NULL DEFAULT '{}',  -- tracks distinct commands used
  chapter_completed_at timestamptz,  -- when current chapter was completed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_key)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_state_user ON user_quest_state(user_id);

-- ── 3. Clear old missions and seed new 34-mission system ───────────

-- Remove old emlak missions
DELETE FROM user_mission_progress
  WHERE mission_id IN (SELECT id FROM platform_missions WHERE tenant_key = 'emlak');
DELETE FROM platform_missions WHERE tenant_key = 'emlak';

-- Seed Chapter 1: Çaylak — Ekibinle Tanış (5 görev)
INSERT INTO platform_missions (tenant_key, role, category, mission_key, title, description, emoji, points, sort_order, is_repeatable, next_mission, employee_key, xp_reward, chapter, chapter_order)
VALUES
('emlak','admin','portfoy','emlak_c1_mulkekle','İlk mülkünüzü ekleyin','İlk mülkünüzü ekleyin — link, detaylı form veya hızlı ekleme','🏠',15,1,false,'emlak_c1_fiyatsor','portfoy',15,1,1),
('emlak','admin','analiz','emlak_c1_fiyatsor','Bölge fiyatını öğrenin','Bölgenizdeki fiyat aralığını öğrenin — min/ort/max ve m² fiyatı','📊',15,2,false,'emlak_c1_brifing','analist',15,1,2),
('emlak','admin','organizasyon','emlak_c1_brifing','Brifinginizi okuyun','Günlük brifinginizi okuyun — mülk, müşteri, hatırlatma özeti','📋',5,3,false,'emlak_c1_paylas','sekreter',5,1,3),
('emlak','admin','medya','emlak_c1_paylas','Mülkünüzü paylaşın','Mülkünüz için Instagram paylaşım metni oluşturun — hashtag''li','📱',10,4,false,'emlak_c1_musteri','medya',10,1,4),
('emlak','admin','musteri','emlak_c1_musteri','İlk müşterinizi ekleyin','İlk müşterinizi kaydedin — isim, bütçe, tercihler. Otomatik eşleşme','🤝',20,5,false,NULL,'satis',20,1,5);

-- Seed Chapter 2: Öğrenci — Araçlarını Kur (9 görev)
INSERT INTO platform_missions (tenant_key, role, category, mission_key, title, description, emoji, points, sort_order, is_repeatable, next_mission, employee_key, xp_reward, chapter, chapter_order)
VALUES
('emlak','admin','portfoy','emlak_c2_mulkduzenle','Mülk bilgilerini tamamlayın','Mülkünüzün eksik bilgilerini tamamlayın — alan, oda, kat, fiyat','📝',15,6,false,'emlak_c2_analiz','portfoy',15,2,1),
('emlak','admin','analiz','emlak_c2_analiz','Pazar durumunu inceleyin','Pazar durumunu inceleyin — toplam ilan sayısı, şehir bazlı dağılım','📊',10,7,false,'emlak_c2_favoriler','analist',10,2,2),
('emlak','admin','organizasyon','emlak_c2_favoriler','Favorilerinizi ayarlayın','En çok kullandığınız komutları favorilere ekleyin — hızlı erişim','⭐',5,8,false,'emlak_c2_fotograf','sekreter',5,2,3),
('emlak','admin','medya','emlak_c2_fotograf','Fotoğraf ekleyin','Mülkünüze WhatsApp''tan fotoğraf gönderin — telefondan direkt yükleyin','📸',15,9,false,'emlak_c2_eslestir','medya',15,2,4),
('emlak','admin','musteri','emlak_c2_eslestir','Müşteri eşleştirin','Müşterinizi mülklerle eşleştirin — bütçe, lokasyon, tip uyumu puanlanır','🤝',20,10,false,'emlak_c2_tara','satis',20,2,5),
('emlak','admin','portfoy','emlak_c2_tara','Linkten mülk çekin','Sahibinden/Hepsiemlak linkini yapıştırın — mülk otomatik portföyünüze eklensin','🔗',15,11,false,'emlak_c2_webpanel','portfoy',15,2,6),
('emlak','admin','analiz','emlak_c2_webpanel','Web paneline girin','Web paneline giriş yapın — 15 dk geçerli magic link ile büyük ekrandan bakın','🖥',5,12,false,'emlak_c2_gorevler','analist',5,2,7),
('emlak','admin','organizasyon','emlak_c2_gorevler','Görevlerinizi kontrol edin','Bekleyen hatırlatmalarınızı kontrol edin — bugün ne yapmanız gerekiyor?','📋',5,13,false,'emlak_c2_uzanti','sekreter',5,2,8),
('emlak','admin','medya','emlak_c2_uzanti','Chrome uzantısını kurun','Chrome uzantısını kurun — WhatsApp''ta hazırladığınız mülkleri Sahibinden''e yükleyin','🔌',10,14,false,NULL,'medya',10,2,9);

-- Seed Chapter 3: Pratisyen — İlk Satış Döngüsü (7 görev)
INSERT INTO platform_missions (tenant_key, role, category, mission_key, title, description, emoji, points, sort_order, is_repeatable, next_mission, employee_key, xp_reward, chapter, chapter_order)
VALUES
('emlak','admin','portfoy','emlak_c3_mulkyonet','Mülk yönetim panelini kullanın','Mülk yönetim panelini kullanın — düzenle, durum değiştir, AI açıklama yazdır','🏠',15,15,false,'emlak_c3_degerle','portfoy',15,3,1),
('emlak','admin','analiz','emlak_c3_degerle','Piyasa değerini öğrenin','Mülkünüzün piyasa değerini öğrenin — benzer ilanlarla karşılaştırma ve AI analizi','💰',15,16,false,'emlak_c3_hatirlatma','analist',15,3,2),
('emlak','admin','organizasyon','emlak_c3_hatirlatma','Hatırlatma kurun','İlk hatırlatmanızı kurun — ev gezdirme, telefon veya teklif için tarih seçin','⏰',15,17,false,'emlak_c3_yayinla','sekreter',15,3,3),
('emlak','admin','medya','emlak_c3_yayinla','Yayın hazırlığını kontrol edin','Mülklerin yayın hazırlığını kontrol edin — eksik bilgileri görün, portala yükleyin','📡',15,18,false,'emlak_c3_sunum','medya',15,3,4),
('emlak','admin','musteri','emlak_c3_sunum','Sunum hazırlayın','Müşterinize özel sunum hazırlayın — mülk seçin, AI kişiselleştirsin, magic link gönderin','🎯',25,19,false,'emlak_c3_takip','satis',25,3,5),
('emlak','admin','musteri','emlak_c3_takip','Piyasa takibi kurun','Piyasa takibi kurun — tip, bütçe, bölge belirleyin, her sabah yeni ilanlar bildirilsin','📡',25,20,false,'emlak_c3_trend','satis',25,3,6),
('emlak','admin','analiz','emlak_c3_trend','Pazar trendini inceleyin','Pazar trendini inceleyin — tip dağılımı, ortalama fiyatlar, son 7 günün hareketi','📈',10,21,false,NULL,'analist',10,3,7);

-- Seed Chapter 4: Profesyonel — Büyüt ve Optimize Et (7 görev)
INSERT INTO platform_missions (tenant_key, role, category, mission_key, title, description, emoji, points, sort_order, is_repeatable, next_mission, employee_key, xp_reward, chapter, chapter_order)
VALUES
('emlak','admin','portfoy','emlak_c4_mulkekle2','Portföyünüzü büyütün','Portföyünüzü 3 mülke çıkarın — 15-25 ilan arası ideal','🏠',15,22,false,'emlak_c4_mulkoner','portfoy',15,4,1),
('emlak','admin','analiz','emlak_c4_mulkoner','Mülk önerisi alın','Müşterinizin bütçesine göre mülk önerisi alın — uygun ve esnetilebilir sonuçlar','💡',15,23,false,'emlak_c4_sozlesme','analist',15,4,2),
('emlak','admin','organizasyon','emlak_c4_sozlesme','Sözleşme hazırlayın','Yetkilendirme sözleşmesi hazırlayın — sahibi bilgileri, komisyon, süre, imza linki','📄',25,24,false,'emlak_c4_websitem','sekreter',25,4,3),
('emlak','admin','medya','emlak_c4_websitem','Web sitenizi oluşturun','Profesyonel web sitenizi oluşturun — isim, slogan, bio, tema seçin, AI yardımcı','🌐',10,25,false,'emlak_c4_musteri2','medya',10,4,4),
('emlak','admin','musteri','emlak_c4_musteri2','2. müşterinizi ekleyin','2. müşterinizi ekleyin — satışların %82''si müşteri ağından, ağınızı büyütün','🤝',20,26,false,'emlak_c4_satistavsiye','satis',20,4,5),
('emlak','admin','musteri','emlak_c4_satistavsiye','Satış stratejisi alın','Mülkünüz için AI satış stratejisi alın — fiyatlama, pazarlama önerileri','📋',15,27,false,'emlak_c4_rapor','satis',15,4,6),
('emlak','admin','analiz','emlak_c4_rapor','Aylık raporunuzu görün','Aylık raporunuzu görün — mülk, müşteri, sözleşme özeti','📊',10,28,false,NULL,'analist',10,4,7);

-- Seed Chapter 5: Uzman — Ağını Genişlet (6 görev)
INSERT INTO platform_missions (tenant_key, role, category, mission_key, title, description, emoji, points, sort_order, is_repeatable, next_mission, employee_key, xp_reward, chapter, chapter_order)
VALUES
('emlak','admin','musteri','emlak_c5_ortakpazar','Ortak pazara katılın','Mülklerinizi diğer danışmanlarla paylaşın — ağınızı büyütün, gelen ilanları görün','🏪',20,29,false,'emlak_c5_eslestir2','satis',20,5,1),
('emlak','admin','musteri','emlak_c5_eslestir2','Yeni eşleştirme yapın','Yeni müşterinizi eşleştirin — satışların %80''i 5-12. temasta kapanıyor','🤝',20,30,false,'emlak_c5_hediyeler','satis',20,5,2),
('emlak','admin','organizasyon','emlak_c5_hediyeler','Kampanyaları kontrol edin','Aktif kampanyaları kontrol edin — müşterilerinize özel fırsatlar sunun','🎁',5,31,false,'emlak_c5_websitem2','sekreter',5,5,3),
('emlak','admin','medya','emlak_c5_websitem2','Web sitenizi kontrol edin','Web sitenizi kontrol edin — eksik var mı? Müşterinize linkini gönderin','🌐',10,32,false,'emlak_c5_sunum2','medya',10,5,4),
('emlak','admin','musteri','emlak_c5_sunum2','2. sunumunuzu hazırlayın','2. sunumunuzu hazırlayın — üst düzey danışmanlar haftada 2-4 sunum yapıyor','🎯',25,33,false,'emlak_c5_portfoyum','satis',25,5,5),
('emlak','admin','portfoy','emlak_c5_portfoyum','Portföyünüzü gözden geçirin','Portföyünüzü gözden geçirin — üst düzey danışmanlar her gün portföy kontrolü yapar','📊',5,34,false,NULL,'portfoy',5,5,6);
