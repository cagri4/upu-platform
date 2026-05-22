# Market SaaS — Master Plan (Satış Lokomotifi Dönüşümü)

> **Tarih:** 2026-05-22
> **Versiyon:** 1.0 — Bayi master plan v1.1 şablonu market (perakende mağaza) sektörüne adapte edildi; 3.8 Aktif Öneri Motoru yatay yapı paylaşılır
> **Sahibi:** Çağrı
> **Worker:** market (tmux upu-market)
> **Durum:** Onay bekliyor — Faz A başlatma için

---

## 1. Mevcut Durum (5 Açılı Değerlendirme)

### 1.1 UI Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Panel sayfaları | Market panel (kasa, müşteri, ürün, stok, sadakat puanı, kampanya, kurye, online sipariş, raporlar, ayarlar, billing) | Onboarding tour akışı, müşteri kart 360° görünüm, sadakat tier yolculuk grafiği, audit log sayfası | Eski "klasik POS" placeholder ekranlar minimal |
| Sidebar nav | Role-aware (admin/kasiyer/depocu/kurye/yönetici), separatorBefore gruplama | Sub-menu collapse yok (sadakat + kampanya tek seviye) | — |
| Mobile UX | Kasiyer-tablet uyumlu, kurye için mobile drawer, responsive grid | PWA installable test edilmedi, kurye için offline-first cache | — |
| Agent widget | Sağ alt floating, slide-in panel, 3 katman quota UX | Streaming yok, kasiyer-bağlamı (aktif fiş ile chat) yok | — |
| Bell + bildirim merkezi | Topbar bell badge, geçmiş sayfası, filter | Browser push (Web Push API), SKT yaklaşan ürün proactive uyarı | — |

### 1.2 Mağaza Sahibi (Yönetici) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Müşteri yönetimi | Müşteri kart CRUD, telefon/e-posta, sadakat puan bakiyesi, alışveriş geçmişi | **Sadakat & LTV skoru, soğuma uyarısı, RFM segmentasyonu, üyelik tier (Bronze/Silver/Gold)** | — |
| Kasa | Hızlı satış, barkod okuma, sadakat puan kullanım, kupon entry, fiş bas | Otomatik müşteri eşleme öneri (telefon eksikse), kasa-eşleşmeyen müşteri raporu | — |
| Stok / ürün | CRUD, bulk import, stok hareket log, kritik uyarı, SKT (son kullanma tarihi) takibi | Kategori bazlı ABC analizi, otomatik sipariş önerisi, raf görünüm planogramı | — |
| Kampanya | CRUD (manuel), kupon mint, dönemsel indirim | **Trigger-based otomatik sadakat kampanyaları, segment broadcast**, doğum günü/tier upgrade tetik | — |
| Marketing | Hiç yok | Drip onboarding, tier upgrade yolculuğu, kayıp recovery, segment WA broadcast UI | — |
| Sadakat | Puan kazanım/harcama, manuel tier atama | Otomatik tier hesaplama, tier dolgu progress UI, kart için QR | — |
| Online sipariş | Vitrine + sepet + sipariş talebi (temel), kurye atama | Sub-domain bazlı vitrine teması, kurye SLA grafiği, slot yönetimi | — |
| Billing | Mollie 4-tier, fatura geçmişi | Yıllık ödeme indirimi, kupon, ek paket | — |

### 1.3 Müşteri (Son Tüketici) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Üyelik | Kasada telefon ile aç, sadakat puan biriktir | Self-servis kayıt (QR + WA), tier bilgi gönderimi, doğum günü hediye opt-in | — |
| Online sipariş | Vitrine üzerinden sepet → sipariş talebi → kurye | Yerinden teslim slot, daha hızlı re-order ("geçen hafta listem"), favori listesi | — |
| Sadakat görünüm | Yok (sadece kasada kaç puan kaldı) | WA komut "puanlarım", "kampanyalarım"; web mini-profil sayfası | — |
| Çapraz öneri | Yok | "Senin için seçildi" — kişiselleştirilmiş ürün önerisi (WA + vitrine) | — |
| Davet / referans | Yok | Arkadaş davet et — sen kazan, o kazansın (puan veya kupon) | — |

### 1.4 UPU Claude Agent (AI Eleman) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Tools | `list_sales`, `get_kpi_summary`, `get_low_stock`, `get_customer_card`, `send_customer_message` | `get_customer_loyalty_score`, `get_cooling_customers`, `suggest_cross_sell`, `create_loyalty_campaign`, `segment_customers`, `route_courier_order`, `get_skt_alerts` | — |
| Quota | 4 plan tier (Free 50 / Starter 300 / Pro 1500 / Premium 5000) | Quota detay sayfası, suggestion engine (kullanmadığı feature) | — |
| Prompt | Tenant-aware (market prompt), `cache_control: ephemeral` | Streaming SSE, kasiyer modu vs yönetici modu ayrımı, kasiyer chat = aktif fiş context | — |
| Proactive | Yok | Sabah özeti push (dün ciro / bugün hedef / SKT uyarıları), agent-initiated cooling müşteri raporu | — |
| Defense | Cross-tenant `saveMessage` guard, tool tenant assert | — | — |

### 1.5 WhatsApp Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| WA komut | `puanlarım`, `kampanyalarım`, `sipariş`, `iptal` çalışıyor | Yeni müşteri kayıt (`/uye-ol` benzeri), "favorilerim", "tekrar sipariş", tier durum komutu | Eski deneysel komut handler dosyaları (MARKET_COMMANDS_LEGACY ile inert; rollback için duruyor) |
| Notification push | `sendText` / `sendUrlButton` / `sendNotification`, tercih/DND gate | **Sadakat tier upgrade**, **doğum günü hediye**, **soğuyan müşteri kupon**, **SKT yaklaşan ürün admin uyarı**, drip scheduler | — |
| Sabah brifing | Cron yok, manuel | Trigger-based push (yeni online sipariş, kurye SLA aşımı, kritik stok) | — |
| Broadcast | Hiç (kampanya manuel WA atılıyor) | Segment broadcast UI + WA Cloud API 24h gate kontrolü | — |

---

## 2. Hedef: Satış Lokomotifi B2C SaaS

**Vizyon:** Bu SaaS'ı alan market sahibi kasa+stok+müşteri+sadakat+online sipariş+kurye'yi tek yerde yönetir; müşterilerini elinde tutar, sadakat puanını gerçek satışa çevirir, otomatik kampanyalarla cirosu artar, kayıp müşteri geri döner.

**Pazarlama vurgusu:** *"Müşterini ezberle, ezberletme."* — perakende yöneten her market sahibi bu SaaS'ı seçtiğinde otomatik olarak sadakat skoru, soğuma alarmı, kişiselleştirilmiş çapraz öneri, online vitrine ve kasada otomatik kupon önerisi yanında gelir. Tek aboneliğin içinde 7 satış lokomotifi.

**Ölçülebilir hedefler (Faz A+B+C sonu, 6 ay):**
- Müşteri başına aylık sepet +%15 (cross-sell + kampanya tetik)
- 21-gün soğuyan müşteri geri dönüş oranı +%35 (recovery WA + kupon)
- Manuel kampanya hazırlama saati -%70 (trigger-based otomasyon)
- Sadakat üye oranı (total müşteri içinde) +%40 (self-servis QR kayıt + davet)
- Aylık ücretli abonelik upgrade oranı (Starter→Pro) +%25 (Pro-only özellikler: drip, vitrine teması)

---

## 3. 7 Satış Lokomotifi Katmanı

### 3.1 Müşteri Sadakat & LTV Skoru

- **3.1.1 Ne yapacak:** Her müşteriye 0-100 sadakat & LTV skoru — alışveriş sıklığı (4 hafta cadence), sepet büyüklüğü, kategori çeşitliliği, son alışveriş recency, sadakat puan kullanımı karışımı. Üyelik tier'ı (Bronze/Silver/Gold) bu skordan otomatik türetir.
- **3.1.2 Nasıl çalışır:**
  - Cron (haftalık) her aktif müşteri için 5 alt-skor hesaplar (Frequency / Basket / Variety / Recency / Engagement).
  - Skor `market_customer_scores` tablosuna yazılır + 12-hafta timeline snapshot.
  - Tier eşik (Bronze 0-39 / Silver 40-74 / Gold 75-100) — tier değişimi event olarak `market_customer_tier_changes` log'a düşer (3.6 drip ve 3.4 kampanya tetiği için).
  - Dashboard'da liste skor-sıralı, müşteri kart 360° görünümde breakdown grafiği.
- **3.1.3 Backend:**
  - Migration: `market_customer_scores` (customer_id, period_start, score_total, sub_frequency, sub_basket, sub_variety, sub_recency, sub_engagement, tier, snapshot_at).
  - Migration: `market_customer_tier_changes` (customer_id, old_tier, new_tier, changed_at, reason).
  - Helper: `src/platform/market-scoring/calculate.ts` — formula + persist + tier türet.
  - Cron: `/api/cron/market-scoring` (haftalık Pazartesi 02:00).
- **3.1.4 UI:**
  - `src/components/market/CustomerScoreBadge.tsx` (renk kodlu pill + tier label, tooltip breakdown)
  - `musteriler` liste sayfasında skor + tier kolonu, sort
  - `musteriler/[id]` detay sayfasında "Sadakat & LTV" tabı (5 alt-skor + 12-hafta trend + tier yolculuk grafiği)
  - Kasada müşteri seçildiğinde tier rozet anında görünür (Gold müşteriye selam mesajı)
- **3.1.5 Agent entegrasyonu:**
  - Yeni tool `get_customer_loyalty_score` (customer_id veya top_n)
  - Yeni tool `compare_segments` (Gold vs Bronze ortalama sepet)
- **3.1.6 WA entegrasyonu:**
  - Tier upgrade tetiği: "Tebrikler, Silver oldun! 50 puan hediye." (3.4 trigger ile bağlanır)
  - Aylık 1. günü cron: yönetici WA "Sadakat raporu" push (Gold sayısı, ortalama LTV, top-5 müşteri)
- **3.1.7 Tahmini saat:** Tasarım 1 / Kod 5 / Test 2 = **8 saat**
- **3.1.8 Öncelik:** **Kritik** (Faz A — temel veri katmanı, diğer katmanlar bu skor + tier'ı tüketir)
- **3.1.9 Marketing parlatma:** *"Her müşterinin 0-100 sadakat skoru ve Bronze/Silver/Gold tier'ı otomatik hesaplanır — kim VIP, kim sıradan, kim soğumak üzere bir bakışta görürsün. Aylık ortalama sepet 2 ayda %15 artar."*

---

### 3.2 Müşteri Soğuma Uyarısı (RFM Erken Uyarı)

- **3.2.1 Ne yapacak:** 21/45/90 gün cadence sapması + RFM düşüşü → müşteri "soğuyor" işaretlenir, yöneticiye aksiyon listesi sunulur. Basit RFM (Recency-Frequency-Monetary) segment.
- **3.2.2 Nasıl çalışır:**
  - View `market_cooling_signals`: son alışveriş tarihi, 4-haftalık moving average sepet, skor düşüşü, tier downgrade adayı kombinasyonu.
  - 3 seviye: 🟢 Aktif / 🟡 Soğuyor (21+ gün cadence sapması) / 🔴 Kayıp Riski (45+ gün).
  - Dashboard banner "23 müşteri soğuyor — Aksiyon Al"; tıklayınca recovery flow (otomatik %10 kupon veya tier-özel teklif).
- **3.2.3 Backend:**
  - Migration: SQL view `market_cooling_signals` (read-only, runtime).
  - Helper: `src/platform/market-cooling/score.ts` — RFM hesabı + threshold config (cadence per-müşteri normalize: haftalık alışverişçi 21 gün gec, aylık alışverişçi 60 gün geç).
  - Cron: `/api/cron/market-cooling` (günlük 03:00) — eşik aşan müşteri için notification + öneri kaydı.
- **3.2.4 UI:**
  - `musteriler` liste sayfasına "🟡 Soğuyor" + "🔴 Kayıp Riski" filter chip
  - `/tr/market-soguyan-musteriler` yeni sayfa: risk altındaki müşteriler tabloda, "Recovery aksiyonu" CTA (otomatik kupon WA veya hatırlatma)
  - `musteriler/[id]` detayda "Soğuma Sinyalleri" kartı (cadence, son alışveriş, neden flagged)
- **3.2.5 Agent:**
  - Tool `get_cooling_customers` (top_n) — agent sabah özetinde proactive sunabilir
  - Tool `trigger_recovery_action` (customer_id, action_type) — agent kupon taslağı hazırlar, yönetici onaylar
- **3.2.6 WA:**
  - 21 günü aşan müşteriye opt-in ise otomatik "Seni özledik, %10 kupon" push (24-saat window kontrolü zorunlu — son inbound olmayan müşteriye template message gerekir)
  - Yöneticiye günlük "8 yeni soğuyan müşteri" özet push
- **3.2.7 Tahmini saat:** Tasarım 1 / Kod 4 / Test 2 = **7 saat**
- **3.2.8 Öncelik:** **Kritik** (Faz A — 3.1 skor ile aynı veri katmanını paylaşır, immediate value)
- **3.2.9 Marketing parlatma:** *"Müşterini kaybetmeden 21 gün önce sistem haber verir — otomatik kupon ile geri dönüş oranı %35'e kadar yükselir. Kayıp müşteri, kayıp ciro değil."*

---

### 3.3 Market Sepet Analizi & Çapraz Öneri (Kişiselleştirme)

- **3.3.1 Ne yapacak:** "Bunu alanlar bunu da aldı" — her müşteriye geçmiş sepetlerine göre kişiselleştirilmiş 5 ürün önerisi; kasada otomatik kupon önerisi (örn. "Müşteri sürekli süt + ekmek alıyor, peynir kuponu öner"); vitrine + WA push.
- **3.3.2 Nasıl çalışır:**
  - Item-item co-occurrence (global): tüm satışlarda A ürünüyle birlikte alınan B ürünleri (zaten bayi'de yapıldı; market için yeniden cron).
  - Per-müşteri kişiselleştirme: müşterinin son 90-gün sepetinde olmayan ama benzer profilli müşterilerin sıkça aldığı ürünler.
  - Stok + marj weighting + SKT yaklaşma bonusu (SKT'si yaklaşan ürün öneri önceliği artar — döngü değer).
  - Kasada müşteri seçilince popup "Bu müşteriye 3 ürün öner" → kasiyer 1-tıkla kupon mint.
- **3.3.3 Backend:**
  - Migration: `market_cross_sell_pairs` (product_a_id, product_b_id, co_occurrence_count, score) — cron yeniler.
  - Migration: `market_customer_recommendations` (customer_id, product_id, score, reason, generated_at, expires_at).
  - Helper: `src/platform/market-recommendations/cross-sell.ts` (global pair) + `personalize.ts` (per-müşteri).
  - Cron: `/api/cron/market-recommendations` (günlük 04:00) — global pair + per-müşteri öneri yenile.
- **3.3.4 UI:**
  - `musteriler/[id]` detayda "Bu müşteriye öner" widget (5 ürün)
  - Kasa ekranında müşteri seçilince "Önerilen 3 ürün" rail + 1-tıkla kupon
  - Vitrine müşteri girişinde "Senin için seçildi" rail (anonim kullanıcıda global popular)
- **3.3.5 Agent:**
  - Tool `suggest_cross_sell` (customer_id) — chat'te "X müşterisine ne önerirsin?"
  - Tool `bulk_recommendation_batch` (segment) — yönetici için "Gold müşterilere yeni ürün önerisi taslağı"
- **3.3.6 WA:**
  - Müşteri alışveriş bittikten 24 saat sonra (24h window içinde) opt-in ise "Senin gibiler bunu da aldı" push (1 ürün + kupon)
  - Opt-in/opt-out (`notification_preferences` `cross_sell_suggestion` tipi)
- **3.3.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.3.8 Öncelik:** **Orta** (Faz B — 3.1 + 3.2 ile müşteri trend verisini paylaşır)
- **3.3.9 Marketing parlatma:** *"Kasada müşteriyi tanır, geçmişine bakar, 3 doğru ürün önerir — yapay zekâ sepet başına ek satışı 2-3 üründen az değil, aylık ciroyu doğal şekilde %12-18 yukarı çeker."*

---

### 3.4 Otomatik Sadakat Kampanyaları

- **3.4.1 Ne yapacak:** Trigger + condition + action kuralları: "3 hafta gelmeyen müşteriye WA kupon", "Gold müşteriye ayda 1 VIP teklif", "Doğum gününde %20 indirim", "Tier upgrade tebrik puanı"; yönetici kuralı bir kez tanımlar, sistem çalıştırır.
- **3.4.2 Nasıl çalışır:**
  - Rule engine: event (cadence sapması / tier upgrade / doğum günü / yeni ürün / SKT yaklaşan) → koşul (segment / tier / skor) → aksiyon (kupon mint / WA mesajı / puan hediyesi).
  - Cron event tarayıcı + kural eşleştirme + idempotency (aynı müşteriye aynı kural 30 gün içinde tekrarlamaz; doğum günü kuralı yıllık).
- **3.4.3 Backend:**
  - Migration: `market_campaign_triggers` (id, name, event_type, conditions JSONB, action_type, action_payload JSONB, active, last_run).
  - Migration: `market_campaign_executions` (trigger_id, customer_id, executed_at, status) — idempotency log.
  - Cron: `/api/cron/market-campaign-triggers` (saatlik) — event tara, kural çalıştır, kupon mint + sendNotification.
  - Helper: `src/platform/market-campaigns/rule-engine.ts`
- **3.4.4 UI:**
  - `/tr/market-kampanya-otomatik` yeni sayfa — kural listesi + 3-step wizard (event → segment → action)
  - "Yeni kural" formu: event dropdown (cadence sapması N gün / tier upgrade / doğum günü / yeni ürün / SKT yaklaşan / kasiyer önerisi), segment seçici (tier + skor + kategori), aksiyon (kupon kodu + tutar / WA mesajı template / puan hediyesi)
  - Geçmiş çalıştırmalar tab — hangi kural hangi müşteriye ne zaman tetiklendi + dönüşüm sayısı
- **3.4.5 Agent:**
  - Tool `create_loyalty_campaign` (kural taslağı hazırlar, yönetici onaylar)
  - Tool `list_active_campaigns` + `pause_campaign`
- **3.4.6 WA:**
  - Trigger çalıştığında müşteriye otomatik WA mesajı (template'ler `notification_preferences`'tan opt-out, 24h window için freeform mümkün değilse template gerekli)
  - Yöneticiye haftalık özet "7 kural çalıştı, 142 müşteri etkilendi, 38 alışverişe döndü (ROI ₺X)"
- **3.4.7 Tahmini saat:** Tasarım 2 / Kod 8 / Test 3 = **13 saat**
- **3.4.8 Öncelik:** **Orta** (Faz B — 3.1 skor/tier + 3.2 soğuma + 3.1 tier_change verilerini condition'da kullanır)
- **3.4.9 Marketing parlatma:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın: 3 hafta gelmeyene kupon, Gold'a VIP teklif, doğum gününde indirim — manuel kampanya saatleri %70 azalır, müşteri kendini özel hisseder."*

---

### 3.5 Online Mağaza Vitrini + Sipariş Talebi (+ Kurye Atama)

- **3.5.1 Ne yapacak:** Her mağazaya unique sub-domain `/v/<magaza-slug>` üzerinden ürün katalogu — raf fiyat + stok + kategori filter + sepet + sipariş talebi. Lead → mağazaya WA push + kurye atama. Bayi vitrinesi ile yapı paylaşılır (yatay), market için ürün listesi + sipariş intent + kurye SLA.
- **3.5.2 Nasıl çalışır:**
  - Her mağazaya unique `vitrine_slug` (örn `marketai.upudev.nl/v/migros-sariyer`).
  - Public sayfa: ürün listesi (fiyat + stok rozet + kategori filter), sepet, "Sipariş Talep Et" form (ad/telefon/adres/teslim slot).
  - Form submit → `market_orders` tablosu insert (kaynak='vitrine') → mağazaya WA push + uygun kuryeye atama.
  - Mağaza panel "Online Siparişler" sayfasından siparişi onaylar, kurye SLA takip eder.
- **3.5.3 Backend:**
  - Migration: `market_store_vitrines` (store_id, slug UNIQUE, theme JSONB, is_active, custom_logo_url, custom_color, delivery_slots JSONB).
  - Migration: `market_courier_assignments` (order_id, courier_id, assigned_at, picked_at, delivered_at, sla_minutes).
  - Public route `/v/[slug]` (locale-aware) — auth yok, RLS allow anonymous insert orders + müşteri telefon doğrulama opt.
  - Helper: `src/platform/market-vitrine/render.ts` + `src/platform/market-courier/assign.ts`
- **3.5.4 UI:**
  - `/tr/market-vitrinim` — vitrine editor: logo, renk, başlık, görünür ürünler, teslim slotları, "Önizle"
  - `/tr/market-online-siparisler` — sipariş listesi, onay/red, kurye atama, SLA grafiği
  - `/v/[slug]` public ürün katalogu + sepet + sipariş form (mobile-first, no-auth)
  - Kurye panel `/tr/market-kurye-paneli` — atanmış siparişler, harita, "alındı/teslim edildi" tıklama
- **3.5.5 Agent:**
  - Tool `get_online_orders` (status) — günlük online sipariş dönüşüm raporu
  - Tool `suggest_vitrine_improvements` (store_id) — düşük dönüşümlü mağazaya öneri
- **3.5.6 WA:**
  - Yeni online sipariş → mağaza yöneticisine anlık WA push ("Yeni online sipariş: Ahmet, 14 ürün, ₺245")
  - Kuryeye atanan sipariş → kurye WA "Yeni teslimat, adres link"
  - Sipariş 30 dakikada onaylanmazsa yönetici hatırlatma
- **3.5.7 Tahmini saat:** Tasarım 3 / Kod 10 / Test 5 = **18 saat** (yeni public route + kurye atama logic)
- **3.5.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, en geniş yüzey)
- **3.5.9 Marketing parlatma:** *"Her mağaza kendi online vitrinine sahip — müşterin internetten sipariş verir, sana anlık WA gider, kurye otomatik atanır. Mahalle marketinden e-ticarete tek tıkla."*

---

### 3.6 Sadakat Drip + Segment Kampanyaları (Marketing Automation)

- **3.6.1 Ne yapacak:** 5-mesajlık otomatik drip dizileri — yeni müşteri onboarding (kayıt → ilk indirim → tier bilgi → 2. alışveriş teşvik → favori kategori öner), tier upgrade yolculuğu (Bronze → Silver hedef takip), kayıp recovery 5-mesaj dizisi; ayrıca segment-based broadcast (WA + e-posta).
- **3.6.2 Nasıl çalışır:**
  - Drip = `market_drip_campaigns` + `market_drip_steps` (step_order, delay_days, channel, template, condition).
  - Müşteri belirli "audience" (yeni üye / Bronze → Silver hedef / soğuyan / Gold VIP) girer → drip otomatik tetiklenir.
  - Cron her gün step delay'i kontrol eder, mesajları gönderir, log tutar.
  - Tier upgrade yolculuğu: müşterinin Silver olması için kaç alışveriş eksik bilgisi her 2 haftada "1 alışveriş daha → Silver" push.
- **3.6.3 Backend:**
  - Migration: `market_drip_campaigns` (id, name, audience JSONB, channel, active).
  - Migration: `market_drip_steps` (campaign_id, step_order, delay_days, channel, template, send_condition).
  - Migration: `market_drip_enrollments` (campaign_id, customer_id, enrolled_at, current_step, status).
  - Migration: `market_drip_sends` (enrollment_id, step_id, sent_at, status, error).
  - Cron: `/api/cron/market-drip` (saatlik) — pending step'leri gönder.
  - Helper: `src/platform/market-marketing/drip-engine.ts` (3.6'da bayi engine paylaşılır; market audience adapter ayrı).
- **3.6.4 UI:**
  - `/tr/market-marketing` yeni sayfa — drip listesi
  - Drip editor (5-step wizard): audience seç, kanal (WA/e-posta), step ekle (delay + template), önizle
  - Segment builder: tier + skor aralığı + son alışveriş + kategori + cadence + doğum ayı
  - Broadcast formu: tek seferlik mesaj segment'e gönder
- **3.6.5 Agent:**
  - Tool `create_drip_campaign` — agent kullanıcıyla konuşarak drip taslağı hazırlar
  - Tool `get_drip_performance` — açılma/dönüşüm raporu
  - Tool `suggest_audience_for_template` — verilen template'e uygun müşteri seç
- **3.6.6 WA:**
  - Tüm drip mesajları WA Cloud API üzerinden (24-saat customer service window gate zorunlu; template message tier upgrade ve kayıp recovery için Meta onayı al)
  - WA başarısızsa e-posta fallback (SES/Postmark, opt-in mevcutsa)
- **3.6.7 Tahmini saat:** Tasarım 3 / Kod 9 / Test 4 = **16 saat**
- **3.6.8 Öncelik:** **Düşük** (Faz C — 3.4 trigger sistemiyle örtüşür; trigger = anlık tek mesaj, drip = zamana yayılmış dizi)
- **3.6.9 Marketing parlatma:** *"Yeni üye onboarding, Bronze→Silver yolculuğu, kayıp müşteri recovery — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu müşterini taşır; manuel ekip yerine sistem konuşur."*

---

### 3.7 Arkadaş Davet Et — Sen de Kazan, O da Kazansın (Referans Programı)

- **3.7.1 Ne yapacak:** Müşteri arkadaş davet eder; davet kabul edilip ilk alışverişini geçtiğinde ikisi de 25 sadakat puanı (veya ₺25 kupon) kazanır. Tahakkuk ilk alışverişde, viral büyüme aracı.
- **3.7.2 Nasıl çalışır:**
  - Müşteri WA komut "davet et" veya web "Arkadaşına Öner" sayfasından unique link alır (örn `/davet/<code>`).
  - Davet edilen müşteri linke tıklar → self-servis kayıt (QR + telefon) → ilk alışverişde `market_referrals.status='earned'` + iki taraf puan ledger'a eklenir.
  - Müşteri puanı bir sonraki alışverişde kullanır (kasa otomatik öneri).
- **3.7.3 Backend:**
  - Migration: `market_referral_codes` (code, customer_id, created_at, expires_at, max_uses, current_uses).
  - Migration: `market_referrals` (referrer_customer_id, referred_customer_id, code_id, status, reward_points, reward_currency, earned_at, applied_at).
  - Migration: `market_customer_points` (zaten var; `market_point_movements` tablosuna `source='referral'` ekle).
  - Helper: `src/platform/market-referral/engine.ts` (bayi referral pattern paylaşılır; market reward kuralları config).
  - Trigger: yeni `market_orders` insert (referred customer ilk sipariş) → referrer puan kontrolü.
- **3.7.4 UI:**
  - `/tr/market-davet-et` (müşteri web mini-sayfası) — unique kod, WA paylaş butonu, kazanım grafiği
  - `musteriler/[id]` admin detayda "Davet ettiği müşteriler" sekmesi
  - Kasa ekranında "Mevcut puan: X (5 = ₺5 indirim)" görünür
  - Admin görünüm `/tr/market-referans-yonet` — toplam davet, top referrer'lar
- **3.7.5 Agent:**
  - Tool `get_referral_status` (customer_id)
  - Tool `top_referrers` — yönetici için
- **3.7.6 WA:**
  - Davet edilen kayıt olduğunda referrer'a "Davetin kabul oldu, ilk alışverişiyle 25 puan kazanacaksın" push
  - İlk alışveriş tetiklendiğinde "Kazandın! 25 puan hesabına eklendi" push (her iki tarafa)
- **3.7.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.7.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, viral büyüme aracı)
- **3.7.9 Marketing parlatma:** *"Müşterilerin birbirini davet eder, sen para vermeden ağ büyür — her başarılı davet iki tarafa puan, sana yeni müşteri ve ek alışveriş. Viral büyüme: ilk 6 ayda üye sayısı +%40."*

---

### 3.8 Aktif Öneri Motoru (Yatay — Tüm SaaS'larda Aynı Pattern)

- **3.8.1 Ne yapacak:** Sayfa açar açmaz "Sana özel 3 öneri" — sistem son N gün veriyi tarayıp aksiyona dönüşebilen kısa tavsiyeler sunar. Market örnekleri: *"SKT'si 5 günden az 18 ürün — kampanya tetik öner"*, *"Stoğu azalan 12 SKU — tedarikçi sipariş hazırla"*, *"Bu hafta 8 Gold müşteri henüz alışveriş yapmadı — VIP teklif tetiği"*, *"3 günde kasada 14 müşteri eşleşmedi — telefon eksik kart oluştur"*, *"Ay sonu performans hedefin %85 — son hafta kampanya öner"*.
- **3.8.2 Nasıl çalışır:**
  - Rule registry — market için 5-7 öneri kuralı (SKT yaklaşan ürün, stok düşen kategori, segment kampanya tetik, kasa eşleşmeyen müşteri, ay sonu performans, soğuyan VIP, doğum günü dolan).
  - Saatlik cron tüm rule'ları evaluate eder; eşik aşıldığında `recommendation_runs` row açılır (idempotency: aynı user × rule × hedef 24h kapalı).
  - Dashboard widget en yüksek skorlu 3 öneri gösterir (skor = recency × impact × actionability).
  - Action button 1-tıkla aksiyona: kupon mint / WA broadcast taslağı / tedarikçi sipariş ekranı deeplink / kampanya tetik / billing yönlendirme.
  - **Yatay yapı:** engine tenant-agnostic, her SaaS kendi `recommendations.ts` adapter'ı verir. Bayi'de "sipariş vermeyen bayi", emlak'ta "30 gün ulaşılamayan müşteri", market'ta "SKT yaklaşan ürün" gibi.
- **3.8.3 Backend:**
  - Migration paylaşılan: `recommendation_rules` + `recommendation_runs` (bayi master plan'da yazıldı; market eklenirse `tenant_key='market'` ile aynı tablo).
  - Helper paylaşılan: `src/platform/recommendations/engine.ts` — tenant-agnostic dispatcher.
  - Tenant adapter: `src/tenants/market/recommendations.ts` — MARKET_RULES: SKT yaklaşan ürün, stok düşen kategori, segment kampanya tetik, kasa eşleşmeyen müşteri, ay sonu performans, soğuyan VIP, doğum günü dolan.
  - Cron paylaşılan: `/api/cron/recommendations` (saatlik) — tüm tenant adapter'ları çalıştırır.
- **3.8.4 UI:**
  - Component paylaşılan: `src/components/recommendations/RecommendationCard.tsx`.
  - Market `market-panel` dashboard üstüne mount — "Sana özel 3 öneri" başlık + 3 kart.
  - `/tr/market-oneriler` full liste sayfası — geçmiş + dismissed dahil, filter (open/acted/dismissed), severity badge.
  - Action handler modal'ları: WA broadcast taslağı, tedarikçi sipariş sepeti pre-fill, kupon mint, billing deeplink.
- **3.8.5 Agent:**
  - Tool `get_recommendations` (limit=5) — son 24h `recommendation_runs status='open'` listesi.
  - Tool `act_on_recommendation` (run_id, choice='accept'|'dismiss') — action_type'a göre downstream tool çağırır.
  - Agent prompt'a context: "şu an N öneri açık" — chat başında proactive sunabilir.
- **3.8.6 WA:**
  - Severity='high' öneri 6 saatte action edilmezse yönetici WA hatırlatma.
  - Action sonucu downstream sendNotification helper çalıştırır.
- **3.8.7 Tahmini saat:** Tasarım 1 / Kod 3 / Test 1 = **5 saat** (engine + UI bayi Faz B'de yazıldı; market için yalnızca adapter + tenant tuning)
- **3.8.8 Öncelik:** **Orta** (Faz B — 3.1 skor + 3.2 soğuma + 3.3 cross-sell verilerini tüketir). **Yatay yapı:** engine + UI component diğer 5 SaaS'da aynı koddur.
- **3.8.9 Marketing parlatma:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi ürünün SKT'si yaklaşıyor, hangi müşteriye kupon atılmalı, hangi kategori sipariş edilmeli söyler. Tıkla, yapsın. Beyin gibi düşünür, asistan gibi çalışır."*

---

## Yatay Yapı (Tüm Tenant'larda Aynı Engine)

Aşağıdaki helper'lar bayi master plan'da yazıldı, **tenant-agnostic**'tir ve market adapter'ı ile yeniden kullanılır. Her SaaS yalnızca tenant-spesifik kuralı/audience'ı/reward konfigini verir; çekirdek engine değişmez.

| Modül | Konum | Bayi'de Durum | Market'te Ek İş |
|-------|-------|---------------|-----------------|
| Aktif Öneri Motoru (3.8) | `src/platform/recommendations/engine.ts` | Faz B'de yazıldı, ortak | `src/tenants/market/recommendations.ts` adapter (~2 saat) — 5-7 market kuralı |
| Vitrine altyapısı (3.5) | `src/platform/bayi-vitrine/` (bayi-spesifik) | Faz C'de yazıldı | Unified `src/platform/vitrine/` extract veya `src/platform/market-vitrine/` ayrı klasör; render helper aynı, slot + kurye atama market özel (~tam modül 18h içinde) |
| Drip Engine (3.6) | `src/platform/bayi-marketing/drip-engine.ts` | Faz C'de yazıldı | `src/platform/market-marketing/drip-engine.ts` re-export + market audience adapter (~2 saat hazırlık; geri kalan template/UI iş Faz C 16h içinde) |
| Referans Engine (3.7) | `src/platform/bayi-referral/engine.ts` | Faz C'de yazıldı | `src/platform/market-referral/engine.ts` re-use; reward kuralları tenant config (puan vs ₺ kredi) (~2 saat) |
| Notification helper | `src/platform/notifications/send-notification.ts` | Tüm tenant ortak (mevcut) | — (kullanım yerinde import) |
| Auth helper (`requireAuth`) | `src/platform/auth/require-auth.ts` | Ortak | — |
| Tenant profile resolver | `src/platform/auth/tenant-profile.ts` | Ortak | — |

**Net kazanç:** market için 3.8 adapter (~2h), 3.6 audience adapter (~2h), 3.7 reward config (~2h) = ~6 saat ek iş; toplam ~88-94 saat yerine ~80-85 saat efektif (paylaşılan engine'ler tekrar yazılmıyor).

---

## 4. Faz Sırası

### Faz A — Hızlı Kazanç (1-2 hafta, **Kritik**)

**Kapsam:** 3.1 Müşteri Sadakat & LTV Skoru + 3.2 Müşteri Soğuma Uyarısı

**Gerekçe:**
- Her ikisi aynı veri katmanını (alışveriş geçmişi + sepet + cadence) tüketir — paralel implement edilebilir.
- Anlık değer: ilk gün yönetici paneli açtığında "23 müşteri soğuyor — Aksiyon Al" banner'ı görür → SaaS değerinin somut kanıtı.
- Diğer katmanlar (3.3 cross-sell, 3.4 kampanya, 3.6 drip) skor/tier/soğuma verisini condition'da kullanır — Faz A altyapı.
- Tier (Bronze/Silver/Gold) Faz A çıktısı; 3.4 trigger ve 3.6 drip audience filtresinde direkt kullanılır.
- Migration risk düşük (yeni tablo + view, yıkıcı değişiklik yok).

**Tahmini:** 15 saat

### Faz B — Orta (3-4 hafta)

**Kapsam:** 3.3 Market Sepet Analizi + 3.4 Otomatik Sadakat Kampanyaları + **3.8 Aktif Öneri Motoru (adapter)**

**Gerekçe:**
- Faz A'nın skor + tier + soğuma verisini segment/condition olarak kullanır.
- Cross-sell rekomandasyon motoru per-müşteri; kasada kupon önerisi UI tek karar değişimi yüksek değer.
- Otomatik kampanya kural motoru: en yüksek manuel-iş-azaltma kazancı; doğum günü + tier upgrade tetikleri viralite katar.
- **3.8 Aktif Öneri Motoru** bayi Faz B'de yazılan ortak engine + UI'ı market adapter (~5h) ile bağlar. "Panel açar açmaz aksiyon" deneyimi market için SKT/stok/segment odaklı.

**Tahmini:** 29 saat (11 + 13 + 5)

### Faz C — Uzun Vadeli (5-8 hafta)

**Kapsam:** 3.5 Online Vitrin + Kurye + 3.6 Drip Marketing + 3.7 Arkadaş Davet

**Gerekçe:**
- 3.5 Vitrin + kurye: yeni public route + kurye atama logic + mağaza yeni yüzey, en uzun kapsamlı modül.
- 3.6 Drip: 3.4 trigger sistemini genişletir, time-based dizilere taşır; onboarding + tier yolculuğu + recovery 3 ana dizi.
- 3.7 Arkadaş Davet: bağımsız viral büyüme aracı; sadakat puan ledger'a entegre.
- Faz C bittiğinde "satış lokomotifi" söylemi tam olarak savunulabilir hale gelir.

**Tahmini:** 45 saat

---

## 5. Toplam Saat Tahmini

| Katman | Tasarım | Kod | Test | Toplam |
|--------|---------|-----|------|--------|
| 3.1 Müşteri Sadakat & LTV Skoru | 1 | 5 | 2 | **8** |
| 3.2 Müşteri Soğuma Uyarısı | 1 | 4 | 2 | **7** |
| 3.3 Market Sepet Analizi & Çapraz Öneri | 2 | 6 | 3 | **11** |
| 3.4 Otomatik Sadakat Kampanyaları | 2 | 8 | 3 | **13** |
| 3.5 Online Mağaza Vitrini + Kurye | 3 | 10 | 5 | **18** |
| 3.6 Sadakat Drip + Segment | 3 | 9 | 4 | **16** |
| 3.7 Arkadaş Davet Et | 2 | 6 | 3 | **11** |
| 3.8 Aktif Öneri Motoru (market adapter) | 1 | 3 | 1 | **5** |
| **TOPLAM** | **15** | **51** | **23** | **89 saat** |

**Faz bazında:** Faz A 15h · Faz B 29h · Faz C 45h
**Kalibrasyon notu:** Bayi master plan tamamı ~94h; market yatay yapı (engine + UI + vitrine + drip + referral) bayi'de bittiğinden ~5-9 saat kazanç. Realistik olarak 3-4 hafta yoğun tempoda, 2 ay rahat tempoda. 3.8 yatay engine bayi Faz B'de inşa edilir, market'a yalnızca adapter eklenir (~5h).

---

## 6. Bağımlılıklar ve Riskler

### Üçüncü taraf entegrasyon
- **Mollie:** mevcut — 3.7 referans programında puan ledger + opsiyonel ₺ kredi akışı; abonelik billing değişimi yok.
- **WA Cloud API:** mevcut — 3.2/3.4/3.6 push'larda **24-saat customer service window** gate zorunlu. Soğuyan müşteri 21+ gün inbound yoksa **template message** gerekir; Meta onay süresi 3-5 gün. Tier upgrade, doğum günü, kayıp recovery template'leri en az 5 farklı template önceden onaylanmalı.
- **E-posta SES/Postmark:** 3.6 fallback için yok şu an — eklenmesi gerekir veya başlangıçta WA-only drip + müşteri opt-in e-posta sonradan.
- **Harita/Geokod (3.5 kurye):** Google Maps veya OpenStreetMap; kurye SLA mesafe hesaplama için.
- **QR code:** 3.7 davet linki + 3.1 sadakat kart QR için lib (mevcut emlak QR helper paylaşılabilir).

### Veri kalitesi gereksinimleri
- **3.1 + 3.2** için en az **8 hafta** alışveriş + müşteri kart verisi gerekir. Yeni tenant'ta scoring "Yeterli veri yok" placeholder; cron 8 haftadan sonra skor hesaplar.
- **3.3 Cross-sell** için en az **300 sipariş** + **50 ürün SKU** tarihçesi gerek; altında "geliştirme aşamasında" UI ve global popular fallback.
- **3.4 Doğum günü tetiği** için müşteri kart `birth_date` alanı zorunlu — Faz A migration'a `ALTER TABLE market_customers ADD COLUMN IF NOT EXISTS birth_date DATE` eklenir.

### DB migration kuralları (CLAUDE.md)
- 14-digit timestamp prefix, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- DROP/destructive ALTER → ASK first.
- Worker SQL dosyasını yazar + `supabase db push` ile apply eder + commit + push. Migration `supabase/migrations/`, planlama notları `.planning/migrations/` değil.

### Backward compat
- Eski experimental WA komut handler'lar (MARKET_COMMANDS_LEGACY=false) inert kalır; Faz B/C broadcast UI yeni route kullanır.
- `agent_quotas` plan_key Mollie webhook ile sync — 3.4 kupon tetiği `subscriptions.amount`'a dokunmaz; yalnız `market_customer_points` ledger'ında çalışır.
- `notifications` tablosu mevcut — 3.2/3.4/3.6 mesaj sendNotification helper'a düşer, audit trail merkezi.
- Mevcut müşteri kart `points_balance` korunur; 3.7 referans + 3.4 tier upgrade puan hediyesi `market_point_movements` ledger'a yazar (audit).

### Risk haritası
| Risk | Olasılık | Etki | Karşı önlem |
|------|----------|------|-------------|
| Skor + tier formülü subjektif → müşteri / yönetici güvensizliği | Orta | Yüksek | Açık formül + tooltip breakdown + tier eşik admin override + 2 hafta yapay test data |
| WA 24h window ihlali → Meta hesap askısı | Düşük | Çok yüksek | `shouldNotify` gate'inde `last_inbound_at` kontrolü zorunlu; soğuyan müşteri için yalnız template message |
| Drip spam → müşteri opt-out fırtınası | Orta | Orta | step başına opt-out link + frequency cap (haftalık max 2 mesaj) + tier-spesifik frekans |
| Cadence anomalisi (tatil, hastalık) → yanlış soğuma alarm | Orta | Orta | Müşteri "tatildeyim" opt-out toggle + cron whitelist tarih aralığı |
| Vitrine slug çakışması (zincir mağaza) | Düşük | Düşük | UNIQUE + auto-suffix (-2, -3) + admin slug edit |
| Referans puan abuse (sahte üye) | Orta | Orta | Telefon doğrulama + max 1 davet/telefon + monthly cap + audit log + kasiyer ilk alışveriş onayı |
| SKT yanlış işaretleme → boş öneri | Düşük | Düşük | Cron stok hareketine SKT eklenir; SKT geçmiş ürün otomatik öneri dışı |

---

## 7. Kabul Kriterleri (Acceptance)

### Faz A bitince
- [ ] Yönetici `/tr/musteriler` → liste'de "Skor" + "Tier" kolonu, sort çalışıyor
- [ ] `/tr/musteriler/[id]` → "Sadakat & LTV" tabı 5 alt-skor + 12-hafta trend + tier yolculuk grafiği
- [ ] Kasada müşteri seçilince tier rozet ve "Hoş geldin Gold müşterimiz" mesajı görünüyor
- [ ] `/tr/market-panel` → "23 müşteri soğuyor — Aksiyon Al" banner görünüyor
- [ ] `/tr/market-soguyan-musteriler` sayfa açılıyor, recovery aksiyon CTA çalışıyor
- [ ] Cron `market-scoring` haftalık, `market-cooling` günlük schedule'a alındı, manuel test başarılı
- [ ] Tier upgrade event log'a (`market_customer_tier_changes`) düşüyor
- [ ] Agent `get_customer_loyalty_score` + `get_cooling_customers` tool'ları çalışıyor, quota artmıyor sıfır kullanımda
- [ ] WA: 21 günü aşan müşteriye recovery mesajı test müşteri ile ulaştı (24h window kontrolü doğru)

### Faz B bitince
- [ ] Kasa ekranında müşteri seçince "Önerilen 3 ürün" rail görünüyor, 1-tıkla kupon mint çalışıyor
- [ ] `musteriler/[id]` → "Bu müşteriye öner" widget 5 ürün
- [ ] Vitrine girişinde "Senin için seçildi" rail (login varsa kişiselleştirilmiş)
- [ ] `/tr/market-kampanya-otomatik` sayfa açıyor, "Yeni Kural" wizard tamam
- [ ] Trigger çalıştığında: müşteri WA mesajı + kupon mint, geçmiş tab'da log, idempotency 30 gün
- [ ] Doğum günü kuralı test edildi (yıllık idempotency)
- [ ] Tier upgrade kuralı test edildi (Bronze → Silver tetiği WA + puan hediyesi)
- [ ] Cron `market-recommendations` günlük, `market-campaign-triggers` saatlik
- [ ] Agent `suggest_cross_sell` + `create_loyalty_campaign` tool'ları çalışıyor
- [ ] `market-panel` üstüne "Sana özel 3 öneri" widget — 3 öneri görünür (SKT/segment/stok/cooling karışımı)
- [ ] Öneri kartında 1-tıkla aksiyon: WA broadcast modal / tedarikçi sipariş pre-fill / kupon mint / billing deeplink
- [ ] `/tr/market-oneriler` full liste sayfası (filter: open/acted/dismissed)
- [ ] Cron `recommendations` saatlik, idempotency 24h aynı user×rule×hedef
- [ ] Agent `get_recommendations` + `act_on_recommendation` tool'ları çalışıyor
- [ ] Severity='high' öneri 6 saatte acted değilse yönetici WA hatırlatma alındı

### Faz C bitince
- [ ] `/v/<magaza-slug>` public sayfası açıyor (auth-free), sepet + sipariş form submit edilebiliyor
- [ ] Mağaza `/tr/market-online-siparisler` → sipariş listesi + onay + kurye atama akışı tam
- [ ] Kurye `/tr/market-kurye-paneli` → atanmış teslimatlar + alındı/teslim tıklama + SLA grafiği
- [ ] `/tr/market-marketing` drip editor 5-step wizard tamam, audience builder (tier + skor + cadence + doğum ayı)
- [ ] 3 ana drip aktif: yeni üye onboarding, Bronze→Silver yolculuğu, kayıp recovery
- [ ] Müşteri `/tr/market-davet-et` mini-sayfa unique kod görüyor, WA paylaş çalışıyor
- [ ] Davet kabul + ilk alışveriş → her iki taraf 25 puan tahakkuk, ledger'a yazıyor
- [ ] Kasa ekranında "Mevcut puan: X" + "Kullan" checkbox aktif

---

## 8. Pazarlama Mesajları (Sales-Ready Liste)

Her katman için landing page, demo, satış sunumunda kullanılabilir 1-2 cümlelik vurgu:

- **3.1 Müşteri Sadakat & LTV Skoru:** *"Her müşterinin 0-100 sadakat skoru ve Bronze/Silver/Gold tier'ı otomatik hesaplanır — kim VIP, kim sıradan bir bakışta görürsün. Aylık ortalama sepet 2 ayda %15 artar."*
- **3.2 Müşteri Soğuma Uyarısı:** *"Müşterini kaybetmeden 21 gün önce sistem haber verir — otomatik kupon ile geri dönüş oranı %35'e kadar yükselir. Kayıp müşteri, kayıp ciro değil."*
- **3.3 Market Sepet Analizi:** *"Kasada müşteriyi tanır, geçmişine bakar, 3 doğru ürün önerir — yapay zekâ sepet başına ek satışı 2-3 üründen az değil, aylık ciroyu %12-18 yukarı çeker."*
- **3.4 Otomatik Sadakat Kampanyaları:** *"3 hafta gelmeyene kupon, Gold'a VIP teklif, doğum gününde indirim — bir kez kural yaz, sistem yıl boyu çalıştırsın. Manuel kampanya saatleri %70 azalır."*
- **3.5 Online Vitrin + Kurye:** *"Her mağaza kendi online vitrinine sahip — müşterin internetten sipariş verir, sana anlık WA gider, kurye otomatik atanır. Mahalle marketinden e-ticarete tek tıkla."*
- **3.6 Sadakat Drip:** *"Yeni üye onboarding, Bronze→Silver yolculuğu, kayıp recovery — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu müşterini taşır."*
- **3.7 Arkadaş Davet:** *"Müşterilerin birbirini davet eder, sen para vermeden ağ büyür — her başarılı davet iki tarafa 25 puan, sana yeni müşteri. Viral büyüme: ilk 6 ayda üye sayısı +%40."*
- **3.8 Aktif Öneri Motoru:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi ürünün SKT'si yaklaşıyor, hangi müşteriye kupon atılmalı, hangi kategori sipariş edilmeli söyler. Tıkla, yapsın."*

**Üst başlık vurgu (landing hero):**
*"UPU Market — kasa + stok + sadakat yetmez. Müşterini ezberle, ezberletme. Satışını arttırır, soğuyan müşterini geri getirir, marketing'ini otomatize eder. Bir abonelik, 7 satış lokomotifi."*

---

## 9. Sıradaki Adım

Bu master plan Çağrı tarafından onaylandıktan sonra:

1. **Faz A başlatma:**
   - Worker: market (tmux upu-market)
   - İlk commit: `feat(db): market_customer_scores + market_customer_tier_changes + market_cooling_signals view migration`
   - İkinci commit: `feat(market-scoring): cron + helper (calculate.ts + tier derive)`
   - Üçüncü commit: `feat(market): /tr/market-soguyan-musteriler + score+tier badge + musteriler liste sort`
   - 4. commit: `feat(agent/market): get_customer_loyalty_score + get_cooling_customers tools`
   - 5. commit: `feat(market-cooling): WA recovery push template + 24h window gate test`

2. **Sprint task'larına böl:** Faz A her katman için 4-5 task (DB migration → API → UI → cron → agent tool → WA template → kabul testi).

3. **Mevcut market panel ve WA komutları üzerine inşa:** mevcut `puanlarım`, `kampanyalarım`, `sipariş` komutları korunur; Faz C'de "favorilerim", "tekrar sipariş", "davet et" eklenir. Mevcut kasa, müşteri kart, sadakat puan, online sipariş, kurye altyapıları Faz A/B/C içinde extend edilir, yıkıcı değişiklik yok.

4. **Yatay yapı paylaşımı:** Faz B'de market `recommendations.ts` adapter, bayi'de yazılmış ortak engine + UI'a bağlanır. Faz C'de market vitrine + drip + referral, bayi'de yazılmış ortak pattern'i re-use eder; tenant-spesifik konfig adapter dosyalarında.

5. **Diğer 4 SaaS master planı:** Bu template'i şablon olarak `.planning/saas-roadmap/`:
   - `emlak-master-plan.md` — emlak worker
   - `otel-master-plan.md` — otel worker
   - `restoran-master-plan.md` — restoran worker
   - `siteyonetim-master-plan.md` — siteyonetim worker
   - Her tenant kendi domain'ine uyarlar (örn emlak için "portföy skoru", "müşteri churn", "lead routing"; otel için "konuk LTV", "sezon doluluk skoru", "review recovery").

6. **Versiyonlama:** Her sprint sonunda bu doküman `Versiyon 1.1`, `1.2` şeklinde güncellenir. "Tamamlandı / Devam / Plan" durumları her katman üstüne işaretlenir.

---

*Bu doküman market worker (`tmux upu-market`) tarafından 2026-05-22 tarihinde üretildi. Onay sonrası Faz A başlatılır.*
