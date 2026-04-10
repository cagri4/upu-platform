# Meta-Progression Sistemi — Sanal Eleman Kariyer Yönetimi

**Statü:** Plan aşaması — onay bekleniyor
**Bağlam:** Gamification altyapısı (mission, streak, daily task) hazır. Üstüne kariyer/rütbe/puan sistemini inşa ediyoruz.
**Çıkış noktası:** "Kullancı emlak ofisinin patronudur, 5 sanal elemanını yetiştirir, onlar da kullancıya yardım eder" — management sim + RPG job system.

---

## 1. Vizyon

### Narrative framing

Kullancı bir "Emlak Ofisi Patronu". 5 sanal çalışanı var:
- **Portföy Sorumlusu** — mülk ekleme, düzenleme, foto, yönetim
- **Satış Destek** — müşteri, eşleştirme, sunum, takip
- **Pazar Analisti** — analiz, trend, rapor, değerleme
- **Sekreter** — brifing, takvim, organizasyon
- **Medya Uzmanı** — paylaş, yayınla, içerik

Her eleman kullancı kullandıkça **yetişir**. Yetiştikçe **kademe atlar** (Stajyer → Junior → Senior → Expert → Master). Daha fazla görev tamamlar = daha yetenekli eleman.

Kullancı da kendi başına **Emlak Danışmanı rütbesi** taşır. Tüm elemanlarının gelişim toplamı, kullancıyı sıralar (Stajyer EDm → Junior EDm → … → Master EDm).

**Meta-hedef:** "Elemanlarına görev yaptır, yeteneklerini artır, seni hedefine ulaştırsınlar."

### Temel ilke

Gamification sadece puan değil — **sen bir ofis yönetiyorsun**. Oyun içindeki her eylem, bir elemanın kariyerini etkiler. Bu narrative işi anlamlı yapar (sadece puan farming değil, çalışanlarını büyütme hissi).

---

## 2. Mevcut Durum

| Bileşen | Statü |
|---|---|
| Platform mission/streak/task altyapısı | ✅ çalışıyor |
| 11 emlak discovery mission (Katman 1) | ✅ seed'li |
| Daily task üretimi (cron) | ✅ çalışıyor |
| Weekly performans yıldızı | ✅ çalışıyor |
| XP popup + HUD + CTA buttonlar | ✅ çalışıyor |
| Inactivity nudge | ✅ çalışıyor |
| **Eleman kavramı** | ❌ yok (missionlar "role: admin" altında karışık) |
| **Kademe sistemi** | ❌ yok |
| **Puan ekonomisi** | ❌ yok |
| **Kullancı meta rütbesi** | ❌ yok |
| **Cross-employee combo görevler** | ❌ yok |
| **Leaderboard** | ❌ yok |

Platform infra hazır. Üstüne meta-progression inşa edeceğiz.

---

## 3. Tasarım

### 3.1 İki katmanlı progression

**Katman A — Her eleman için ayrı kademe:**
```
Portföy Sorumlusu:  Stajyer → Junior → Senior → Expert → Master
Satış Destek:       Stajyer → Junior → Senior → Expert → Master
Pazar Analisti:     Stajyer → Junior → Senior → Expert → Master
Sekreter:           Stajyer → Junior → Senior → Expert → Master
Medya Uzmanı:       Stajyer → Junior → Senior → Expert → Master
```

Her elemanın kendi **XP havuzu** vardır. Görevler tamamlanınca ilgili elemana XP eklenir. Belirli eşiği aşınca o eleman bir kademe yükselir.

**Her eleman için 5 kademe → 25 rozet + ödül noktası**.

**Katman B — Kullancının kendi Emlak Danışmanı rütbesi:**
```
Stajyer EDm → Junior EDm → Senior EDm → Expert EDm → Master EDm
```

Kullancı rütbesi, **5 elemanın kademelerinin toplamından** hesaplanır.

**Örnek hesap:**
- Portföy: Senior (3), Satış: Junior (2), Analist: Stajyer (1), Sekreter: Stajyer (1), Medya: Stajyer (1)
- Toplam: 3+2+1+1+1 = 8 kademe puanı
- Eşikler: 0-4 → Stajyer EDm, 5-9 → Junior EDm, 10-14 → Senior EDm, 15-19 → Expert EDm, 20-25 → Master EDm
- Bu kullancı: 8 puan → **Junior EDm**

Bu iki katman birlikte çalışır. Kullancı hem tek elemanda derinleşebilir (FFXIV'de bir job'ı maxlamak gibi) hem tüm elemanları dengelice geliştirebilir.

### 3.2 Eleman XP Kaynakları

| Aksiyon | XP | Notlar |
|---|---|---|
| Daily task tamamla | 5-15 | Task'ın zorluğuna göre |
| Discovery mission tamamla | 20-40 | Mission'ın zorluğuna göre |
| Haftalık 5/5 yıldız | 100 | Hafta sonu bonus |
| Streak milestone 7 gün | 50 | Tüm elemanlara paylaştır |
| Streak milestone 30 gün | 300 | Büyük bonus |
| Cross-employee combo görev | 50 + bonus | İki eleman birden yükselir |
| Kademe atla | 500 | Bir sonraki seviye için "sermaye" |

**Rate limit:** Günlük max 200 XP (spam önleme, denge için).

### 3.3 Kademe Eşikleri

Örnek bir eleman için:

| Kademe | XP eşik |
|---|---|
| Stajyer | 0 |
| Junior | 100 |
| Senior | 300 |
| Expert | 600 |
| Master | 1000 |

Toplam Master olmak için ~1000 XP gerek. Günde 50 XP kazanılıyorsa 20 gün. Beş eleman × 20 gün = 100 gün. **3+ aylık engagement döngüsü**.

Bu aslında **"oyun ömrü"** — Duolingo'da "Super Hearts" gibi.

### 3.4 Daily/Weekly/Monthly Loops — Her Eleman için

Mevcut daily_tasks sistemi her mission'ı tek tip olarak üretiyor. Yeni sistemde her eleman kendi ritmini alır:

**Portföy Sorumlusu:**
- Günlük: "1 mülk güncelle" (+5 XP)
- Haftalık: "5 yeni mülk ekle" (+50 XP)
- Aylık: "Portföyün %80'inde bilgi tamamı" (+150 XP)

**Satış Destek:**
- Günlük: "3 müşteri ile iletişim" (+10 XP)
- Haftalık: "2 sunum hazırla ve gönder" (+60 XP)
- Aylık: "1 satış/kira kapat" (+250 XP)

**Pazar Analisti:**
- Günlük: "Günlük trend oku" (+5 XP)
- Haftalık: "Bölge analizi yap" (+40 XP)
- Aylık: "Rakip karşılaştırması" (+100 XP)

**Sekreter:**
- Günlük: "Sabah brifingi oku" (+5 XP)
- Haftalık: "Takvimini kontrol et" (+30 XP)
- Aylık: "Aylık özet raporu" (+80 XP)

**Medya Uzmanı:**
- Günlük: "1 sosyal medya paylaşımı" (+10 XP)
- Haftalık: "3 mülkü paylaş" (+50 XP)
- Aylık: "Özel kampanya paylaşımı" (+120 XP)

Bu sayede kullancı her gün farklı elemanlarla çalışmak için motivasyon bulur.

### 3.5 Seasonal / Aylık Events

Emlak sektörünün gerçek döngüleri vardır. Sezonluk event sistemi:

| Dönem | Event | Tetikleyici |
|---|---|---|
| Haziran-Ağustos | **Yazlık Sezonu** | "Bodrum/Çeşme/Alaçatı yazlık odaklı portföy" — ekstra XP rotasyon |
| Eylül | **Öğrenci Evi Sezonu** | "Stüdyo/1+1 kiralık" öneri — Satış Destek için bonus |
| Ocak | **Yılbaşı Satış İvmesi** | "İndirimli ilan" kampanyası — Medya Uzmanı için event |
| Mart-Nisan | **Bahar Satış Tazeleme** | "Fotoğraflarını güncelle" — Portföy Sorumlusu için yenileme |

Cron tabanlı: her ayın 1'inde aktif event belirlenir, kullancıya bildirilir, o dönemde özel mission'lar ve daily task'lar eklenir.

**Başlangıçta: en az 1 sezon** (yazlık) yapılır, zamanla büyür.

### 3.6 Cross-Employee Combo Görevler

Bazı görevler **iki elemanın birlikte kullanılmasını** ister:

- **"Data-driven Social"**: Analist → bölge trendi çıkar, sonra Medya → o veriyi social post'a dök → ikisine de 30 XP + combo bonus 20 XP
- **"Profesyonel Sunum"**: Portföy → mülk bilgi tamamla, sonra Satış Destek → sunum oluştur → ikisine de 25 XP + combo 15 XP

Bu combo görevler **oyunun zirve noktası**, yüksek kademelerde açılır. Düşük kademelerde tek eleman görevleri yeter.

### 3.7 Leaderboard

**Global sıralama:** Emlak Danışmanı rütbesi ve toplam XP'ye göre kullancılar sıralanır.

**Filtreler:**
- Bölge (Bodrum / İstanbul / Ankara)
- Tenant ofisi (aynı şirketteki danışmanlar kendi aralarında)
- Zaman (Tüm Zamanlar / Bu Ay / Bu Hafta)

**Görünüm:** `/leaderboard` komutuyla açılır. İlk 10 ve kullancının sırası gösterilir.

**Opsiyonel social:** Başka danışmanların profiline tıklayıp rozetlerini görmek (gelecek aşama).

### 3.8 Narrative / UI Katmanı

**"Ekibim" komutu** — `/ekibim` yazınca:

```
🏢 ABC Emlak Ofisi
👤 Patron: Çağrı Yılmaz (Junior Emlak Danışmanı ⭐⭐)

───────────────────────
🏠 Portföy Sorumlusu — Senior ⭐⭐⭐
   XP: 450/600 (75% → Expert)
   Bu ay: 15 görev

🤝 Satış Destek — Junior ⭐⭐
   XP: 180/300 (60% → Senior)
   Bu ay: 8 görev

📊 Pazar Analisti — Stajyer ⭐
   XP: 40/100 (40% → Junior)
   Bu ay: 3 görev

📋 Sekreter — Stajyer ⭐
   XP: 60/100 (60% → Junior)
   Bu ay: 5 görev

📱 Medya Uzmanı — Stajyer ⭐
   XP: 20/100 (20% → Junior)
   Bu ay: 1 görev
───────────────────────
Toplam XP: 750
Rütbe ilerleme: Junior → Senior için 3 kademe daha
```

Ayrıca **profile** görünümünde rozet listesi (tamamlanan missionlar), kademe geçmişi, leaderboard sırası.

---

## 4. DB Schema

### Yeni tablolar:

```sql
-- Her elemanın kademe ve XP'sini tutar
CREATE TABLE user_employee_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employee_key text NOT NULL,  -- portfoy / satis / analist / sekreter / medya
  tier integer DEFAULT 1,      -- 1..5 (Stajyer..Master)
  xp integer DEFAULT 0,
  total_xp_earned integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, employee_key)
);

-- XP log — her kazanım (audit + analytics + puan history)
CREATE TABLE xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_key text NOT NULL,
  amount integer NOT NULL,
  source text NOT NULL,        -- 'daily_task' / 'mission' / 'streak' / 'combo'
  source_ref text,             -- task_id veya mission_key
  created_at timestamptz DEFAULT now()
);

-- Aktif sezon eventleri
CREATE TABLE seasonal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,           -- 'yazlik_2026' gibi
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  tenant_key text,             -- hangi SaaS
  bonus_xp_multiplier numeric DEFAULT 1.5,
  employee_focus text[],       -- öne çıkan elemanlar
  active boolean DEFAULT true
);
```

### Mevcut tablolara eklemeler:

```sql
-- Her mission hangi elemana ait
ALTER TABLE platform_missions ADD COLUMN employee_key text;
ALTER TABLE platform_missions ADD COLUMN xp_reward integer DEFAULT 20;

-- Her daily task hangi elemana ait
ALTER TABLE user_daily_tasks ADD COLUMN employee_key text;
ALTER TABLE user_daily_tasks ADD COLUMN xp_reward integer DEFAULT 5;
```

Mevcut 11 emlak mission'ı seed güncellemesiyle employee_key atanır:
- `emlak_ilk_mulk` → portfoy
- `emlak_mulk_bilgi_tamamla` → portfoy
- `emlak_mulk_foto` → portfoy
- `emlak_fiyat_kontrol` → analist
- `emlak_ilk_musteri` → satis
- `emlak_ilk_eslestirme` → satis
- `emlak_ilk_sunum` → satis
- `emlak_ilk_takip` → satis
- `emlak_ilk_analiz` → analist
- `emlak_ilk_brifing` → sekreter
- `emlak_ilk_paylas` → medya

---

## 5. Kod Değişiklikleri

### Yeni dosyalar:
- `src/platform/gamification/progression.ts` — core: addXp, computeTier, getUserEmployeeState, getUserRank
- `src/platform/gamification/employees.ts` — eleman tanımları + kademe eşikleri
- `src/platform/gamification/seasonal.ts` — aktif event'i çekme + XP multiplier uygulama
- `src/tenants/emlak/commands/ekibim.ts` — "ekibim" komutu (ekran görünümü)
- `src/tenants/emlak/commands/leaderboard.ts` — sıralama
- `src/app/api/cron/seasonal-events/route.ts` — ay başında event rotasyonu

### Değişen dosyalar:
- `src/platform/gamification/engine.ts` — completeMission'a XP dağıtımı eklenir
- `src/platform/gamification/triggers.ts` — XP popup'a eleman kademe bilgisi eklenir
- `src/app/api/cron/daily-tasks/route.ts` — task üretirken employee_key atar
- `src/tenants/emlak/gamification.ts` — mission tanımlarına employee_key eklenir
- `src/platform/whatsapp/router.ts` — /ekibim ve /leaderboard komutları eklenir

### Migration dosyaları:
- `supabase/migrations/YYYYMMDDHHMMSS_employee_progression.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_seasonal_events.sql`

---

## 6. Implementation Aşamaları

### Aşama 1 — Linear flow fix (30 dk)
Mevcut picker'ları ve menu dumping'i bastır. Mission CTA direkt aksiyona götürsün. Test edilebilir zemin hazırlar.

### Aşama 2 — DB + temel altyapı (1 gün)
- Migration'lar
- Employee definitions
- progression.ts + addXp/computeTier helper'ları
- Mevcut mission'ları employee_key ile güncelle

### Aşama 3 — XP entegrasyonu (1 gün)
- completeMission → ilgili elemana XP ekler
- Daily task tamamlama → XP ekler
- Streak milestone → bonus XP
- XP popup'ı güncelle (kademe atlama görünsün)

### Aşama 4 — /ekibim komutu (yarım gün)
- Tenant'ın sanal elemanlarını çek
- Her eleman için kademe + XP göster
- Kullancı rütbesini hesapla + göster

### Aşama 5 — /leaderboard (yarım gün)
- Toplam XP'ye göre sıralama
- Kullancının sırası + top 10
- Bölge/tenant filtreleri

### Aşama 6 — Per-employee daily/weekly loops (1 gün)
- Daily task generator'ı employee bazlı yeniden yaz
- Her elemana özel kurallar
- Haftalık/aylık loops

### Aşama 7 — Seasonal events (yarım gün)
- Schema + migration
- Cron job (ay başı rotasyon)
- Aktif event'in XP multiplier'ı + bildirimi
- İlk sezon: Yazlık (Haziran-Ağustos)

### Aşama 8 — Cross-employee combo missions (yarım gün)
- Combo tanımı (iki eleman ID'si + tek mission)
- Bonus XP logic

**Toplam tahmin: 5-6 gün**

---

## 7. Açık Sorular

1. **Kademeler 5 mi kalsın, 10'a mı çıkalım?** 10 kademe daha uzun ömür (prestige loops), ama karmaşık. Başlangıçta 5 öneriyorum.

2. **Kademe isimleri aynı mı kalsın?** Stajyer/Junior/Senior/Expert/Master. Kullancı bunları custom'layabilir mi? (Örn: "Çırak/Yamak/Kalfa/Usta/Pir"). Şimdilik sabit, sonra configurable.

3. **Leaderboard global mi tenant-scoped mi?** Global ilginç ama farklı şirketlerin karışması garip. Tenant-scoped (aynı ofis) + bölge-scoped (aynı il/ilçe) daha anlamlı.

4. **XP kaybı var mı?** Duolingo hearts gibi hata yapınca XP kaybı? Sanırım hayır, pozitif mekanik istiyoruz.

5. **Kademe atladığında UI'da ne olsun?** Sadece XP popup'a "🎖 Kademe atladı!" eklensek mi, yoksa özel celebration mesajı mı? İkincisi daha tatmin edici.

6. **Seasonal event UI nerede görünsün?** /ekibim içinde "Aktif Sezon: 🏖 Yazlık 2026" satırı olabilir. Ayrıca menüde "🎉 Aktif Event" butonu.

7. **Bayi / diğer tenant'lar ne zaman?** Emlak için tasarım bitince aynı pattern'ı bayi'ye uyarlarız. Muhasebe/otel/market/siteyonetim sıra ile. Plan tenant-agnostic yazılacak ki bu kolay olsun.

---

## 8. Başarı Ölçütleri

Sistem canlı olduktan sonra ölçülecek:

- **7 gün aktif kullancı yüzdesi** (baseline vs sistem sonrası)
- **Kullancı başına ortalama oturum sayısı / gün**
- **Streak ortalaması**
- **Kademe ilerleme dağılımı** (ne kadar kullancı Master'a ulaştı)
- **Seasonal event katılım oranı**
- **Leaderboard etkileşimi** (/leaderboard kullanım sıklığı)

Hedef: Duolingo benzeri %40+ D7 retention.

---

## 9. Riskler

- **Over-gamification riski:** Çok fazla mekanik = kafa karışıklığı. Dengeli eklemeliyiz.
- **Puan enflasyonu:** Eşikleri yanlış belirlersek kullancılar ya çok hızlı ya çok yavaş ilerler. Test + data ile ayarlanır.
- **Bayi/diğer tenant uyumu:** Emlak'a özel tasarım yaparsak, diğer tenant'lara taşıma zor olur. Tenant-agnostic helper'lar öncelikli.
- **Leaderboard suistimal:** Bot/sahte işlemlerle puan farming. Rate limit + anomaly detection.
- **İlk kullancılar için "boş leaderboard" problemi:** İlk aylarda leaderboard sıralaması yapmak için yeterli kullancı olmayabilir. Tenant içi / bölge içi filtre başlangıçta aktif olsun.

---

## 10. Sonraki Adım

Bu plan onaylanınca:
1. Aşama 1 başlar (linear flow fix — picker kaldır, menu dumping bastır)
2. Aşama 2: DB migration + altyapı
3. Her aşama sonrası test + ara onay

**Onay bekleniyor.**
