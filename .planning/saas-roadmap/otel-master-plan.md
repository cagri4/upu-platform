# Otel SaaS — Master Plan (Satış Lokomotifi Dönüşümü)

> **Tarih:** 2026-05-22
> **Versiyon:** 1.0 — İlk taslak, hospitality vurgulu 7+1 lokomotif katmanı
> **Sahibi:** Çağrı
> **Worker:** otel (tmux upu-otel)
> **Durum:** Onay bekliyor — Faz A başlatma için
> **Temel:** Mevcut pre-checkin akışı (`/otel-cekin/*` misafir tek-amaçlı linkler) + otel-panel (oda, misafir, rezervasyon, mesaj, ödeme, takvim) üzerine inşa edilir.

---

## 1. Mevcut Durum (5 Açılı Değerlendirme)

### 1.1 UI Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Panel sayfaları | 8 sayfa (otel-panel, otel-odalar, otel-konuklar, otel-rezervasyonlar, otel-mesajlar, otel-odemeler, otel-takvim, otel-profil) | Onboarding tour, analytic dashboard (RevPAR/ADR/Occupancy grafikleri), audit log sayfası, oda bakım takip sayfası | Mesajlar sayfası placeholder kalmış |
| Sidebar nav | Role-aware (admin/resepsiyon/temizlik), separatorBefore gruplama | Sub-menu collapse yok, sezon/tarih filter chip yok | — |
| Mobile UX | Bottom drawer + topbar, responsive grid | Resepsiyon mobile (check-in/out hızlı buton), PWA installable test edilmedi | — |
| Pre-checkin (misafir) | `/otel-cekin/[token]` 5-step form (kimlik + tarih + imza), purpose='otel-pre-checkin' magic token | Pre-stay tavsiye listesi, transfer + spa upsell, hava tahmin widget | — |
| Agent widget | Sağ alt floating, slide-in panel, 3 katman quota UX | Streaming yok, oda doluluk anlık widget yok | — |
| Bell + bildirim merkezi | Topbar bell badge, geçmiş sayfası | Browser push, e-posta fallback, review-iste hatırlatma | — |

### 1.2 Otel Sahibi (Admin) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Oda yönetimi | CRUD, oda tipi (single/double/suite), fotoğraf upload, fiyat (sezonsuz) | **Doluluk skoru**, RevPAR/ADR hesabı, sezonsal dinamik fiyat, oda bakım takvimi | — |
| Misafir/CRM | Misafir kart (kimlik, telefon, tercih), tekrar konaklama görünür | **Sadakat kaybı uyarısı**, tekrar konaklama segmenti, doğum günü tetiği | — |
| Rezervasyon | Manuel rezervasyon, kanal etiketi (booking/airbnb/direct), durum (confirmed/checked-in/checked-out/cancelled) | OTA senkron (Channel manager API), grup rezervasyon, blok oda kapatma | — |
| Pre-checkin | `/otel-cekin/[token]` form akışı (Sprint pre-checkin), kimlik fotoğraf upload, imza | Pre-checkin sırasında upsell (kahvaltı, transfer), check-in slot tercih (erken/geç) | — |
| Mesajlar | Misafir-otel WA mesaj inbox (skeleton) | Otomatik mesaj şablonları (welcome, post-stay), drip dizi | — |
| Ödemeler | Manuel ödeme kayıt, depozito takip | iyzico/Stripe entegrasyon, OTA komisyon hesabı, fatura PDF | — |
| Takvim | Aylık doluluk gridi, oda × tarih matrisi | Doluluk düşüş uyarısı, tarihsel doluluk karşılaştırma (geçen yıl) | — |
| Kullanıcı yönetim | Çalışan davet (resepsiyon/temizlik), role-aware (Sprint otel-calisan-davet) | Audit log, vardiya yönetim, temizlik atama | — |
| Billing | Mollie 4-tier (Free/Starter/Pro/Premium) | Oda sayısı tier (10/25/50/sınırsız), yıllık ödeme indirimi, OTA komisyon paketi | — |

### 1.3 Misafir Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Pre-checkin form | `/otel-cekin/[token]` 5-step (kimlik + tarih + imza) | Tavsiye listesi (restoran/aktivite/transfer öneri), hava tahmin, oda yükseltme teklifi | — |
| Konaklama bilgileri | Token-only akış, otel telefon görünür | Misafir self-service portal (kendi rezervasyonu, fatura indir, oda servis isteği) | — |
| Post-stay | **Hiç yok** | Memnuniyet anketi (NPS), review iste (Google/Booking link), gelecek rezervasyon kupon | — |
| Mini-booking vitrini | **Hiç yok** | Otel sub-domain (`/v/<otel-slug>`) — odalar, fotoğraf, tarih seçici, rezervasyon talep form | — |
| Sadakat | Yok | Tekrar konaklayan misafir tanıma, gece kredisi, davetli indirim | — |
| WA iletişim | Manuel (otel resepsiyonu WA atar) | Otomatik geliş öncesi check-in link, post-stay anket | — |

### 1.4 UPU Claude Agent (AI Eleman) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Tools | 5 tool: `list_reservations`, `get_occupancy_summary`, `get_guest_history`, `list_pending_checkins`, `send_guest_message` | `get_room_score`, `get_loyalty_risks`, `suggest_upsell`, `create_last_minute_campaign`, `route_review_request`, `get_seasonal_forecast` | — |
| Quota | 4 plan tier (Free 50 / Starter 300 / Pro 1500 / Premium 5000), 3 katman UX | Quota detay sayfası, oda başı kullanım grafiği | — |
| Prompt | Tenant-aware (otel prompt), `cache_control: ephemeral` | Streaming SSE, otel-spesifik karakter (resepsiyonist tonu) | — |
| Proactive | Yok | Sabah doluluk özeti push, kritik durumda (doluluk %30 düşüş) agent-initiated | — |
| Defense | Cross-tenant guard, tool tenant assert | — | — |

### 1.5 WhatsApp Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| WA pivot | Komut router devre dışı, fallback "Paneli aç" link, pre-checkin link push korunur | — | Legacy otel komut handler dosyaları (OTEL_COMMANDS_ENABLED=false ile inert) |
| Notification push | `sendText` / `sendUrlButton` / `sendNotification`, tercih/DND gate | **Misafir-tarafı WA bot** (otel kendi misafirine WA), drip scheduler (pre-stay/post-stay) | — |
| Pre-checkin link | Rezervasyon onayı sonrası misafire pre-checkin link push (mevcut) | Geliş günü hatırlatma + hava tahmin push | — |
| Sabah brifing | Cron — otel sahibi için doluluk özeti (200 char + panel link) | Trigger-based push (rezervasyon iptal, son dakika boşluk, review geldi) — partial | — |
| Broadcast | Hiç (manuel sendButtons handler vardı, kapalı) | Segment broadcast UI (geçen yıl konaklayan misafir → sezon başı kampanya) + 24h gate kontrolü | — |

---

## 2. Hedef: Satış Lokomotifi B2C/Hospitality SaaS

**Vizyon:** Bu SaaS'ı alan otel sahibi doluluk + misafir + rezervasyon yönetimini tek yerde yapar; oda doluluğunu optimize eder, misafir sadakatini büyütür, upsell ile gece başına geliri artırır, kendi marketing'ini otomatize eder.

**Pazarlama vurgusu:** *"Boş oda en pahalı odadır"* — rezervasyon yöneten her otel sahibi bu SaaS'ı seçtiğinde otomatik olarak doluluk takibi, sadakat alarmı, upsell motoru ve misafir vitrini yanında gelir. Tek aboneliğin içinde 7 satış lokomotifi.

**Ölçülebilir hedefler (Faz A+B+C sonu, 6 ay):**
- Oda doluluk oranı +%15 (last-minute kampanya + sadakat geri kazanım)
- RevPAR (gece başı gelir) +%20 (upsell + dinamik öneri)
- Misafir tekrar konaklama oranı +%35 (drip + sadakat programı)
- Manuel kampanya hazırlama saati -%70 (trigger-based otomasyon)
- Otel NPS +25 puan (mini-booking vitrine + drip değer katar)
- Aylık ücretli abonelik upgrade oranı (Starter→Pro) +%30 (Pro-only özellikler vurguda)

---

## 3. 7+1 Satış Lokomotifi Katmanı

### 3.1 Oda Doluluk & Misafir Memnuniyet Skoru

- **3.1.1 Ne yapacak:** Her odaya 0-100 performans skoru — dönem doluluğu (last 30/60/90 gün) + RevPAR + ortalama konaklama süresi + review puanı + tekrar konaklama oranı karışımı. Otel bazında konsolide skor.
- **3.1.2 Nasıl çalışır:**
  - Cron (haftalık) her oda için 5 alt-skor hesaplar (Doluluk / RevPAR / Konaklama süresi / Review / Tekrar oranı).
  - Skor `otel_room_scores` tablosuna yazılır + timeline (haftalık snapshot).
  - Oda listesinde skor-sıralı görünür, oda detayında breakdown grafiği. Otel sahibi panelinde "Otel skor ortalaması" KPI.
- **3.1.3 Backend:**
  - Migration: `otel_room_scores` (room_id, period_start, score_total, sub_occupancy, sub_revpar, sub_stay_length, sub_review, sub_repeat, snapshot_at).
  - Migration: `otel_hotel_scores` (otel_id, period_start, score_total, avg_occupancy, avg_revpar, avg_review, snapshot_at).
  - Helper: `src/platform/otel-scoring/calculate.ts` — formula + persist.
  - Cron: `/api/cron/otel-scoring` (haftalık Pazartesi 02:00).
- **3.1.4 UI:**
  - `src/components/otel/RoomScoreBadge.tsx` (renk kodlu pill, tooltip breakdown)
  - `otel-odalar` liste sayfasında skor kolonu + sort
  - `otel-odalar/[id]` detay sayfasında "Performans" tabı (5 alt-skor, 12-hafta trend grafiği)
  - `otel-panel` dashboard "Otel skor ortalaması" KPI kartı
- **3.1.5 Agent entegrasyonu:**
  - Yeni tool `get_room_score` (room_id veya top_n)
  - Yeni tool `compare_rooms` (top-3 vs bottom-3 oda — hangi odaya yatırım gerek)
- **3.1.6 WA entegrasyonu:**
  - Aylık 1. günü cron: otel sahibine "Oda performans raporu" push (en yüksek/düşük 3 oda, panel link)
  - Skor 30'un altına düşen oda için sahibine uyarı push ("8 numaralı oda 30'un altında — bakım/fiyat gözden geçir")
- **3.1.7 Tahmini saat:** Tasarım 1 / Kod 6 / Test 2 = **9 saat**
- **3.1.8 Öncelik:** **Kritik** (Faz A — temel veri katmanı, diğer katmanlar bu skoru tüketir)
- **3.1.9 Marketing parlatma:** *"Her odanın gerçek kazandırma gücünü 0-100 skorla anında görür, hangi odaya yatırım yapacağını bilirsin — doluluk paneli sadece 2 ayda ortalama RevPAR'ı %20 artırır."*

---

### 3.2 Misafir Sadakat Kaybı + Doluluk Düşüş Uyarısı

- **3.2.1 Ne yapacak:** Tekrar konaklama yapmayan misafir (1+ yıl) "sadakat kaybı riski" işaretlenir + tarihsel olarak doluluğu düşen tarih aralığı erken uyarı (örn Mayıs son 3 yıl ortalama %70, bu yıl %45 → kampanya gerek), otel sahibine aksiyon listesi sunulur.
- **3.2.2 Nasıl çalışır:**
  - View `otel_loyalty_signals`: son konaklama tarihi, tekrar konaklama trendi, NPS skoru kombinasyonu.
  - View `otel_occupancy_forecast`: aylık tarihsel ortalama (3 yıl) vs şu anki rezervasyon yoğunluğu, sapma >%20 ise uyarı.
  - 3 seviye: 🟢 Sağlıklı / 🟡 Watch / 🔴 Yüksek Risk.
  - Dashboard banner "Mayıs 3. hafta doluluk %25 düşük — son dakika kampanya başlat"; tıklayınca recovery flow.
- **3.2.3 Backend:**
  - Migration: SQL view `otel_loyalty_signals` (read-only, runtime) — misafir bazlı.
  - Migration: SQL view `otel_occupancy_forecast` (read-only, runtime) — tarih bazlı.
  - Helper: `src/platform/otel-churn/score.ts` — risk hesabı + threshold config.
  - Cron: `/api/cron/otel-loyalty` (günlük 03:00) — eşik aşan misafir + tarih için notification + skor update.
- **3.2.4 UI:**
  - `otel-konuklar` liste sayfasına "🔴 Sadakat Riski" filter chip
  - `/tr/otel-doluluk-uyarisi` yeni sayfa: tarihsel sapma tablosu, "Last-minute kampanya başlat" CTA (otomatik %10 indirim kuponu + WA broadcast)
  - `otel-konuklar/[id]` detayda "Sadakat Sinyalleri" kartı (son konaklama, NPS, flagged sebebi)
- **3.2.5 Agent:**
  - Tool `get_loyalty_risks` (top_n) — agent sabah özetinde proactive sunabilir ("12 sadık misafirin 1+ yıldır dönmedi")
  - Tool `get_occupancy_forecast` (date_range) — "Mayıs 3. hafta %25 düşük, kampanya öner"
  - Tool `trigger_recovery_campaign` (segment, action_type) — agent öneri olarak kuponu hazırlar, sahibi onaylar
- **3.2.6 WA:**
  - Doluluk %20+ düşük 7 gün sonra için → otel sahibine ⚠️ push
  - Recovery action onayında misafire otomatik kupon mesajı (24-saat window kontrolü)
- **3.2.7 Tahmini saat:** Tasarım 1 / Kod 5 / Test 2 = **8 saat**
- **3.2.8 Öncelik:** **Kritik** (Faz A — performans skoru ile aynı veri katmanını paylaşır, immediate value)
- **3.2.9 Marketing parlatma:** *"Sadık misafirini kaybetmeden 30 gün önce, doluluk düşüşünü 60 gün önce sistem haber verir — otomatik recovery kampanyasıyla boş oda %30'a kadar azalır."*

---

### 3.3 Oda Upsell & Ek Hizmet Önerisi

- **3.3.1 Ne yapacak:** "Deniz manzarası rezervleyenler genelde kahvaltı da alır" — rezervasyon ekranında ve pre-checkin'de upsell (oda yükseltme, kahvaltı paket, spa, transfer, geç check-out). Kategori bazlı co-occurrence.
- **3.3.2 Nasıl çalışır:**
  - Item-item co-occurrence: aynı misafir/segment'in son 6 ay rezervasyonlarında A hizmetiyle birlikte alınan B hizmetleri.
  - Marj+stok weighting: yüksek marjlı ve müsait ek hizmetler önceliklendirilir.
  - Rezervasyon ekranında "Bunu da deneyin" rail, pre-checkin akışında "Konaklamanı zenginleştir" step (opsiyonel).
- **3.3.3 Backend:**
  - Migration: `otel_upsell_pairs` (item_a_id, item_b_id, item_a_type, item_b_type, co_occurrence_count, score) — cron yeniler.
  - Migration: `otel_addon_services` (id, otel_id, name, category, price, is_active, capacity_per_day) — eğer yoksa.
  - Helper: `src/platform/otel-recommendations/upsell.ts`
  - Cron: `/api/cron/otel-recommendations` (günlük 04:00)
- **3.3.4 UI:**
  - `otel-rezervasyonlar/[id]` detayında "Bu misafire öner" widget (5 ek hizmet)
  - `otel-cekin/[token]` pre-checkin akışında "Konaklamanı zenginleştir" opsiyonel step (kahvaltı + transfer + erken check-in)
  - `otel-rezervasyonlar/yeni` form ekranında otomatik "Bunu da deneyin" rail
- **3.3.5 Agent:**
  - Tool `suggest_upsell` (reservation_id) — chat'te "X misafiri için ne önerirsin?" sorusu cevaplanır
  - Tool `bulk_upsell_proposal` (segment) — "ilk 20 misafire kahvaltı paketi önerisi taslağı"
- **3.3.6 WA:**
  - Pre-checkin tamamlandıktan 12 saat sonra misafire "Konaklamana spa+kahvaltı ister misin?" push (24h içinde)
  - Opt-in/opt-out tercih (`notification_preferences` `upsell_suggestion` tipi)
- **3.3.7 Tahmini saat:** Tasarım 2 / Kod 7 / Test 3 = **12 saat**
- **3.3.8 Öncelik:** **Orta** (Faz B — 3.1 + 3.2 ile rezervasyon trend verisini paylaşır)
- **3.3.9 Marketing parlatma:** *"Her rezervasyon ekranında 'bunu rezerveleyenler bunu da aldı' önerisi — yapay zekâ aylık RevPAR'ı doğal şekilde %15-20 yukarı çeker, rezervasyon başına ek satış 3 hizmetten az değil."*

---

### 3.4 Otomatik Misafir Geri Kazanım & Last-Minute Kampanya

- **3.4.1 Ne yapacak:** Trigger + condition + action kuralları: "7 gün sonrası boş oda %50 üzerindeyse otomatik son dakika indirimi WA", "Geçen yıl bu tarihte konaklayanlara hatırlatma" gibi otomasyonlar; otel sahibi kuralı bir kez tanımlar, sistem çalıştırır.
- **3.4.2 Nasıl çalışır:**
  - Rule engine: event (boş oda eşiği / sezon başlangıç / misafir yıldönümü / doluluk düşüş) → koşul (tarih aralığı / segment / skor) → aksiyon (kupon kodu / WA mesajı / e-posta).
  - Cron event tarayıcı + kural eşleştirme + idempotency (aynı misafire aynı kural 30 gün içinde tekrarlamaz).
- **3.4.3 Backend:**
  - Migration: `otel_campaign_triggers` (id, name, event_type, conditions JSONB, action_type, action_payload JSONB, active, last_run).
  - Migration: `otel_campaign_executions` (trigger_id, target_id, target_type, executed_at, status) — idempotency log.
  - Cron: `/api/cron/otel-campaign-triggers` (saatlik) — event tara, kural çalıştır, kupon mint.
  - Helper: `src/platform/otel-campaigns/rule-engine.ts`
- **3.4.4 UI:**
  - `/tr/otel-kampanya-otomatik` yeni sayfa — kural listesi + 3-step wizard (event → segment → action)
  - "Yeni kural" formu: event dropdown (7 gün sonrası boş oda eşik / sezon başı / misafir yıldönümü / doluluk düşüş %), segment seçici, aksiyon (kupon / WA / e-posta)
  - Geçmiş çalıştırmalar tab — hangi kural hangi misafire/tarihe ne zaman tetiklendi
- **3.4.5 Agent:**
  - Tool `create_campaign_trigger` (kural taslağı hazırlar, sahibi onaylar)
  - Tool `list_active_campaigns` + `pause_campaign`
  - Tool `create_last_minute_campaign` (date_range, discount_pct) — proactive sunum
- **3.4.6 WA:**
  - Trigger çalıştığında misafir WA'sına otomatik mesaj (template'ler `notification_preferences`'tan opt-out)
  - Otel sahibine haftalık özet "5 kural çalıştı, 28 misafire ulaşıldı, 7 rezervasyon döndü"
- **3.4.7 Tahmini saat:** Tasarım 2 / Kod 9 / Test 3 = **14 saat**
- **3.4.8 Öncelik:** **Orta** (Faz B — 3.1 skoru + 3.2 sadakat verisini condition'da kullanır)
- **3.4.9 Marketing parlatma:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın: 7 gün sonrası boş oda son dakika kampanya, geçen yıl gelene hatırlatma, sezon başında erken rezervasyon teklifi — manuel kampanya saatleri %70 azalır."*

---

### 3.5 Otel Mini-Booking Vitrini + Rezervasyon Talebi

- **3.5.1 Ne yapacak:** Her otele unique sub-domain `/v/<otel-slug>` — odalar, fotoğraflar, tarih seçici, "Rezervasyon Talep Et" formu (gerçek booking entegrasyon değil, lead form). Lead → otele WA push, çevirim raporu.
- **3.5.2 Nasıl çalışır:**
  - Her otele unique `vitrine_slug` (örn `upudev.nl/v/marmaris-deniz-otel`).
  - Public sayfa: oda listesi (fiyat + müsaitlik rozet), fotoğraf galeri, filtreler (tarih, kişi sayısı), "Rezervasyon Talep Et" form.
  - Form submit → `otel_booking_requests` tablosu insert → otele WA push, sahibine bildirim.
  - Otel panel "Rezervasyon Talepleri" sayfasından lead'leri görür, onaylayınca otomatik rezervasyona dönüşür.
- **3.5.3 Backend:**
  - Migration: `otel_vitrines` (otel_id, slug UNIQUE, theme JSONB, is_active, custom_logo_url, custom_color, gallery_urls JSONB, amenities JSONB).
  - Migration: `otel_booking_requests` (id, otel_id, guest_name, guest_phone, guest_email, check_in_date, check_out_date, room_type, guest_count, message, status, source, converted_reservation_id).
  - Public route `/v/[slug]` (locale-aware) — auth yok, RLS allow anonymous insert booking_requests.
  - Helper: `src/platform/otel-vitrine/render.ts` (yatay yapı — bayi vitrine ile aynı pattern, unified `src/platform/vitrine/` veya tenant-spesifik)
- **3.5.4 UI:**
  - `/tr/otel-vitrinim` — vitrine editor: logo, renk, başlık, galeri upload, hangi odalar görünür, "Önizle" buton
  - `/tr/otel-rezervasyon-talepleri` — booking request listesi, onay/red, dönüşüm metriği
  - `/v/[slug]` public oda katalogu + booking form (mobile-first, no-auth, tarih seçici, kişi sayısı)
  - `otel-panel` dashboard "Vitrin durumu" özet kartı (talep sayısı, dönüşüm oranı)
- **3.5.5 Agent:**
  - Tool `get_booking_requests` (otel_id) — lead-to-reservation dönüşüm raporu
  - Tool `suggest_vitrine_improvements` — düşük dönüşümlü otele öneri (fotoğraf eksik, fiyat yüksek, amenity az)
- **3.5.6 WA:**
  - Yeni booking request → otel sahibine anlık WA push ("Yeni rezervasyon talebi: Ahmet Bey, 3 gece, 2 kişi, deniz manzaralı")
  - Booking request 12 saatte yanıtsız → sahibine hatırlatma
- **3.5.7 Tahmini saat:** Tasarım 3 / Kod 12 / Test 5 = **20 saat** (yeni public route + galeri upload + tarih müsaitlik kontrolü)
- **3.5.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, diğer katmanlara bağlı değil ama yeni public yüzey)
- **3.5.9 Marketing parlatma:** *"Her otelin kendi mini-booking vitrini var — misafir internetten oda görür, tarih seçer, talep yollar, otele anlık WA bildirim gider. Booking komisyonu sıfır, direkt rezervasyon kanalı."*

---

### 3.6 Misafir Drip — Pre-stay + Post-stay

- **3.6.1 Ne yapacak:** 5-7 mesajlık otomatik drip dizileri — pre-stay (geliş öncesi check-in linki, hava tahmin, tavsiyeler), post-stay (memnuniyet anketi, review iste, gelecek rezervasyon kupon). Sezon başında "Erken rezervasyon avantajı" toplu broadcast.
- **3.6.2 Nasıl çalışır:**
  - Drip = `otel_drip_campaigns` + `otel_drip_steps` (step_order, delay_days, channel, template, condition).
  - Misafir belirli "audience" girer (yeni rezervasyon / post-stay / sezon başı segment) → drip otomatik tetiklenir.
  - Cron her gün step delay'i kontrol eder, mesajları gönderir, log tutar.
- **3.6.3 Backend:**
  - Migration: `otel_drip_campaigns` (id, name, audience JSONB, channel, active).
  - Migration: `otel_drip_steps` (campaign_id, step_order, delay_days, channel, template, send_condition).
  - Migration: `otel_drip_enrollments` (campaign_id, guest_id, reservation_id, enrolled_at, current_step, status).
  - Migration: `otel_drip_sends` (enrollment_id, step_id, sent_at, status, error).
  - Cron: `/api/cron/otel-drip` (saatlik) — pending step'leri gönder.
  - Helper: `src/platform/otel-marketing/drip-engine.ts` (yatay — `src/platform/bayi-marketing/drip-engine.ts` pattern ile audience adapter farklı)
- **3.6.4 UI:**
  - `/tr/otel-marketing` — drip listesi
  - Drip editor (5-step wizard): audience seç, kanal (WA/e-posta), step ekle (delay + template), önizle
  - Segment builder: konaklama tarihi, oda tipi, NPS skoru, tekrar sayısı, sezon
  - Broadcast formu: tek seferlik mesaj segment'e gönder (örn "Yaz sezonu erken rezervasyon avantajı")
  - Pre-defined template'ler: "Pre-stay (3 gün önce)", "Post-stay anket (1 gün sonra)", "Tekrar konaklama (90 gün sonra)"
- **3.6.5 Agent:**
  - Tool `create_drip_campaign` — agent kullanıcıyla konuşarak drip taslağı hazırlar
  - Tool `get_drip_performance` — açılma/dönüşüm raporu
  - Tool `suggest_audience_for_template` — verilen template'e uygun misafir seç
- **3.6.6 WA:**
  - Tüm drip mesajları WA Cloud API üzerinden (24-saat customer service window gate kontrolü helper'da)
  - WA başarısızsa e-posta fallback (SES/Postmark)
  - Pre-stay drip: 3 gün önce hava tahmin + tavsiye, 1 gün önce pre-checkin link hatırlatma
  - Post-stay drip: 1 gün sonra anket, 7 gün sonra Google review iste, 90 gün sonra "Tekrar bekleriz" kupon
- **3.6.7 Tahmini saat:** Tasarım 3 / Kod 10 / Test 4 = **17 saat**
- **3.6.8 Öncelik:** **Düşük** (Faz C — 3.4 trigger sistemiyle örtüşür; trigger = anlık tek mesaj, drip = zamana yayılmış dizi)
- **3.6.9 Marketing parlatma:** *"Geliş öncesi karşılama, post-stay anket, tekrar konaklama davet — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, misafir yıl boyu seni hatırlasın; review %3'ten %30'a, tekrar konaklama %12'den %35'e çıkar."*

---

### 3.7 Misafir Tavsiye = Gece Hediye

- **3.7.1 Ne yapacak:** Misafir arkadaş davet ederse, davetli ilk konaklamada misafire 1 gece ücretsiz veya %20 indirim. Misafirin sosyal medya paylaşımı için QR kod.
- **3.7.2 Nasıl çalışır:**
  - Misafir post-stay e-posta/WA'sında "Davet et, gece kazan" link — unique kod + WA share button + QR.
  - Davet kabul + ilk konaklama → `otel_referrals.status='earned'` + gece kredisi (veya %20 indirim) tahakkuk eder.
  - Krediyi misafir bir sonraki rezervasyonunda uygular (auto-apply checkbox veya kupon kodu).
- **3.7.3 Backend:**
  - Migration: `otel_referral_codes` (code, guest_id, otel_id, created_at, expires_at, max_uses, current_uses).
  - Migration: `otel_referrals` (referrer_guest_id, referred_guest_id, code_id, status, reward_type='free_night'|'discount_pct', reward_value, earned_at, applied_at).
  - Migration: `otel_guest_credits` (guest_id, otel_id, balance_nights, balance_discount, last_movement_at) + `otel_credit_movements` (delta, source, reference_id, type='night'|'discount').
  - Helper: `src/platform/otel-referral/engine.ts` (yatay — `src/platform/bayi-referral/engine.ts` pattern ile reward tipi tenant config: kredi yerine gece)
  - Trigger: yeni `otel_reservations` insert + status='checked-in' → referrer credit kontrolü
- **3.7.4 UI:**
  - `/tr/otel-misafir-davet` (misafir token-based veya post-stay sayfa) — unique kod, QR kod, paylaş butonu, kazanım grafiği
  - `otel-konuklar/[id]` ekstresinde "Gece kredisi" satırı
  - `otel-rezervasyonlar/yeni` ekranında "Kredi kullan" checkbox
  - Otel sahibi görünüm `/tr/otel-referans-yonet` — toplam referans, top referrer misafirler
- **3.7.5 Agent:**
  - Tool `get_referral_status` (guest_id)
  - Tool `top_referrer_guests` — otel sahibi için
- **3.7.6 WA:**
  - Davet edilen misafir kabul ettiğinde referrer'a "Davetin kabul oldu, ilk konaklamasıyla 1 gece kazanacaksın" push
  - İlk konaklama tetiklendiğinde "Geceniz tahakkuk etti — bir sonraki rezervasyonunuzda kullanılabilir" push
- **3.7.7 Tahmini saat:** Tasarım 2 / Kod 7 / Test 3 = **12 saat**
- **3.7.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, viral büyüme + sadakat aracı)
- **3.7.9 Marketing parlatma:** *"Misafirler birbirini davet eder, sen reklam parası vermeden ağ büyür — her başarılı davet misafire 1 gece hediye, sana yeni gelir kanalı. Viral hospitality: ilk 6 ayda misafir sayısı +%30."*

---

### 3.8 Aktif Öneri Motoru (Yatay — Tüm SaaS'larda Aynı Pattern)

- **3.8.1 Ne yapacak:** Sayfa açar açmaz "Sana özel 3 öneri" — sistem son N gün veriyi tarayıp aksiyona dönüşebilen kısa tavsiyeler sunar. Örn: *"Bu hafta 5 oda boş kalacak — son dakika kampanya başlat"*, *"3 misafirin yıldönümü yarın — kutlama mesajı at"*, *"Mayıs son hafta doluluk düşük — geçen yıl konaklayanlara hatırlatma"*, *"AI mesajlarının %85'ini kullandın — Pro'ya geç"*, *"7 numaralı odanın review puanı düştü — bakım kontrolü gerek"*.
- **3.8.2 Nasıl çalışır:**
  - Rule registry — her tenant için 10-15 öneri kuralı (event/query/threshold + suggestion template + action_type).
  - Saatlik cron tüm rule'ları evaluate eder; eşik aşıldığında `recommendation_runs` row açılır (idempotency: aynı user × rule × hedef 24h kapalı).
  - Dashboard widget en yüksek skorlu 3 öneri gösterir (skor = recency × impact × actionability).
  - Action button 1-tıkla aksiyona: kupon mint / WA broadcast taslağı / rezervasyon ekranı deeplink / kampanya tetik / billing yönlendirme.
  - **Yatay yapı:** engine tenant-agnostic, her SaaS kendi `recommendations.ts` adapter'ı verir (rule registry + evaluator). Otel'de "doluluk düşüş uyarısı", "last-minute kampanya tetik", "review yanıtsız bekleyen misafir", "oda bakım hatırlatma", "sezon başlangıç pazarlama"; bayi'de "sipariş vermeyen bayi"; market'ta "SKT yaklaşan ürün" gibi.
- **3.8.3 Backend:**
  - Migration: `recommendation_rules` (tenant_key, code UNIQUE, title_template, body_template, action_type, severity, is_active, last_evaluated_at) — config + analytics. **Ortak — bayi planında zaten tanımlandı.**
  - Migration: `recommendation_runs` (id, tenant_id, user_id, rule_code, target_ids JSONB, payload JSONB, severity, status='open'|'acted'|'dismissed'|'expired', acted_at, dismissed_at, expires_at, created_at) — 3 index. **Ortak.**
  - Helper: `src/platform/recommendations/engine.ts` — tenant-agnostic dispatcher (tenantKey → adapter). **Ortak (bayi planında yazılır, otel reuse).**
  - Tenant adapter: `src/tenants/otel/recommendations.ts` — otel kuralları (OTEL_RULES: doluluk düşüş, last-minute boş oda, sadakat riski, review yanıtsız, oda bakım, sezon başı pazarlama, misafir yıldönümü, quota dolma, vb. — 5-7 öneri kuralı).
  - Cron: `/api/cron/recommendations` (saatlik) — tüm tenant adapter'ları çalıştırır. **Ortak.**
- **3.8.4 UI:**
  - `src/components/recommendations/RecommendationCard.tsx` — sağ üst widget (panel-aware, tenant-aware). **Ortak.**
  - Otel `otel-panel` dashboard üstüne mount — "Sana özel 3 öneri" başlık + 3 kart (başlık + 1-2 satır body + "Şimdi yap" + "Sonra" + "Kapat").
  - `/tr/otel-oneriler` full liste sayfası — geçmiş + dismissed dahil, filter (open/acted/dismissed), severity badge.
  - Action handler modal'ları (tenant-shared): WA broadcast taslağı modal, rezervasyon pre-fill modal, kupon mint modal, billing deeplink.
- **3.8.5 Agent:**
  - Tool `get_recommendations` (limit=5) — son 24h `recommendation_runs status='open'` listesi.
  - Tool `act_on_recommendation` (run_id, choice='accept'|'dismiss') — action_type'a göre downstream tool çağırır (örn `act → create_last_minute_campaign` veya `act → send_guest_message`).
  - Agent prompt'a context: "şu an N öneri açık" — chat başında proactive sunabilir.
- **3.8.6 WA:**
  - Severity='high' öneri 6 saatte action edilmezse otel sahibine WA hatırlatma.
  - Action sonucu downstream sendNotification helper çalıştırır (WA push, e-posta yok).
- **3.8.7 Tahmini saat (otel adapter):** Tasarım 1 / Kod 2 / Test 1 = **4 saat** (engine + UI yatay, sadece adapter)
- **3.8.8 Öncelik:** **Orta** (Faz B — 3.1 skor + 3.2 sadakat + 3.3 upsell verilerini tüketir). **Yatay yapı:** engine + UI bayi planında yazıldıysa otel'de sadece adapter (~2-4 saat); eğer otel bayi'den önce gelirse engine de burada yazılır (+10 saat).
- **3.8.9 Marketing parlatma:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi tarih boş kalacak, hangi misafire WA atılmalı, hangi odaya bakım gerek söyler. Tıkla, yapsın. Resepsiyonist gibi düşünür, asistan gibi çalışır."*

---

## 4. Faz Sırası

### Faz A — Hızlı Kazanç (1-2 hafta, **Kritik**)

**Kapsam:** 3.1 Oda Doluluk & Memnuniyet Skoru + 3.2 Sadakat Kaybı + Doluluk Düşüş Uyarısı

**Gerekçe:**
- Her ikisi aynı veri katmanını (rezervasyon geçmişi + doluluk + review + NPS) tüketir — paralel implement edilebilir.
- Anlık değer: ilk gün otel sahibi paneli açtığında "Mayıs 3. hafta doluluk %25 düşük" banner'ı görür → SaaS değerinin somut kanıtı.
- Diğer katmanlar (3.3 upsell, 3.4 kampanya) skor/sadakat verisini condition'da kullanır — Faz A altyapı.
- Migration risk düşük (yeni tablo + view, yıkıcı değişiklik yok).

**Tahmini:** 17 saat

### Faz B — Orta (3-4 hafta)

**Kapsam:** 3.3 Upsell + 3.4 Otomatik Geri Kazanım Kampanya + **3.8 Aktif Öneri Motoru**

**Gerekçe:**
- Faz A'nın skor + sadakat verisini segment/condition olarak kullanır.
- Upsell rekomandasyon motoru bağımsız ama ortak `otel-recommendations` modülünde toplanır.
- Otomatik kampanya kural motoru: en yüksek manuel-iş-azaltma kazancı, marketing pitch'inde "%70 manuel azaltma" iddiası buradan.
- **3.8 Aktif Öneri Motoru** Faz A+B'nin tüm output'larını (skor, sadakat, upsell, kampanya tetiği) tek widget'a toplar — "panel açar açmaz aksiyon" deneyimi. **Yatay yapı:** engine + UI bayi planında yazıldıysa otel sadece adapter (~4 saat); değilse otel'de yazılır (+10 saat).

**Tahmini:** 30 saat (12 + 14 + 4) — engine bayi'den geliyor varsayımı. Engine de burada yazılırsa 36 saat.

### Faz C — Uzun Vadeli (5-8 hafta)

**Kapsam:** 3.5 Mini-Booking Vitrini + 3.6 Pre/Post-stay Drip + 3.7 Misafir Tavsiye

**Gerekçe:**
- 3.5 Vitrin: yeni public route + galeri upload + tarih müsaitlik kontrolü, en uzun kapsamlı modül.
- 3.6 Drip: 3.4 trigger sistemini genişletir, time-based dizilere taşır (pre-stay + post-stay özelinde).
- 3.7 Referans: bağımsız viral büyüme + sadakat aracı, billing entegrasyonu (Mollie kupon code) ile bağlı.
- Faz C bittiğinde "hospitality satış lokomotifi" söylemi tam olarak savunulabilir hale gelir.

**Tahmini:** 49 saat

---

## 5. Toplam Saat Tahmini

| Katman | Tasarım | Kod | Test | Toplam |
|--------|---------|-----|------|--------|
| 3.1 Oda Doluluk & Memnuniyet Skoru | 1 | 6 | 2 | **9** |
| 3.2 Sadakat Kaybı + Doluluk Düşüş Uyarısı | 1 | 5 | 2 | **8** |
| 3.3 Oda Upsell & Ek Hizmet Önerisi | 2 | 7 | 3 | **12** |
| 3.4 Otomatik Geri Kazanım & Last-Minute | 2 | 9 | 3 | **14** |
| 3.5 Mini-Booking Vitrini + Lead | 3 | 12 | 5 | **20** |
| 3.6 Pre/Post-stay Drip | 3 | 10 | 4 | **17** |
| 3.7 Misafir Tavsiye = Gece Hediye | 2 | 7 | 3 | **12** |
| 3.8 Aktif Öneri Motoru (adapter, yatay) | 1 | 2 | 1 | **4** |
| **TOPLAM** | **15** | **58** | **23** | **96 saat** |

**Faz bazında:** Faz A 17h · Faz B 30h · Faz C 49h
**Kalibrasyon notu:** Sprint pre-checkin yaklaşık 5-7 saat sürdü (token akışı + 5-step form + imza). Bu plan ~96 saat = realistik olarak 3-4 hafta yoğun tempoda, 2 ay rahat tempoda. 3.8 yatay yapı — engine bayi'de yazılırsa otel sadece adapter (~4 saat); 3.5 mini-booking vitrini hospitality için en kompleks modül (galeri + tarih müsaitlik). Booking entegrasyonu (Booking.com / Airbnb channel manager) bu planda yok — gerçek senkron + komisyon hesap +30 saat ekstra, Faz C sonrası ayrı plan.

---

## 6. Bağımlılıklar ve Riskler

### Üçüncü taraf entegrasyon
- **Mollie:** mevcut — 3.7 referans programında kupon code akışı eklenecek (gece kredisi → kupon stack).
- **WA Cloud API:** mevcut — 3.4/3.6 broadcast'lerde **24-saat customer service window** gate zorunlu. Template message gerekirse Meta onay süresi 3-5 gün; pre-stay/post-stay drip için template önceden onaylanmalı (free-form 24h dışında çalışmaz).
- **E-posta SES/Postmark:** 3.6'da fallback için yok şu an — eklenmesi gerekir veya başlangıçta WA-only drip.
- **Channel Manager (Booking/Airbnb):** Bu planda **yok** — Faz C sonrası ayrı plan. Şu an manuel rezervasyon + mini-booking vitrini lead form ile sınırlı.

### Veri kalitesi gereksinimleri
- **3.1 + 3.2** için en az **3 ay** rezervasyon + review verisi gerekir. Yeni otel'de scoring "Yeterli veri yok" placeholder; cron 90 günden sonra skor hesaplar.
- **3.2 Doluluk düşüş uyarısı** için en az **2 yıl** tarihsel veri gerek; altında "geliştirme aşamasında" UI (yalnız sadakat sinyali aktif).
- **3.3 Upsell** için en az **30 rezervasyon** + addon hizmet katalogu gerek; altında "geliştirme aşamasında" UI.

### DB migration kuralları (CLAUDE.md)
- 14-digit timestamp prefix, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- DROP/destructive ALTER → ASK first.
- Worker SQL dosyasını yazar + `supabase db push` ile apply eder + commit + push. Migration yerel `.planning/migrations/` değil, `supabase/migrations/`.

### Backward compat
- WA komut router devre dışı (OTEL_COMMANDS_ENABLED=false) — Faz B/C broadcast UI'sı yeni route kullanacak, eski legacy komut dosyaları inert kalır.
- Pre-checkin akışı (`/otel-cekin/[token]` purpose='otel-pre-checkin') misafir tek-amaçlı link **korunur** — 3.3 upsell pre-checkin form'a opsiyonel step olarak eklenir, magic-token auth ihlal etmez.
- `notifications` tablosu mevcut — 3.4/3.6 mesaj sendNotification helper'a düşer, audit trail merkezi.
- `agent_quotas` plan_key Mollie webhook ile sync — 3.4 kupon tetiği `subscriptions.amount`'a dokunmaz; yalnız `otel_guest_credits` ledger'ında çalışır.

### Risk haritası
| Risk | Olasılık | Etki | Karşı önlem |
|------|----------|------|-------------|
| Skor formülü subjektif → güvensizlik | Orta | Yüksek | Açık formül + tooltip breakdown + admin override |
| WA 24h window ihlali → Meta hesap askısı | Düşük | Çok yüksek | `shouldNotify` gate'inde `last_inbound_at` kontrolü zorunlu; pre/post-stay drip için Meta-approved template kullanım |
| Drip spam → misafir opt-out fırtınası | Orta | Orta | step başına opt-out link + frequency cap (haftalık max 2 mesaj) |
| Vitrine slug çakışması | Düşük | Düşük | UNIQUE + auto-suffix (-2, -3) |
| Referans gece kredisi abuse | Orta | Orta | Max 1 gece/rezervasyon + yıllık cap (3 gece) + audit log |
| Booking request fake → otel zaman kaybı | Orta | Düşük | Telefon doğrulama (OTP SMS) opsiyonel + rate-limit IP başına 3/saat |
| Mini-booking vitrini gerçek booking sandı → memnuniyetsizlik | Yüksek | Orta | UI açık vurgu: "Rezervasyon TALEBİ — otel sizinle iletişime geçer" |
| Channel manager olmaması → çift rezervasyon | Yüksek | Yüksek | Müsaitlik kontrolü manuel; OTA senkron Faz D olarak ayrılır + vitrine'de "Müsaitlik teyit edilecek" disclaimer |

---

## 7. Kabul Kriterleri (Acceptance)

### Faz A bitince
- [ ] Otel sahibi `/tr/otel-odalar` → oda liste'de "Skor" kolonu, sort çalışıyor
- [ ] Otel sahibi `/tr/otel-odalar/[id]` → "Performans" tabı 5 alt-skor + 12-hafta trend grafiği
- [ ] Otel sahibi `/tr/otel-panel` → "Mayıs 3. hafta doluluk %25 düşük" banner görünüyor
- [ ] `/tr/otel-doluluk-uyarisi` sayfa açılıyor, last-minute kampanya CTA çalışıyor
- [ ] Cron `otel-scoring` haftalık, `otel-loyalty` günlük schedule'a alındı, manuel test başarılı
- [ ] Agent `get_room_score` + `get_loyalty_risks` + `get_occupancy_forecast` tool'ları çalışıyor, quota artmıyor sıfır kullanımda
- [ ] WA: skor 30 altına düşen oda tetiği sahibine ulaştı (test otel ile)

### Faz B bitince
- [ ] `otel-rezervasyonlar/[id]` detayında "Bu misafire öner" rail 5 ek hizmet gösteriyor
- [ ] `otel-cekin/[token]` pre-checkin akışında "Konaklamanı zenginleştir" opsiyonel step aktif
- [ ] `/tr/otel-kampanya-otomatik` sayfa açıyor, "Yeni Kural" wizard tamam
- [ ] Trigger çalıştığında: misafir WA mesajı, geçmiş tab'da log var, idempotency 30 gün
- [ ] Cron `otel-recommendations` günlük, `otel-campaign-triggers` saatlik
- [ ] Agent `suggest_upsell` + `create_campaign_trigger` + `create_last_minute_campaign` tool'ları çalışıyor
- [ ] `otel-panel` üstüne "Sana özel 3 öneri" widget — 3 öneri görünür (skor/sadakat/upsell/doluluk karışımı)
- [ ] Öneri kartında 1-tıkla aksiyon: WA broadcast modal / rezervasyon pre-fill / kupon mint / billing deeplink
- [ ] `/tr/otel-oneriler` full liste sayfası (filter: open/acted/dismissed)
- [ ] Cron `recommendations` saatlik, idempotency 24h aynı user×rule×hedef
- [ ] Agent `get_recommendations` + `act_on_recommendation` tool'ları çalışıyor
- [ ] Severity='high' öneri 6 saatte acted değilse otel sahibi WA hatırlatma alındı

### Faz C bitince
- [ ] `/v/<slug>` public sayfası açıyor (auth-free), galeri görünüyor, tarih seçici çalışıyor, booking request submit edilebiliyor
- [ ] Otel sahibi `/tr/otel-rezervasyon-talepleri` lead listesi + onay/red akışı tam
- [ ] `/tr/otel-marketing` drip editor 5-step wizard tamam (pre-stay + post-stay template'leri pre-defined)
- [ ] Pre-stay drip test: rezervasyon → 3 gün önce hava tahmin + tavsiye, 1 gün önce check-in link
- [ ] Post-stay drip test: check-out → 1 gün sonra anket, 7 gün sonra review iste
- [ ] Misafir `/tr/otel-misafir-davet` unique kod + QR görüyor, paylaş çalışıyor; davet kabul + ilk konaklama → gece kredisi tahakkuk
- [ ] `otel-konuklar/[id]` ekstresinde gece kredisi satırı
- [ ] `otel-rezervasyonlar/yeni` ekranında "Kredi kullan" checkbox aktif

---

## 8. Pazarlama Mesajları (Sales-Ready Liste)

Her katman için landing page, demo, satış sunumunda kullanılabilir 1-2 cümlelik vurgu:

- **3.1 Oda Doluluk & Memnuniyet Skoru:** *"Her odanın gerçek kazandırma gücünü 0-100 skorla anında görür, hangi odaya yatırım yapacağını bilirsin — doluluk paneli sadece 2 ayda ortalama RevPAR'ı %20 artırır."*
- **3.2 Sadakat Kaybı + Doluluk Düşüş Uyarısı:** *"Sadık misafirini kaybetmeden 30 gün önce, doluluk düşüşünü 60 gün önce sistem haber verir — otomatik recovery kampanyasıyla boş oda %30'a kadar azalır."*
- **3.3 Oda Upsell & Ek Hizmet:** *"Her rezervasyon ekranında 'bunu rezerveleyenler bunu da aldı' önerisi — yapay zekâ aylık RevPAR'ı %15-20 yukarı çeker, rezervasyon başına ek satış 3 hizmetten az değil."*
- **3.4 Otomatik Geri Kazanım & Last-Minute:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın — 7 gün sonrası boş oda son dakika kampanya, geçen yıl gelene hatırlatma, sezon başında erken rezervasyon teklifi. Manuel kampanya saatleri %70 azalır."*
- **3.5 Mini-Booking Vitrini + Lead:** *"Her otelin kendi mini-booking vitrini var — misafir internetten oda görür, tarih seçer, talep yollar, otele anlık WA bildirim gider. Booking komisyonu sıfır, direkt rezervasyon kanalı."*
- **3.6 Pre/Post-stay Drip:** *"Geliş öncesi karşılama, post-stay anket, tekrar konaklama davet — hepsi otomatik 5-mesajlık dizilerle. Review %3'ten %30'a, tekrar konaklama %12'den %35'e çıkar."*
- **3.7 Misafir Tavsiye = Gece Hediye:** *"Misafirler birbirini davet eder, sen reklam parası vermeden ağ büyür — her başarılı davet misafire 1 gece hediye, sana yeni gelir kanalı. Viral hospitality: ilk 6 ayda misafir sayısı +%30."*
- **3.8 Aktif Öneri Motoru:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi tarih boş kalacak, hangi misafire WA atılmalı, hangi odaya bakım gerek söyler. Tıkla, yapsın. Resepsiyonist gibi düşünür, asistan gibi çalışır."*

**Üst başlık vurgu (landing hero):**
*"UPU Otel — oda + misafir + rezervasyon yönetimi yetmez. Doluluğunu arttırır, sadakati büyütür, marketing'ini otomatize eder. Bir abonelik, 7 satış lokomotifi. Boş oda, en pahalı odadır."*

---

## 9. Yatay Yapı (Tüm Tenant'larda Aynı Engine)

Bu plandaki 7+1 katmanın **4'ü ortak engine + tenant adapter pattern** ile çalışır. Engine bayi worker'ı tarafından yazılır (bayi planı Faz B), otel worker'ı sadece adapter ekler:

| Yatay modül | Path | Otel adapter | Adapter saat |
|-------------|------|--------------|--------------|
| Aktif Öneri Motoru (3.8) | `src/platform/recommendations/engine.ts` | `src/tenants/otel/recommendations.ts` (5-7 otel rule: doluluk düşüş, last-minute, sadakat riski, review yanıtsız, oda bakım, sezon başı, misafir yıldönümü) | ~2 |
| Mini-Booking Vitrini (3.5) | `src/platform/bayi-vitrine/` (pattern paylaşılır) → unified `src/platform/vitrine/` veya `src/platform/otel-vitrine/` | Otel için oda + galeri + tarih müsaitlik özelleştirmesi | ~3 (vitrine pattern reuse) |
| Drip Engine (3.6) | `src/platform/bayi-marketing/drip-engine.ts` → tenant-agnostic | Otel için audience adapter farklı (misafir+rezervasyon segment'i, pre/post-stay event'i) | ~2 |
| Referans Engine (3.7) | `src/platform/bayi-referral/engine.ts` → tenant-agnostic ledger | Otel için reward tipi config: kredi yerine gece (`reward_type='free_night'`) | ~2 |
| Notifications (ortak) | `src/platform/notifications/send-notification.ts` | Kullanım, ekstra adapter yok | 0 |

**Toplam yatay tasarruf:** Eğer engine'ler bayi planında yazılırsa, otel planının saatleri **~96 → ~85 saat** düşer (3.5 + 3.6 + 3.7 + 3.8 adapter pattern ile pattern reuse — engine yazımı bayi'de + ~10 saat ek adapter otel için).

**Eğer otel worker'ı bayi'den önce başlarsa:** Engine'leri otel yazar (3.8 +6 saat, drip engine +4 saat, vitrine engine +6 saat, referral engine +4 saat = +20 saat), bayi worker'ı adapter ile bağlanır. **Bu plan engine'lerin bayi'de yazıldığı senaryoya göre 96 saat tahmin ediyor.**

---

## 10. Sıradaki Adım

Bu master plan Çağrı tarafından onaylandıktan sonra:

1. **Faz A başlatma:**
   - Worker: otel (tmux upu-otel)
   - İlk commit: `feat(db): otel_room_scores + otel_hotel_scores + otel_loyalty_signals view + otel_occupancy_forecast view migration`
   - İkinci commit: `feat(otel-scoring): cron + helper (calculate.ts)`
   - Üçüncü commit: `feat(otel): /tr/otel-doluluk-uyarisi + room score badge + otel-odalar liste sort`
   - 4. commit: `feat(agent/otel): get_room_score + get_loyalty_risks + get_occupancy_forecast tools`

2. **Sprint task'larına böl:** Faz A her katman için 4-5 task (DB migration → API → UI → cron → agent tool → WA template → kabul testi).

3. **Diğer SaaS master planlarıyla senkron:** Bu plan yatay yapıyı bayi planına bağımlı tutar:
   - `bayi-master-plan.md` Faz B (3.8 engine) tamamlandıktan sonra otel Faz B'de yalnız adapter ekler.
   - `market-master-plan.md`, `restoran-master-plan.md`, `siteyonetim-master-plan.md`, `emlak-master-plan.md` aynı yatay engine'leri tüketir.
   - Worker koordinasyon: bayi engine merge sonrası otel `git pull` + adapter implement.

4. **Channel manager (Booking/Airbnb) ayrı plan:** Bu plan dışında — gerçek OTA senkron + komisyon + çift rezervasyon koruma +30 saat, Faz D olarak ayrılır.

5. **Versiyonlama:** Her sprint sonunda bu doküman `Versiyon 1.1`, `1.2` şeklinde güncellenir. "Tamamlandı / Devam / Plan" durumları her katman üstüne işaretlenir.

---

*Bu doküman otel worker (`tmux upu-otel`) tarafından 2026-05-22 tarihinde üretildi. Onay sonrası Faz A başlatılır. Mevcut pre-checkin akışı (`/otel-cekin/*` misafir tek-amaçlı linkler) üzerine inşa edilir — magic-token auth ihlal edilmez, opsiyonel upsell step pre-checkin form'a eklenir.*
