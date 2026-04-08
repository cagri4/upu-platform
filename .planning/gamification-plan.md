# Gamification & Görev Motoru — Platform Plan

## Vizyon
Duolingo'nun dil öğretme mekanizmasını iş süreçlerine uyarlıyoruz. Kullanıcı sistemi kullandıkça işini daha iyi yapıyor, satışa/sonuca yaklaşıyor. Sistem proaktif olarak kullanıcıyı yönlendiriyor, dead end bırakmıyor.

## Mimari

### Platform Motoru (ortak, tüm SaaS'lar)
- `platform_missions` — misyon tanımları (keşif + iş)
- `user_mission_progress` — kullanıcının misyon ilerlemesi
- `user_daily_tasks` — günlük görevler (veri bazlı, her gece üretilir)
- `user_streaks` — streak takibi
- `user_performance` — haftalık/aylık performans özeti
- Cron: görev üretici (her gece veri tarar, görev üretir)
- Cron: bildirim gönderici (zamanlanmış WhatsApp mesajları)
- Brifing entegrasyonu (günlük görevler brifing'de gösterilir)

### Tenant İçerik Tanımları (her SaaS kendi)
Her tenant bir "görev sözlüğü" tanımlar:
- Keşif misyonları (tek seferlik)
- Tekrarlayan görev kuralları (veri bazlı tetikleyiciler)
- Bildirim şablonları (emoji destekli, motive edici)
- Ana hedef + alt hedef yapısı

---

## İki Katman

### Katman 1 — Keşif (tek seferlik)
Yeni kullanıcı sistemi öğrenir. Her özelliği sırayla keşfeder.
Tamamlanınca "Sistemi tamamen keşfettiniz!" + badge.
Bir daha gösterilmez.

### Katman 2 — İş Döngüsü (hiç bitmez)
Veri bazlı günlük görevler. Her gün yenilenir.
Haftalık performans yıldızı: ⭐⭐⭐⭐☆
Her aksiyon anında sonuç + yeni yönlendirme.

---

## Emlak SaaS — Hedef Ağacı

### 🏆 ANA HEDEF: SATIŞ YAP

#### 🗂 Portföy Sorumlusu → GÜÇLÜ PORTFÖY
Keşif misyonları:
1. İlk mülkü ekle
2. Mülk bilgilerini %100 tamamla
3. Fotoğraf ekle
4. Fiyat kontrolü yap
5. 5 mülk portföyde

Tekrarlayan görevler:
- 30+ gün güncellenmemiş mülk → "Fiyat hala güncel mi?"
- Eksik bilgili mülk → "Bilgileri tamamla"
- Fotoğrafsız mülk → "Fotoğraf ekle"
- Bölgede yeni ilan → "Portföye ekle"

#### 🤝 Satış Destek → MÜŞTERİ HAVUZU
Keşif:
1. İlk müşteri ekle
2. İlk eşleştirme yap
3. İlk sunum gönder
4. İlk takip yap
5. 5 müşteri kayıtlı

Tekrarlayan:
- Eşleşme var sunum yok → "Sunum gönder"
- Sunum gönderilmiş takip yok → "Takip et"
- 7+ gün sessiz müşteri → "İletişime geç"
- Yeni eşleşme oluştu → "İncele"

#### 🎬 Medya Uzmanı → GÖRÜNÜRLÜK
Keşif:
1. İlk fotoğraf yükle
2. İlk sosyal medya paylaşımı
3. İlk ilan yayınla
4. Web sitesi oluştur

Tekrarlayan:
- Fotoğrafsız mülk → "Fotoğraf ekle"
- 2 haftadır paylaşım yok → "Mülkünüzü paylaşın"
- Yeni mülk eklendi → "Yayınla"

#### 📊 Pazar Analisti → DOĞRU FİYAT
Keşif:
1. İlk fiyat sorgusu
2. İlk değerleme
3. Pazar trendi incele
4. Mülk önerisi al

Tekrarlayan:
- Piyasa ortalamasından sapan fiyat → "Fiyat revizyonu öneriyorum"
- Bölgede trend değişimi → "Pazar güncellendi"
- Yeni mülk eklendi → otomatik değerleme

#### 📋 Sekreter → ORGANİZASYON
Keşif:
1. İlk brifing oku
2. İlk hatırlatma oluştur
3. İlk sözleşme hazırla
4. Görev listesi kullan

Tekrarlayan:
- Her sabah → "Brifing'iniz hazır"
- Yaklaşan hatırlatma → "Bugün 2 görüşmeniz var"
- Sözleşme süresi dolacak → "Yenile"

---

## Bayi SaaS — Hedef Ağacı

### 🏆 ANA HEDEF (Firma Sahibi): BAYİ AĞINI BÜYÜT & CİRO ARTIR

#### Asistan → İŞ TAKİBİ
#### Satış Müdürü → KAMPANYA & PERFORMANS  
#### Satış Temsilcisi → SİPARİŞ & ZİYARET
#### Muhasebeci → TAHSİLAT
#### Depocu → STOK OPTİMİZASYONU
#### Ekip Yönetimi → EKİP VERİMLİLİĞİ

### 🏆 ANA HEDEF (Dealer): VERİMLİ SİPARİŞ & STOK YÖNETİMİ
- Kataloğu keşfet → sipariş ver → takip et → tekrar sipariş

---

## Bildirim Şablonları (emoji destekli)

Motive edici:
- "🎯 Harika! Bu hafta 3 sunum gönderdiniz — geçen haftadan %50 fazla!"
- "🔥 Seriniz 7 gün! Devam edin!"
- "⭐ Bu hafta 4/5 yıldız! Bir görev daha ve tam puan!"

Tetikleyici:
- "📢 Bodrum'da 3 yeni ilan çıktı — rakipleriniz aktif!"
- "⏰ Ahmet Bey'e 5 gündür cevap vermediniz. Fırsat kaçmasın!"
- "📉 Mülkünüzün fiyatı piyasanın %15 üstünde — satış zorlaşabilir."

Kutlama:
- "🎉 TEBRİKLER! İlk satışınızı yaptınız! Sistem size yardımcı oldu mu?"
- "🏅 Bu ay 3 satış! En iyi ayınız!"
- "🌟 Portföyünüz %100 tam bilgili — profesyonel görünüyorsunuz!"

---

## Veritabanı

```sql
-- Misyon tanımları (tenant bazlı)
CREATE TABLE platform_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key TEXT NOT NULL, -- emlak, bayi, otel...
  role TEXT DEFAULT 'admin', -- admin, dealer, employee
  category TEXT NOT NULL, -- kesfet, portfoy, musteri, medya...
  mission_key TEXT NOT NULL, -- ilk_mulk, bilgi_tamamla...
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  points INTEGER DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  is_repeatable BOOLEAN DEFAULT false,
  trigger_check TEXT, -- SQL veya fonksiyon adı
  next_mission TEXT, -- tamamlanınca sonraki misyon
  notification_template TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kullanıcı misyon ilerlemesi
CREATE TABLE user_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mission_id UUID REFERENCES platform_missions(id),
  status TEXT DEFAULT 'locked', -- locked, active, completed
  completed_at TIMESTAMPTZ,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Günlük görevler (cron ile üretilir)
CREATE TABLE user_daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_key TEXT NOT NULL,
  task_type TEXT NOT NULL, -- mulk_guncelle, musteri_takip...
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  command TEXT, -- tetikleyecek komut
  entity_id TEXT, -- ilgili mülk/müşteri ID
  points INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending', -- pending, completed, skipped
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Streak
CREATE TABLE user_streaks (
  user_id UUID PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Haftalık performans
CREATE TABLE user_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_key TEXT NOT NULL,
  week_start DATE NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0, -- 1-5
  points_earned INTEGER DEFAULT 0,
  highlights JSONB DEFAULT '{}', -- öne çıkan başarılar
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Uygulama Fazları

### Faz 1 — Altyapı
- [ ] DB tabloları oluştur
- [ ] Misyon tanımlama sistemi
- [ ] Emlak keşif misyonlarını tanımla
- [ ] Misyon ilerleme takibi

### Faz 2 — Keşif Katmanı
- [ ] Yeni kullanıcı girişte keşif başlasın
- [ ] Her komut tamamlandığında misyon kontrolü
- [ ] Tamamlanınca tebrik + sonraki misyon
- [ ] Progress gösterimi (brifing'de)

### Faz 3 — İş Katmanı
- [ ] Görev üretici cron job
- [ ] Veri bazlı görev kuralları (emlak)
- [ ] Günlük görev listesi komutu
- [ ] Görev tamamlama takibi

### Faz 4 — Bildirim Motoru
- [ ] Proaktif WhatsApp mesajları
- [ ] Zamanlama (sabah/öğle/akşam)
- [ ] Streak hatırlatma
- [ ] Performans özeti (haftalık)

### Faz 5 — Diğer SaaS'lar
- [ ] Bayi sahibi görev tanımları
- [ ] Dealer görev tanımları
- [ ] Otel, muhasebe, market görev tanımları
