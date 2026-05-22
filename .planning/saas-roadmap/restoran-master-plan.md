# Restoran SaaS — Master Plan (Satış Lokomotifi Dönüşümü)

> **Tarih:** 2026-05-22
> **Versiyon:** 1.0 — F&B (restoran) için 7+1 satış lokomotifi katmanı
> **Sahibi:** Çağrı
> **Worker:** restoran (tmux upu-restoran)
> **Durum:** Onay bekliyor — Faz A başlatma için

---

## 1. Mevcut Durum (5 Açılı Değerlendirme)

### 1.1 UI Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Panel sayfaları | restoran-panel: menü, kategoriler, masalar, rezervasyon, sipariş (POS), kurye, müşteri, kampanya, raporlar, ayarlar, profil | Müdavim müşteri skoru paneli, masa verimlilik dashboard, sezon menü planlayıcı, audit log sayfası, kurye haritası canlı view | Sezonsuz/geçmiş menü kalemleri (görünmez ama listede yer kaplıyor) — arşivlenmeli |
| Sidebar nav | Role-aware (sahip / şef / garson / kasiyer / kurye), separatorBefore gruplama | Sub-menu collapse yok (mobil garson cihazda uzun liste), shift bazlı view yok | — |
| Mobile UX | Garson tablet POS, mobile rezervasyon listesi, bottom drawer | Native PWA hissi zayıf (offline sipariş alıp queue'lama yok — internet kesilince garson çakılır) | — |
| Agent widget | Sağ alt floating, slide-in panel, quota UX | Streaming yok, sezon önerisi proactive değil, suggestion chip statik | — |
| Bell + bildirim merkezi | Topbar bell badge, filter | Mutfak/kurye ayrı kanal yok (tek bell hepsini karıştırıyor), browser push yok | — |

### 1.2 Restoran Sahibi (Admin) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Menü yönetimi | Kategori + ürün CRUD, varyant (boy/porsiyon), opsiyonel ek (ekstra peynir), fiyat | **Combo & menü pattern önerisi**, sezon menü zamanlama, fotoğraf bulk upload, kalori/alerjen alanı | — |
| Masa yönetimi | Masa haritası (kat planı), kapasite, durum (boş/dolu/rezerve) | **Masa verimlilik skoru** (turnover, ortalama hesap), masa-garson eşleşmesi performans | — |
| Rezervasyon | Online + telefon rezervasyon, gün/saat dilim, kapasite kontrolü | Doluluk tahmin grafiği, no-show oranı + deposit istemi, walk-in queue paneli | — |
| Sipariş (POS) | Garson tablet siparişi, masa fişi, ödeme bölme, indirim | Self-order QR (masada QR → müşteri kendi sipariş), tip dağıtım raporu, kurye sipariş entegrasyon eksik | — |
| Kurye | Kurye liste, atama, durum (alındı/yolda/teslim) | **Canlı harita** (kurye konumu), tahmini varış, kurye performans skoru | — |
| Müşteri | Telefon → ad eşleşmesi, geçmiş siparişler | **Müdavim skoru, segmentasyon, soğuma uyarısı**, müşteri yaşam değeri (LTV) | — |
| Kampanya | İndirim kodu, happy hour, kategori indirimi | **Trigger-based otomatik kampanya** (perşembe sessiz akşam → flash kampanya), segment-based broadcast | — |
| Marketing | Hiç yok | Drip campaign (yeni müşteri / müdavim VIP / sezon), e-posta, WA broadcast UI | — |
| Kullanıcı yönetimi | Personel (şef/garson/kasiyer/kurye) davet + rol | Audit log (kim hangi siparişi sildi, hangi indirim kullandı), shift takvim | — |
| Billing | Mollie 4-tier plan (Free/Starter/Pro/Premium) | Yıllık ödeme indirimi, çok-şube ek paket, ek kurye seat | — |

### 1.3 Müşteri (Misafir / Müdavim) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Menüye ulaşım | QR menü (statik link, /menu/<slug>) | **Online sipariş + masa rezervasyonu vitrini** (gerçek sub-domain), favori sipariş tekrarı | — |
| Sipariş ver | Telefon ile, masada garsona | **Self-order QR akışı** (masaya oturup QR → menü → sipariş), online sipariş (paket/gel-al/masa) | — |
| Müdavim / sadakat | Yok | Müdavim seviyesi (Bronz/Gümüş/Altın), bir sonraki ödülün ne kadar uzakta olduğu, doğum günü hediyesi | — |
| Geri bildirim | Yok | Hesap sonrası WA review linki, NPS, anonim şikayet kutusu | — |
| Davet / arkadaş paylaş | Yok | "Arkadaşını davet et — ikiniz de tatlı hediye" referans akışı, Instagram story share intent | — |

### 1.4 UPU Claude Agent (AI Eleman) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Tools | Temel restoran tool seti: `list_today_reservations`, `get_kpi_summary`, `list_active_tables`, `send_customer_message` | `get_customer_score`, `get_cooling_loyals`, `suggest_combo_upsell`, `create_campaign_trigger`, `get_table_efficiency`, `suggest_menu_revision` | — |
| Quota | 4 plan tier, 3 katman UX, period renewal cron | Quota detay sayfası (token + cost grafiği), peak-saat throttling önerisi | — |
| Prompt | Tenant-aware (restoran prompt), F&B vocab (kuver, açma, masa fişi, üst dolu, gel-al) | Streaming SSE, "şef modu / kasa modu / sahip modu" karakter geçiş | — |
| Proactive | Yok | Akşam 17:00 doluluk özeti push, kritik stok düşüşü agent-initiated | — |
| Defense | Cross-tenant guard, tool tenant assert | — | — |

### 1.5 WhatsApp Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| WA pivot | Komut router devre dışı (RESTORAN_COMMANDS_ENABLED=false), fallback "Paneli aç" link | — | Legacy komut handler dosyaları inert (rollback için duruyor) |
| Notification push | `sendText` / `sendUrlButton` / `sendNotification`, tercih/DND gate | **Müşteri-tarafı WA push** (sipariş hazır, kurye yola çıktı, rezervasyon hatırlatma), drip scheduler | — |
| Sabah brifing | Cron, restoran sahibi için kısa özet (bugün rezervasyon / dün ciro / kritik stok) | Trigger-based push (kurye gecikme, no-show, müdavim soğuma) — partial | — |
| Broadcast | Hiç (manuel handler vardı, kapalı) | Segment broadcast UI (müdavimler / Bronz / soğuyan) + 24h window kontrolü | — |

---

## 2. Hedef: Satış Lokomotifi F&B SaaS

**Vizyon:** Bu SaaS'ı alan restoran sahibi menü+masa+sipariş+kurye+müşteri'yi tek yerde yönetir; müdavimini güçlendirir, soğumayı önler, combo/tatlı upsell ile ortalama hesabı yükseltir, kendi marketing'ini otomatize eder.

**Pazarlama vurgusu:** *"Onu sipariş veren bunu da denedi"* — POS yöneten her restoran bu SaaS'ı seçtiğinde otomatik olarak müdavim takibi, soğuma alarmı, combo upsell motoru ve restoran vitrini yanında gelir. Tek aboneliğin içinde 7 satış lokomotifi.

**Ölçülebilir hedefler (Faz A+B+C sonu, 6 ay):**
- Restoran ortalama hesap (sepet) büyüklüğü +%15 (combo + tatlı upsell)
- Müdavim soğuma (3+ ay gelmeyen) oranı -%30 (erken uyarı + kişiselleştirilmiş geri çağırma)
- Manuel kampanya / SMS hazırlama saati -%70 (trigger-based otomasyon)
- Masa turnover (akşam başı misafir) +%12 (rezervasyon + walk-in optimizasyon)
- Online sipariş ciro payı %0'dan %15'e (sub-domain vitrin + lead → POS)

---

## 3. 7 Satış Lokomotifi Katmanı

### 3.1 Müdavim Müşteri & Masa Verimlilik Skoru

- **3.1.1 Ne yapacak:** Her müşteriye 0-100 müdavimlik skoru (ziyaret sıklığı + sepet büyüklüğü + tip oranı + review). Her masaya verimlilik skoru (akşam turnover + ortalama hesap + masa-personel eşleşmesi).
- **3.1.2 Nasıl çalışır:**
  - Cron (haftalık) her müşteri için 4 alt-skor hesaplar (Sıklık / Sepet / Tip / Bağlılık).
  - Cron her masa için 3 alt-skor (Turnover / Ortalama Hesap / Personel Eşleşme).
  - Skorlar `restoran_customer_scores` + `restoran_table_scores` tablolarına yazılır + haftalık snapshot.
  - Dashboard'da müşteri listesi skor-sıralı (müdavim üstte), masa haritası renk kodlu skor overlay.
- **3.1.3 Backend:**
  - Migration: `restoran_customer_scores` (customer_id, period_start, score_total, sub_frequency, sub_basket, sub_tip, sub_loyalty, snapshot_at).
  - Migration: `restoran_table_scores` (table_id, period_start, turnover_count, avg_check, server_match_score, snapshot_at).
  - Helper: `src/platform/restoran-scoring/calculate.ts` — formula + persist (customer + table iki ayrı evaluator).
  - Cron: `/api/cron/restoran-scoring` (haftalık Pazartesi 03:00).
- **3.1.4 UI:**
  - `src/components/restoran/CustomerScoreBadge.tsx` (renk kodlu pill, Bronz/Gümüş/Altın label).
  - `src/components/restoran/TableEfficiencyOverlay.tsx` (masa haritasına skor overlay).
  - `musterilerim` liste sayfasında skor kolonu + sort.
  - `masalar` sayfasında "Verimlilik" filter + breakdown grafiği (12-hafta turnover trend).
- **3.1.5 Agent entegrasyonu:**
  - Yeni tool `get_customer_score` (customer_id veya top_n müdavim).
  - Yeni tool `get_table_efficiency` (table_id veya tüm masalar — düşük performans tabloda).
  - Yeni tool `compare_servers` (garson bazlı top-3 vs bottom-3 turnover karşılaştırma).
- **3.1.6 WA entegrasyonu:**
  - Aylık 1. gün cron: restoran sahibine "Müdavim raporu" push (ilk 5 müdavim + 5 soğuyan, panel link).
  - Skor 40'ın altına düşen müşteri (eski müdavim → soğuyor) için sahibi proactive uyarı.
- **3.1.7 Tahmini saat:** Tasarım 1 / Kod 6 / Test 2 = **9 saat**
- **3.1.8 Öncelik:** **Kritik** (Faz A — temel veri katmanı, diğer katmanlar bu skoru tüketir)
- **3.1.9 Marketing parlatma:** *"Müdavimini, soğuyanını ve hangi masanın gerçek para basanı olduğunu 0-100 skorla anında görür — ortalama hesabı 2 ayda %15 yukarı çekersin."*

---

### 3.2 Müdavim Soğuma Uyarısı (Churn Early Warning)

- **3.2.1 Ne yapacak:** Son 30/60/90 gün gelmeyen müdavim → "soğuyor" işaretlenir, restoran sahibine kişiselleştirilmiş geri çağırma teklifi sunulur.
- **3.2.2 Nasıl çalışır:**
  - View `restoran_loyal_cooling_signals`: son ziyaret tarihi, ortalama ziyaret aralığı (kendi normalinden sapma), skor düşüşü kombinasyonu.
  - 3 seviye: 🟢 Aktif Müdavim / 🟡 Soğumakta / 🔴 Kayıp Riski Yüksek.
  - Dashboard banner: "8 müdavimin soğuyor — Geri çağır"; tıklayınca kişiselleştirilmiş recovery flow (favori menü kalemine kupon).
- **3.2.3 Backend:**
  - Migration: SQL view `restoran_loyal_cooling_signals` (read-only, runtime).
  - Helper: `src/platform/restoran-churn/score.ts` — kişisel normalden sapma + threshold config.
  - Cron: `/api/cron/restoran-churn` (günlük 03:30) — eşik aşan müdavim için notification + skor güncelle.
- **3.2.4 UI:**
  - `musterilerim` liste sayfasına "🔴 Soğuyor" filter chip.
  - `/tr/restoran-mudavim-soguma` yeni sayfa: soğuyan müdavim tablo, "Geri çağırma teklifi" CTA (otomatik %15 favori kategori kuponu veya kişiselleştirilmiş WA mesajı).
  - `musterilerim/[id]` detayda "Soğuma Sinyalleri" kartı (son ziyaret, normal aralık, favori kategori).
- **3.2.5 Agent:**
  - Tool `get_cooling_loyals` (top_n) — agent sabah özetinde proactive sunar.
  - Tool `trigger_winback_offer` (customer_id, offer_type) — agent kişiselleştirilmiş kuponu taslar, sahibi onaylar.
- **3.2.6 WA:**
  - Müdavim 60 günü aştığında sahibine ⚠️ push.
  - Winback onayında müşteriye otomatik kupon mesajı (24h customer service window gate'i ile).
- **3.2.7 Tahmini saat:** Tasarım 1 / Kod 4 / Test 2 = **7 saat**
- **3.2.8 Öncelik:** **Kritik** (Faz A — skor ile aynı veri katmanı, anlık değer)
- **3.2.9 Marketing parlatma:** *"Müdavimini kaybetmeden 30 gün önce sistem haber verir — favori menü kalemine özel kupon ile geri çağrılır, müdavim kayıp oranı %30'a kadar düşer."*

---

### 3.3 Menü Combo & Tatlı Upsell Önerisi

- **3.3.1 Ne yapacak:** "Bunu söyleyenler bunu da seçti" — sipariş alırken garson tablet ekranında / online sipariş'te otomatik combo + tatlı + içecek upsell önerisi. Müdavim için kişiselleştirilmiş (geçmiş seçimleri).
- **3.3.2 Nasıl çalışır:**
  - Item-item co-occurrence: son 6 ay siparişlerde A kalemiyle birlikte sipariş edilen B kalemleri.
  - Margin + popularity weighting: yüksek marjlı tatlı/içecek önceliklendirilir.
  - Müdavim için kişiselleştirilmiş: müşterinin geçmiş favorilerinden çekilir.
  - Garson POS sepet ekranında "Bunu da öner" 3 kart; online sipariş checkout'unda aynı.
- **3.3.3 Backend:**
  - Migration: `restoran_combo_pairs` (item_a_id, item_b_id, co_occurrence_count, score, period_start) — cron yeniler.
  - Migration: `restoran_customer_preferences` (customer_id, favorite_item_ids JSONB, computed_at) — kişiselleştirilmiş öneri için.
  - Helper: `src/platform/restoran-recommendations/combo.ts`
  - Cron: `/api/cron/restoran-recommendations` (günlük 04:00)
- **3.3.4 UI:**
  - Garson POS sipariş ekranında "Bunu da öner" rail (3 kart, tek dokunuşla sepete ekle).
  - Self-order QR menüde sepet sayfasında aynı widget.
  - `musterilerim/[id]` detayda "Müdavimin favorileri" + "Bu müdavime öner" 5 kart.
- **3.3.5 Agent:**
  - Tool `suggest_combo_upsell` (current_cart_items[]) — agent garsona "şu anki masaya tatlı X öner" diyebilir.
  - Tool `bulk_menu_upsell_proposal` (segment) — admin için "ilk 20 müdavime yeni mevsim menü ön-erişim".
- **3.3.6 WA:**
  - Sipariş tamamlandıktan 1 saat sonra (paket/gel-al için) müşteriye "Bu siparişle yanına şu içecek harika gider — bir sonraki sipariş için %20 indirim" push (opt-in).
  - Müşteri tercih (notification_preferences `combo_suggestion` tipi).
- **3.3.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.3.8 Öncelik:** **Orta** (Faz B — 3.1 müdavim skoru + sipariş trendi paylaşır)
- **3.3.9 Marketing parlatma:** *"Her sipariş ekranında 'bunu söyleyenler bunu da seçti' önerisi — garson söyleyemediğinde sistem söyler, tatlı + içecek upsell ortalama hesabı sipariş başına %12-15 artırır."*

---

### 3.4 Otomatik Müdavim Kampanyaları (Trigger Sistemi)

- **3.4.1 Ne yapacak:** Trigger + condition + action kuralları: "Doğum günü 1 hafta önce kupon", "21 gün gelmeyen müşteriye WA hatırlatma", "Perşembe akşamı düşük rezervasyon → flash kampanya". Sahibi kuralı bir kez tanımlar, sistem çalıştırır.
- **3.4.2 Nasıl çalışır:**
  - Rule engine: event (doğum günü yaklaşıyor / ziyaretsizlik N gün / haftanın belirli akşamı düşük doluluk / yeni sezon menü) → koşul (müdavim seviyesi / segment / kategori tercihi) → aksiyon (kupon / WA mesajı / e-posta).
  - Cron event tarayıcı + kural eşleştirme + idempotency (aynı müşteriye aynı kural 30 gün içinde tekrarlamaz).
- **3.4.3 Backend:**
  - Migration: `restoran_campaign_triggers` (id, name, event_type, conditions JSONB, action_type, action_payload JSONB, active, last_run).
  - Migration: `restoran_campaign_executions` (trigger_id, customer_id, executed_at, status) — idempotency log.
  - Cron: `/api/cron/restoran-campaign-triggers` (saatlik) — event tara, kural çalıştır, kupon mint.
  - Helper: `src/platform/restoran-campaigns/rule-engine.ts`
- **3.4.4 UI:**
  - `/tr/restoran-kampanya-otomatik` yeni sayfa — kural listesi + 3-step wizard (event → segment → action).
  - "Yeni kural" formu: event dropdown (doğum günü / ziyaretsizlik N gün / haftanın günü düşük doluluk / yeni menü / sezon değişimi), segment seçici (müdavim seviyesi, favori kategori), aksiyon (kupon / WA mesajı / Instagram story DM).
  - Geçmiş çalıştırmalar tab — hangi kural hangi müşteriye ne zaman tetiklendi, dönüş (kullanım) oranı.
- **3.4.5 Agent:**
  - Tool `create_campaign_trigger` (kural taslağı hazırlar, sahibi onaylar).
  - Tool `list_active_campaigns` + `pause_campaign`.
  - Tool `suggest_quiet_night_campaign` — agent "bu perşembe rezervasyon düşük, flash kampanya önereyim mi?" der.
- **3.4.6 WA:**
  - Trigger çalıştığında müşteri WA'sına otomatik mesaj (template'ler `notification_preferences`'tan opt-out).
  - Sahibine haftalık özet: "5 kural çalıştı, 38 müşteri etkilendi, 12 sipariş döndü".
- **3.4.7 Tahmini saat:** Tasarım 2 / Kod 8 / Test 3 = **13 saat**
- **3.4.8 Öncelik:** **Orta** (Faz B — 3.1 skoru + 3.2 soğuma verisini condition'da kullanır)
- **3.4.9 Marketing parlatma:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın — doğum gününde kupon, 3 hafta gelmeyene 'seni özledik', perşembe akşamı flash kampanya. Manuel SMS/WA saatleri %70 azalır."*

---

### 3.5 Online Menü + Masa Rezervasyonu / Sipariş Vitrini

- **3.5.1 Ne yapacak:** Her restorana sub-domain `restoranai.upudev.nl/v/<restoran-slug>` — menü kategoriler + fotoğraflar + fiyatlar + "Masa Rezerve Et" + "Online Sipariş" (paket / gel-al / masada). Lead → restorana WA push.
- **3.5.2 Nasıl çalışır:**
  - Her restorana unique `vitrine_slug` (örn `restoranai.upudev.nl/v/cafe-vapur`).
  - Public sayfa: menü katalogu (fotoğraf + fiyat + alerjen + müdavim için Bronz/Gümüş/Altın fiyatlandırma), filtreler (kategori / vegan / vegeteryan), "Masa Rezerve Et" formu (tarih, saat, kişi, telefon, özel istek), "Online Sipariş" akışı (sepet + ödeme + paket/gel-al/masa seçimi).
  - Form submit → `restoran_reservations` veya `restoran_online_orders` insert → restorana anlık WA push, panelde bildirim.
  - Müdavim girişi (telefon doğrulama) → kendi seviyesine göre indirim otomatik uygulanır.
- **3.5.3 Backend:**
  - Migration: `restoran_vitrines` (restaurant_id, slug UNIQUE, theme JSONB, is_active, logo_url, brand_color, accept_reservations, accept_online_orders).
  - Migration: `restoran_online_orders` (id, restaurant_id, customer_phone, customer_name, items JSONB, total, fulfillment_type (paket/gel-al/masa), status, payment_status, source_slug, converted_pos_order_id).
  - Migration: `restoran_reservations` masa rezervasyon tablo (mevcut değilse genişletilir): web_source_slug eklenir.
  - Public route `/v/[slug]` (locale-aware) — auth yok, RLS allow anonymous insert.
  - Helper: `src/platform/restoran-vitrine/render.ts` + `src/platform/restoran-vitrine/availability.ts` (rezervasyon slot hesaplama).
- **3.5.4 UI:**
  - `/tr/restoran-vitrinim` (sahip-side) — vitrine editor: logo, renk, başlık, hangi menü kategorileri görünür, rezervasyon saat aralıkları, "Önizle" buton.
  - `/tr/restoran-online-siparisler` (sahip-side) — online sipariş listesi, onay/red, mutfak ticket'ına çevir, dönüşüm metriği.
  - `/v/[slug]` public menü + rezervasyon + sipariş (mobile-first, no-auth, müdavim için telefon ile giriş opsiyonel).
  - Müşteri-yüz vitrin: foto-rich, sezon menü öne çıkar, Instagram embed.
- **3.5.5 Agent:**
  - Tool `get_vitrine_leads` (date_range) — online sipariş + rezervasyon dönüşüm raporu.
  - Tool `suggest_vitrine_improvements` (low_conversion_categories) — düşük dönüşümlü menü kategorisine fotoğraf/açıklama önerisi.
- **3.5.6 WA:**
  - Yeni online sipariş → restorana anlık WA push ("Online sipariş: Cafe Vapur — 3 kalem, 450₺, paket").
  - Yeni rezervasyon → restorana push + müşteriye onay + 2 saat önce hatırlatma cron.
  - Online sipariş 5 dakikada kabul edilmezse sahibine + ortaklara escalation push.
- **3.5.7 Tahmini saat:** Tasarım 3 / Kod 10 / Test 5 = **18 saat** (yeni public route + rezervasyon slot logic + online ödeme entegrasyonu)
- **3.5.8 Öncelik:** **Düşük** (Faz C — bağımsız modül ama yeni gelir kanalı, müşteri-yüz yüzey)
- **3.5.9 Marketing parlatma:** *"Restoranın 7/24 internette — masa rezervasyonu, paket sipariş, gel-al. Müdavim seviyesine göre fiyat otomatik. Bir mağaza, online ciro %15 yukarı."*

---

### 3.6 Müşteri Drip — Sezon Menü, Doğum Günü, Müdavim Yolculuğu

- **3.6.1 Ne yapacak:** 5-7 mesajlık otomatik drip dizileri: yeni müşteri (3 ziyaret altı) onboarding 5-mesaj, müdavim VIP yolculuğu (10 ziyaret hedefi), sezon menü duyuru drip, soğuyan müdavim recovery dizisi.
- **3.6.2 Nasıl çalışır:**
  - Drip = `restoran_drip_campaigns` + `restoran_drip_steps` (step_order, delay_days, channel, template, condition).
  - Müşteri belirli "audience" girer (yeni / müdavim VIP yolculuğu / soğuyan / sezon abone) → drip otomatik tetiklenir.
  - Cron her gün step delay'i kontrol eder, mesajları gönderir, log tutar.
- **3.6.3 Backend:**
  - Migration: `restoran_drip_campaigns` (id, name, audience JSONB, channel, active).
  - Migration: `restoran_drip_steps` (campaign_id, step_order, delay_days, channel, template, send_condition).
  - Migration: `restoran_drip_enrollments` (campaign_id, customer_id, enrolled_at, current_step, status).
  - Migration: `restoran_drip_sends` (enrollment_id, step_id, sent_at, status, error).
  - Cron: `/api/cron/restoran-drip` (saatlik) — pending step'leri gönder.
  - Helper: `src/platform/restoran-marketing/drip-engine.ts` (yatay `bayi-marketing/drip-engine.ts` pattern'inin restoran adapter'ı).
- **3.6.4 UI:**
  - `/tr/restoran-marketing` yeni sayfa — drip listesi.
  - Drip editor (5-step wizard): audience seç (yeni / müdavim / soğuyan / sezon), kanal (WA / e-posta), step ekle (delay + template), önizle.
  - Segment builder: skor aralığı, son ziyaret, favori kategori, doğum günü ay.
  - Broadcast formu: tek seferlik mesaj segment'e gönder (örn yeni sezon menü duyuru).
- **3.6.5 Agent:**
  - Tool `create_drip_campaign` — agent kullanıcıyla konuşarak drip taslağı hazırlar.
  - Tool `get_drip_performance` — açılma / sipariş dönüşüm raporu.
  - Tool `suggest_audience_for_seasonal_menu` — yeni sezon menüye uygun müdavim segment'i seç.
- **3.6.6 WA:**
  - Tüm drip mesajları WA Cloud API üzerinden (24h customer service window gate helper'da).
  - WA başarısızsa e-posta fallback (SES/Postmark) — Faz C'de e-posta provider ekle.
- **3.6.7 Tahmini saat:** Tasarım 3 / Kod 9 / Test 4 = **16 saat**
- **3.6.8 Öncelik:** **Düşük** (Faz C — 3.4 trigger ile örtüşür; trigger = anlık tek mesaj, drip = zamana yayılmış dizi)
- **3.6.9 Marketing parlatma:** *"Yeni müşteri onboarding, müdavim VIP yolculuğu, sezon menü duyuru — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu konuşur; manuel ekip değil sistem müdavim yetiştirir."*

---

### 3.7 Arkadaş Davet Et — İkiniz de Tatlı Hediye

- **3.7.1 Ne yapacak:** Müdavim arkadaş davet eder, davet edilenin ilk hesabında ikisi de tatlı / aperitif / içecek kuponu kazanır. Sosyal medya share intent (Instagram story tek-tıkla paylaşım).
- **3.7.2 Nasıl çalışır:**
  - Müşteri WA / panel "Arkadaşını Davet Et" akışı — unique link + Instagram story share button + WhatsApp share.
  - Davet edilen restorana gelip ilk hesabını kapatınca → `restoran_referrals.status='earned'` + her iki tarafa kupon mint.
  - Kuponlar otomatik müdavim profilinde görünür, bir sonraki ziyarette garson POS'ta tek dokunuşla uygulanır.
- **3.7.3 Backend:**
  - Migration: `restoran_referral_codes` (code, customer_id, created_at, expires_at, max_uses, current_uses).
  - Migration: `restoran_referrals` (referrer_customer_id, referred_customer_id, code_id, status, reward_item_id, reward_value, earned_at, applied_at).
  - Migration: `restoran_customer_rewards` (customer_id, item_or_credit, balance, last_movement_at) + `restoran_reward_movements` (delta, source, reference_id).
  - Helper: `src/platform/restoran-referral/engine.ts` (yatay `bayi-referral/engine.ts` adapter'ı — ledger ortak, reward "tatlı item" config).
  - Trigger: yeni POS sipariş kapatma → referrer kupon kontrolü + tahakkuk.
- **3.7.4 UI:**
  - `/tr/restoran-davet-et` müşteri-side (müdavim portal) — unique kod, Instagram story share button (1080x1920 template), WhatsApp share button, kazanım grafiği.
  - Garson POS sipariş ekranında "Müdavim kuponu var" çip + tek dokunuşla uygula.
  - Sahibi görünüm `/tr/restoran-referans-yonet` — toplam referans, top referrer müdavim, kupon kullanım oranı.
- **3.7.5 Agent:**
  - Tool `get_referral_status` (customer_id).
  - Tool `top_referrers` — sahibi için aylık top 10 davet eden müdavim.
- **3.7.6 WA:**
  - Davet edilen ilk gelip hesap kapatınca referrer'a "Davetin geldi, ikinize tatlı hediye kuponu hazırladık" push.
  - Müdavim sonraki ziyaretten 2 gün önce "Kazandığın tatlı kuponu seni bekliyor" hatırlatma.
- **3.7.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.7.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, viral büyüme + sosyal medya intent)
- **3.7.9 Marketing parlatma:** *"Müdavim arkadaşını davet eder, ikisine de tatlı hediye — Instagram story tek tıkla paylaşılır. Sen para vermeden müdavim sayın büyür, viral büyüme: ilk 6 ayda müşteri tabanı +%25."*

---

### 3.8 Aktif Öneri Motoru (Yatay — Tüm SaaS'larda Aynı Pattern)

- **3.8.1 Ne yapacak:** Panel açar açmaz "Sana özel 3 öneri" — sistem son N gün veriyi tarayıp aksiyona dönüşebilen kısa tavsiyeler sunar. Örn: *"Bu hafta 5 müdavimin soğumakta — kişiselleştirilmiş geri çağırma gönder"*, *"Stok düşen 3 malzeme — tedarikçi sipariş hazırla"*, *"Bu perşembe rezervasyon doluluk %30 — flash kampanya öner"*, *"Yeni sezon menü hazır — ilk 50 müdavime ön-erişim duyurusu"*, *"Garson Ahmet'in masa turnover'ı %25 düştü — performans uyarı"*.
- **3.8.2 Nasıl çalışır:**
  - Rule registry — restoran için 5-7 öneri kuralı (müdavim soğuma, stok düşüş, rezervasyon doluluk düşük tetik, sezon menü hatırlatma, personel performans uyarı, kuralı/no-show oranı yüksek, hava durumu + paket sipariş tahmin).
  - Saatlik cron tüm rule'ları evaluate eder; eşik aşıldığında `recommendation_runs` row açılır (idempotency: aynı user × rule × hedef 24h kapalı).
  - Dashboard widget en yüksek skorlu 3 öneri gösterir (skor = recency × impact × actionability).
  - Action button 1-tıkla aksiyona: kupon mint / WA broadcast taslağı / sipariş ekranı deeplink / kampanya tetik / stok sipariş.
  - **Yatay yapı:** engine tenant-agnostic (`src/platform/recommendations/engine.ts`), restoran kendi `src/tenants/restoran/recommendations.ts` adapter'ı verir (RESTORAN_RULES registry + evaluator). Bayi'de "sipariş vermeyen bayi", restoran'da "soğuyan müdavim", emlak'ta "30 gün ulaşılamayan müşteri" gibi sektörel kurallar.
- **3.8.3 Backend:**
  - Migration: `recommendation_rules` (zaten yatay yapıda var — restoran rule code'ları seed edilir).
  - Migration: `recommendation_runs` (zaten yatay yapıda var).
  - Helper: `src/platform/recommendations/engine.ts` (ortak, bayi fazında yazılır).
  - Tenant adapter: `src/tenants/restoran/recommendations.ts` — restoran kuralları (RESTORAN_RULES: müdavim soğuma, kritik stok, rezervasyon düşük tetik, sezon menü hatırlatma, personel performans uyarı, no-show yüksek müşteri, kurye gecikme pattern).
  - Cron: `/api/cron/recommendations` (saatlik) — tüm tenant adapter'ları çalıştırır (ortak cron).
- **3.8.4 UI:**
  - `src/components/recommendations/RecommendationCard.tsx` — yatay component (bayi'de yazılır, restoran-panel'da reuse).
  - `restoran-panel` dashboard üstüne mount — "Sana özel 3 öneri" başlık + 3 kart.
  - `/tr/restoran-oneriler` full liste sayfası — geçmiş + dismissed dahil, filter (open/acted/dismissed), severity badge.
  - Action handler modal'ları: WA broadcast taslak modal, kupon mint modal, stok sipariş pre-fill modal, kampanya wizard deeplink.
- **3.8.5 Agent:**
  - Tool `get_recommendations` (limit=5) — son 24h `recommendation_runs status='open'` listesi (yatay, ortak tool).
  - Tool `act_on_recommendation` (run_id, choice='accept'|'dismiss') — action_type'a göre downstream tool çağırır (örn `act → trigger_winback_offer` veya `act → suggest_quiet_night_campaign`).
  - Agent prompt'a context: "şu an N öneri açık" — chat başında proactive sunabilir.
- **3.8.6 WA:**
  - Severity='high' öneri 6 saatte action edilmezse sahibe WA hatırlatma.
  - Action sonucu downstream sendNotification helper çalıştırır.
- **3.8.7 Tahmini saat:** Tasarım 1 / Kod 3 / Test 1 = **5 saat** (yatay engine bayi'de yazılı, restoran sadece adapter + UI mount)
- **3.8.8 Öncelik:** **Orta** (Faz B — 3.1 skor + 3.2 soğuma + 3.3 combo verilerini tüketir). **Yatay yapı:** engine + UI component diğer 5 SaaS'da aynı koddur; restoran yalnız `recommendations.ts` adapter dosyası ekler.
- **3.8.9 Marketing parlatma:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi müdavime geri çağırma atılmalı, hangi malzeme sipariş edilmeli, hangi perşembe kampanya çalıştırılmalı söyler. Tıkla, yapsın. Beyin gibi düşünür, garson gibi koşar."*

---

## 4. Faz Sırası

### Faz A — Hızlı Kazanç (1-2 hafta, **Kritik**)

**Kapsam:** 3.1 Müdavim & Masa Verimlilik Skoru + 3.2 Müdavim Soğuma Uyarısı

**Gerekçe:**
- Her ikisi aynı veri katmanını (sipariş geçmişi + müşteri telefon + rezervasyon) tüketir — paralel implement edilebilir.
- Anlık değer: ilk gün sahibi paneli açtığında "8 müdavimin soğumakta" banner'ı görür → SaaS değerinin somut kanıtı.
- Diğer katmanlar (3.3 combo, 3.4 kampanya) skor/soğuma verisini condition'da kullanır — Faz A altyapı.
- Migration risk düşük (yeni tablo + view, yıkıcı değişiklik yok). Mevcut `customers` + `orders` tabloları okunur.

**Tahmini:** 16 saat

### Faz B — Orta (3-4 hafta)

**Kapsam:** 3.3 Combo & Tatlı Upsell + 3.4 Otomatik Müdavim Kampanyaları + **3.8 Aktif Öneri Motoru**

**Gerekçe:**
- Faz A'nın müdavim skoru + soğuma verisini segment/condition olarak kullanır.
- Combo öneri motoru bağımsız ama ortak `restoran-recommendations` modülünde toplanır.
- Otomatik kampanya kural motoru: en yüksek manuel-iş-azaltma kazancı, pitch'inde "70% manuel azaltma" iddiası buradan.
- **3.8 Aktif Öneri Motoru** Faz A+B'nin tüm output'larını (skor, soğuma, combo, kampanya tetiği) tek widget'a toplar. **Yatay yapı:** engine + UI bayi fazında yazılı, restoran yalnız adapter ekler — minimum saat.

**Tahmini:** 29 saat (11 + 13 + 5)

### Faz C — Uzun Vadeli (5-8 hafta)

**Kapsam:** 3.5 Online Menü + Rezervasyon Vitrini + 3.6 Müşteri Drip + 3.7 Arkadaş Davet

**Gerekçe:**
- 3.5 Vitrin: yeni public route + rezervasyon slot logic + online ödeme, en kapsamlı modül; yeni gelir kanalı (online sipariş %15 hedef).
- 3.6 Drip: 3.4 trigger sistemini genişletir, time-based dizilere taşır; sezon menü ve müdavim VIP yolculuğu burada.
- 3.7 Referans: bağımsız viral büyüme aracı, Instagram story share intent ile sosyal medya leverage.
- Faz C bittiğinde "F&B satış lokomotifi" söylemi tam olarak savunulabilir hale gelir.

**Tahmini:** 45 saat

---

## 5. Toplam Saat Tahmini

| Katman | Tasarım | Kod | Test | Toplam |
|--------|---------|-----|------|--------|
| 3.1 Müdavim & Masa Verimlilik Skoru | 1 | 6 | 2 | **9** |
| 3.2 Müdavim Soğuma Uyarısı | 1 | 4 | 2 | **7** |
| 3.3 Combo & Tatlı Upsell | 2 | 6 | 3 | **11** |
| 3.4 Otomatik Müdavim Kampanyaları | 2 | 8 | 3 | **13** |
| 3.5 Online Menü + Rezervasyon Vitrini | 3 | 10 | 5 | **18** |
| 3.6 Müşteri Drip (Sezon / Doğum Günü / VIP) | 3 | 9 | 4 | **16** |
| 3.7 Arkadaş Davet Et (Tatlı Hediye) | 2 | 6 | 3 | **11** |
| 3.8 Aktif Öneri Motoru (yatay adapter) | 1 | 3 | 1 | **5** |
| **TOPLAM** | **15** | **52** | **23** | **90 saat** |

**Faz bazında:** Faz A 16h · Faz B 29h · Faz C 45h
**Kalibrasyon notu:** Mevcut restoran-panel + POS + rezervasyon altyapısı temel oluşturuyor. 3.8 yatay engine bayi'den paylaşılan kazanç (~5h adapter). Bu plan ~90 saat = realistik olarak 3-4 hafta yoğun tempoda, 2 ay rahat tempoda.

---

## 6. Bağımlılıklar ve Riskler

### Üçüncü taraf entegrasyon
- **Mollie:** mevcut — 3.5 online sipariş ödeme + 3.7 referans kupon code akışı eklenecek (discount stack + paket teslimat fee).
- **WA Cloud API:** mevcut — 3.4/3.6 broadcast'lerde **24-saat customer service window** gate zorunlu. Template message Meta onay 3-5 gün; mümkün olduğunca freeform (sipariş sonrası 24h içinde mesaj).
- **E-posta SES/Postmark:** 3.6'da fallback için yok — eklenmesi gerekir veya başlangıçta WA-only drip.
- **Instagram Graph API:** 3.7 story share intent için (optional) — başlangıçta web share intent (URL-based) ile başlanır, Faz C ileride.
- **Hava durumu API:** 3.8 paket sipariş tahmin kuralı için (optional) — başlangıçta basit takvim eventi (perşembe/cuma).

### Veri kalitesi gereksinimleri
- **3.1 + 3.2** için en az **3 ay** sipariş + müşteri telefon eşleşmesi gerekir. Yeni restoran'da "Yeterli müdavim verisi yok" placeholder; cron 60 günden sonra anlamlı skor.
- **3.3 Combo** için en az **200 sipariş** tarihçesi gerek; altında "İstatistik birikiyor" UI + admin manuel combo tanımlama fallback.
- **3.5 Online sipariş** için fotoğraf bulk upload gereği yüksek — eksik fotoğraf → düşük dönüşüm. Onboarding'de "İlk 20 ürün fotoğrafı yükle" zorunlu task.

### DB migration kuralları (CLAUDE.md)
- 14-digit timestamp prefix, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- DROP/destructive ALTER → ASK first.
- Worker SQL dosyasını yazar + `supabase db push` ile apply eder + commit + push. Migration `supabase/migrations/`, `.planning/migrations/` değil.

### Backward compat
- WA komut router devre dışı (RESTORAN_COMMANDS_ENABLED=false) — Faz B/C broadcast UI'sı yeni route kullanacak, eski komut dosyaları inert.
- agent_quotas plan_key Mollie webhook ile sync — 3.4 kupon tetiği `subscriptions.amount`'a dokunmaz; yalnız `restoran_customer_rewards` ledger'ında çalışır.
- `notifications` tablosu mevcut — 3.4/3.6 mesaj sendNotification helper'a düşer, audit trail merkezi.
- Garson POS mevcut akışı bozulmaz — combo öneri rail "opsiyonel widget" olarak eklenir, hızlı sipariş hala 2 dokunuş.

### Risk haritası
| Risk | Olasılık | Etki | Karşı önlem |
|------|----------|------|-------------|
| Müdavim skoru subjektif → sahibi güvensiz | Orta | Yüksek | Açık formül + tooltip breakdown + manual override + "neden bu skor" tıklanabilir |
| WA 24h window ihlali → Meta hesap askısı | Düşük | Çok yüksek | `shouldNotify` gate'inde `last_inbound_at` kontrolü zorunlu |
| Drip spam → müşteri opt-out + 1-yıldız review | Orta | Yüksek | Step başına opt-out link + frequency cap (haftalık max 1 mesaj) + 22:00 sonrası gönderim yasak |
| Online sipariş zamanlama hatası (kurye yetişmez / mutfak dolu) | Yüksek | Orta | Sipariş kabul gate'i: mutfak hazırlık süresi + kurye müsait kontrolü, otomatik tahmini süre tampon |
| Vitrine slug çakışması | Düşük | Düşük | UNIQUE + auto-suffix (-2, -3) |
| Referans kupon stack abuse | Orta | Orta | Max 1 kupon/hesap + monthly cap + müşteri telefon dedup |
| Combo öneri yanlış (vegan müşteriye et upsell) | Orta | Orta | Müşteri alerjen/diyet flag → öneri filter zorunlu |
| Self-order QR akışı ödeme kaybı (müşteri masada bırakıp gider) | Düşük | Orta | QR'da ödeme önce alın (kart ön-otorize) veya garson onay step'i |

---

## 7. Kabul Kriterleri (Acceptance)

### Faz A bitince
- [ ] Sahibi `/tr/musterilerim` → liste'de "Müdavim Skoru" kolonu, sort çalışıyor, Bronz/Gümüş/Altın badge görünüyor
- [ ] Sahibi `/tr/musterilerim/[id]` → "Müdavimlik" tabı 4 alt-skor + 12-hafta ziyaret trend grafiği
- [ ] Sahibi `/tr/masalar` → masa haritasında verimlilik renk overlay, masa detayında turnover/avg check
- [ ] Sahibi `/tr/restoran-panel` → "8 müdavim soğumakta" banner görünüyor
- [ ] `/tr/restoran-mudavim-soguma` sayfa açılıyor, geri çağırma teklifi CTA çalışıyor
- [ ] Cron `restoran-scoring` haftalık, `restoran-churn` günlük schedule'a alındı, manuel test başarılı
- [ ] Agent `get_customer_score` + `get_cooling_loyals` + `get_table_efficiency` tool'ları çalışıyor
- [ ] WA: skor 40 altına düşen müdavim tetiği sahibe ulaştı (test müşteri ile)

### Faz B bitince
- [ ] Garson POS sepet ekranında "Bunu da öner" rail 3 kart gösteriyor, tek dokunuşla sepete ekleniyor
- [ ] `/tr/restoran-kampanya-otomatik` sayfa açıyor, "Yeni Kural" wizard tamam (doğum günü / ziyaretsizlik / perşembe düşük doluluk)
- [ ] Trigger çalıştığında: müşteri WA mesajı, geçmiş tab'da log var, idempotency 30 gün
- [ ] Cron `restoran-recommendations` günlük, `restoran-campaign-triggers` saatlik
- [ ] Agent `suggest_combo_upsell` + `create_campaign_trigger` + `suggest_quiet_night_campaign` tool'ları çalışıyor
- [ ] `restoran-panel` üstüne "Sana özel 3 öneri" widget — 3 öneri görünür (soğuma/stok/doluluk/sezon karışımı)
- [ ] Öneri kartında 1-tıkla aksiyon: kupon mint / WA broadcast / kampanya wizard deeplink / stok sipariş pre-fill
- [ ] `/tr/restoran-oneriler` full liste sayfası (filter: open/acted/dismissed)
- [ ] Agent `get_recommendations` + `act_on_recommendation` tool'ları çalışıyor
- [ ] Severity='high' öneri 6 saatte acted değilse sahibi WA hatırlatma alındı

### Faz C bitince
- [ ] `/v/<slug>` public menü + rezervasyon + online sipariş sayfası açıyor (auth-free), form submit edilebiliyor
- [ ] Online sipariş → restoran WA push + panel bildirim + mutfak ticket'ına dönüşüm akışı tam
- [ ] Rezervasyon → 2 saat önce müşteriye hatırlatma cron çalıştı
- [ ] `/tr/restoran-marketing` drip editor 5-step wizard tamam (yeni / VIP / soğuyan / sezon audience)
- [ ] Müdavim `/tr/restoran-davet-et` unique kod görüyor, Instagram + WA share çalışıyor; davet → ilk hesap → ikisine tatlı kuponu tahakkuk
- [ ] Garson POS'ta "Müdavim kuponu var" chip + tek dokunuş uygulama çalışıyor
- [ ] Sahibi `/tr/restoran-referans-yonet` top referrer + kupon kullanım metrikleri görüyor

---

## 8. Pazarlama Mesajları (Sales-Ready Liste)

Her katman için landing page, demo, satış sunumunda kullanılabilir 1-2 cümlelik vurgu:

- **3.1 Müdavim & Masa Verimlilik Skoru:** *"Müdavimini, soğuyanını ve hangi masanın para basanı olduğunu 0-100 skorla anında görür — ortalama hesabı 2 ayda %15 yukarı çekersin."*
- **3.2 Müdavim Soğuma:** *"Müdavimini kaybetmeden 30 gün önce sistem haber verir — favori kalemine özel kuponla geri çağırır, müdavim kayıp oranı %30'a kadar düşer."*
- **3.3 Combo & Tatlı Upsell:** *"Her sipariş ekranında 'bunu söyleyenler bunu da seçti' önerisi — garson söyleyemediğinde sistem söyler, ortalama hesap sipariş başına %12-15 artar."*
- **3.4 Otomatik Müdavim Kampanyaları:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın — doğum gününde kupon, 3 hafta gelmeyene 'seni özledik', perşembe akşamı flash kampanya. Manuel SMS/WA saatleri %70 azalır."*
- **3.5 Online Menü + Rezervasyon Vitrini:** *"Restoranın 7/24 internette — masa rezervasyonu, paket sipariş, gel-al. Müdavime özel fiyat otomatik. Online ciro %15 yukarı, no-show oranı %40 aşağı."*
- **3.6 Müşteri Drip:** *"Yeni müşteri onboarding, müdavim VIP yolculuğu, sezon menü duyuru — hepsi otomatik 5-mesajlık dizilerle. Sistem yıl boyu konuşur, manuel ekip değil sistem müdavim yetiştirir."*
- **3.7 Arkadaş Davet Et:** *"Müdavim arkadaşını davet eder, ikisine tatlı hediye — Instagram story tek tıkla paylaşılır. Sen para vermeden ağ büyür, viral büyüme: ilk 6 ayda müşteri tabanı +%25."*
- **3.8 Aktif Öneri Motoru:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi müdavime geri çağırma atılmalı, hangi malzeme sipariş edilmeli, hangi perşembe kampanya çalıştırılmalı söyler. Tıkla, yapsın. Beyin gibi düşünür, garson gibi koşar."*

**Üst başlık vurgu (landing hero):**
*"UPU Restoran — menü + masa + sipariş + kurye yetmez. Müdavimini büyütür, soğumayı önler, ortalama hesabı arttırır, marketing'ini otomatize eder. Bir abonelik, 7 satış lokomotifi."*

---

## 9. Yatay Yapı (Tüm Tenant'larda Aynı Engine)

UPU Platform 6 SaaS'ı (bayi / emlak / market / otel / restoran / siteyonetim) ortak motor ve UI component'leri paylaşır. Restoran kendi sektörel kuralları için **adapter** yazar, motoru yeniden yazmaz.

| Yatay Modül | Konum | Restoran Adapter | Saat (adapter) |
|-------------|-------|------------------|----------------|
| **Aktif Öneri Motoru** (3.8) | `src/platform/recommendations/engine.ts` | `src/tenants/restoran/recommendations.ts` — RESTORAN_RULES registry (müdavim soğuma, kritik stok, rezervasyon doluluk, sezon menü, personel performans) | ~2 saat |
| **Online Vitrin / Lead** (3.5) | `src/platform/bayi-vitrine/` pattern paylaşılır; restoran için `src/platform/restoran-vitrine/` (rezervasyon slot logic eklenir, geri kalan render/SEO/slug aynı) veya unified `src/platform/vitrine/` namespace | Restoran rezervasyon + menü + online sipariş özelleştirme | ~3 saat (slot logic için ek) |
| **Drip Engine** (3.6) | `src/platform/bayi-marketing/drip-engine.ts` (cron, step scheduler, send tracker yatay) | `src/platform/restoran-marketing/drip-engine.ts` audience adapter farklı (segment: müdavim / yeni / soğuyan / sezon abone) | ~2 saat |
| **Referans Engine** (3.7) | `src/platform/bayi-referral/engine.ts` (ledger ortak, reward type config) | `src/platform/restoran-referral/engine.ts` reward type "tatlı item kuponu" + Instagram share intent eklenir | ~2 saat |
| **Notifications Send** | `src/platform/notifications/send-notification.ts` (ortak — WA / e-posta / push dispatcher, opt-out gate, 24h window kontrolü) | Yok, doğrudan kullanılır | 0 saat |

**Yatay yapı kazancı:** Faz B'de bayi `recommendations/engine.ts` yazıldığında restoran sadece 2 saatte adapter ekleyerek aynı widget'ı tüm tenant'larda kullanır. Drip, vitrin, referans için aynı pattern — her yeni SaaS marjinal maliyetle yeni özelleştirme alır. 6 SaaS × 4 yatay modül = 24 entegrasyon, ortak motorla **toplam ~48 saat adapter** (motor yeniden yazılsa **240+ saat** olurdu).

**Restoran-spesifik unique kod (yatay değil):**
- POS combo upsell rail (`src/tenants/restoran/components/ComboRail.tsx`)
- Masa verimlilik scorer (`src/platform/restoran-scoring/calculate.ts` — table evaluator)
- Self-order QR akışı (varsa Faz D'ye taşınır)
- Mutfak ticket entegrasyonu (online sipariş → POS dönüşümü)

---

## 10. Sıradaki Adım

Bu master plan Çağrı tarafından onaylandıktan sonra:

1. **Faz A başlatma:**
   - Worker: restoran (tmux upu-restoran)
   - İlk commit: `feat(db): restoran_customer_scores + restoran_table_scores + loyal_cooling_signals view migration`
   - İkinci commit: `feat(restoran-scoring): cron + helper (calculate.ts, customer + table evaluators)`
   - Üçüncü commit: `feat(restoran): /tr/restoran-mudavim-soguma + customer score badge + müşterilerim liste sort`
   - 4. commit: `feat(restoran): masalar verimlilik overlay + 12-hafta trend`
   - 5. commit: `feat(agent/restoran): get_customer_score + get_cooling_loyals + get_table_efficiency tools`

2. **Sprint task'larına böl:** Faz A her katman için 4-5 task (DB migration → API → UI → cron → agent tool → WA template → kabul testi).

3. **Yatay yapı bağımlılığı:** 3.8 Aktif Öneri Motoru için bayi worker'ın motor + UI component yazdığı Faz B tamamlanmasını bekle. Bayi tamamlanana kadar restoran Faz A + 3.3 + 3.4 paralel ilerleyebilir; 3.8 adapter en sona.

4. **Versiyonlama:** Her sprint sonunda bu doküman `Versiyon 1.1`, `1.2` şeklinde güncellenir. "Tamamlandı / Devam / Plan" durumları her katman üstüne işaretlenir.

---

*Bu doküman restoran worker (`tmux upu-restoran`) tarafından 2026-05-22 tarihinde üretildi. Onay sonrası Faz A başlatılır.*
