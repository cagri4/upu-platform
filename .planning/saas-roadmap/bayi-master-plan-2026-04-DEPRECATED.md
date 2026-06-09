# Bayi SaaS — Master Plan (Satış Lokomotifi Dönüşümü)

> **Tarih:** 2026-05-21
> **Versiyon:** 1.1 — Katman 3.8 (Aktif Öneri Motoru) eklendi, yatay yapı tüm SaaS'lara uygulanır
> **Sahibi:** Çağrı
> **Worker:** bayi (tmux upu-bayi)
> **Durum:** Onay bekliyor — Faz A başlatma için

---

## 1. Mevcut Durum (5 Açılı Değerlendirme)

### 1.1 UI Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Panel sayfaları | 27 sayfa (panel, siparişler, cari, fatura, stok, bildirim, kullanıcı, ayarlar, billing, vade, kampanya, ürünler, raporlar, takvim, profil…) | Onboarding tour akışı (skeleton var, akış yok), analytic dashboard (grafik/drill-down), audit log sayfası | `bayi-takvim` minimal — placeholder, `bayi-vade-hatirlatma` minimal |
| Sidebar nav | Role-aware (admin/muhasebe/depocu/satış), separatorBefore gruplama | Sub-menu collapse yok (uzun liste tek seviye) | — |
| Mobile UX | Bottom drawer + topbar, responsive grid | Native app feel zayıf (PWA installable test edilmedi) | — |
| Agent widget | Sağ alt floating, slide-in panel, 3 katman quota UX | Streaming yok (token-by-token akış), suggestion chip dinamik değil | — |
| Bell + bildirim merkezi | Topbar bell badge, geçmiş sayfası, filter | Browser push (Web Push API), e-posta fallback | — |

### 1.2 Dağıtıcı (Admin) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Bayi yönetimi | Liste, detay, vade/risk/timeline, davet (statik + dynamic) | **Performans skoru, churn risk göstergesi**, bayi segmentasyonu, sahaya çıkma takvimi | — |
| Sipariş | B2B portal akışı (pending→approved→shipped→delivered), durum makinesi, onay/red | Sipariş tahmini gelir grafiği (aylık), tekrar sipariş otomasyonu | — |
| Finans | Cari ekstre, fatura, tahsilat (dekont upload), vade kontrolü | Otomatik tahsilat hatırlatma (cron var ama UI'da yapılandırılamıyor) | — |
| Ürün/stok | CRUD, bulk import, stok hareket log, kritik uyarı (Sprint 2) | Trendyol/Hepsiburada feed export, ABC analizi | — |
| Kampanya | CRUD, dealer targeting, broadcast | **Trigger-based otomatik kampanya**, segment-based broadcast | — |
| Marketing | Hiç yok | Drip campaign, e-posta, WA broadcast UI | — |
| Kullanıcı yönetim | Çalışan + bayi + pending davet (Sprint 1) | Audit log (kim ne yaptı), aktivite zaman çizelgesi | — |
| Billing | Mollie 4-tier (Free/Starter/Pro/Premium), iptal, fatura geçmişi (Sprint 3) | Yıllık ödeme (₺ %15 indirim), kupon kodu, ek paket (sınırsız mesaj) | — |

### 1.3 Bayi (Reseller) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Bayi onboarding | `/davet/<tenant>/<slug>` statik kayıt, davet linkleri | İlk kayıt sonrası rehberli tur, eğitim videoları | — |
| Sipariş ver | `bayi-siparis-ver` (dealer-side), siparişlerim | "Hızlı sipariş" (favori SKU), tekrar sipariş, sepet "kaydet" | — |
| Finans görünüm | Bakiyem, faturalarım, ödemelerim | **Kendi müşteri ekstresi** (bayi B2C tarafı için), nakit akış öngörüsü | — |
| Online vitrin | **Hiç yok** | Bayinin son müşterisi için sub-domain veya gömülebilir widget, lead form | — |
| Kendi müşterisi | Yok | CRM-lite: lead, hatırlatma, çağrı log | — |
| Sahaya çıkış | Yok | Mobile-first çağrı listesi, "bugün ara" zaman çizelgesi | — |

### 1.4 UPU Claude Agent (AI Eleman) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Tools | 5 tool: `list_orders`, `get_kpi_summary`, `get_account_statement`, `list_overdue_invoices`, `send_dealer_message` | `get_dealer_score`, `get_churn_risks`, `suggest_cross_sell`, `create_campaign`, `segment_dealers`, `route_lead` | — |
| Quota | 4 plan tier (Free 50 / Starter 300 / Pro 1500 / Premium 5000), 3 katman UX, period renewal cron | Quota detay sayfası (token + cost grafiği), suggestion engine (kullanmadığı feature öner) | — |
| Prompt | Tenant-aware (bayi prompt), `cache_control: ephemeral` | Streaming SSE, 5 mod karakter geçiş (özet/teşvik/Q&A) | — |
| Proactive | Yok (kullanıcı sormadan agent açılmaz) | Sabah özeti push, kritik durumda agent-initiated mesaj | — |
| Defense | Cross-tenant `saveMessage` guard, tool tenant assert | — | — |

### 1.5 WhatsApp Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| WA pivot | Komut router devre dışı, fallback "Paneli aç" link, notif button handler korunur | — | 37 legacy komut handler dosyası (BAYI_COMMANDS_ENABLED=false ile inert; rollback için duruyor) |
| Notification push | `sendText` / `sendUrlButton` / `sendNotification`, tercih/DND gate | **Bayi-tarafı WA bot** (bayi kendi müşterisine WA atabilsin), drip scheduler | — |
| Sabah brifing | Cron, bayi için kısaltıldı (200 char + panel link) | Trigger-based push (sipariş onay, ödeme alındı, churn risk) — partial | — |
| Broadcast | Hiç (manuel sendButtons handler vardı, kapalı) | Segment broadcast UI + WA Cloud API 24h gate kontrolü | — |

---

## 2. Hedef: Satış Lokomotifi B2B SaaS

**Vizyon:** Bu SaaS'ı alan dağıtıcı satış+tahsilat+yönetim'i tek yerde yapar; bayilerini güçlendirir, churn'ü azaltır, cross-sell ile cirosu artar, kendi marketing'ini otomatize eder.

**Pazarlama vurgusu:** *"Onu alan bunu da aldı"* — sipariş yöneten her dağıtıcı bu SaaS'ı seçtiğinde otomatik olarak performans takibi, churn alarmı, cross-sell motoru ve sahadaki bayi vitrini yanında gelir. Tek aboneliğin içinde 7 satış lokomotifi.

**Ölçülebilir hedefler (Faz A+B+C sonu, 6 ay):**
- Dağıtıcı bayi-başı aylık ciro +%18 (cross-sell + kampanya tetik)
- Bayi churn oranı -%30 (erken uyarı + recovery drip)
- Manuel kampanya hazırlama saati -%70 (trigger-based otomasyon)
- Bayi NPS +20 puan (vitrine + lead routing değer katar)
- Aylık ücretli abonelik upgrade oranı (Starter→Pro) +%25 (Pro-only özellikler vurguda)

---

## 3. 7 Satış Lokomotifi Katmanı

### 3.1 Bayi Performans Skoru

- **3.1.1 Ne yapacak:** Her bayiye 0-100 performans skoru — sipariş hacmi + ödeme disiplini + vade uyumu + büyüme trendi karışımı.
- **3.1.2 Nasıl çalışır:**
  - Cron (haftalık) her bayi için 4 alt-skor hesaplar (Hacim / Düzenlilik / Tahsilat / Trend).
  - Skor `bayi_dealer_scores` tablosuna yazılır + timeline (haftalık snapshot).
  - Dashboard'da liste skor-sıralı, bayi detayda breakdown grafiği.
- **3.1.3 Backend:**
  - Migration: `bayi_dealer_scores` (dealer_id, period_start, score_total, sub_volume, sub_regularity, sub_collection, sub_trend, snapshot_at).
  - Helper: `src/platform/bayi-scoring/calculate.ts` — formula + persist.
  - Cron: `/api/cron/bayi-scoring` (haftalık Pazartesi 02:00).
- **3.1.4 UI:**
  - `src/components/bayi/DealerScoreBadge.tsx` (renk kodlu pill, tooltip breakdown)
  - `bayiler` liste sayfasında skor kolonu + sort
  - `bayiler/[id]` detay sayfasında "Performans" tabı (4 alt-skor, 12-hafta trend grafiği)
- **3.1.5 Agent entegrasyonu:**
  - Yeni tool `get_dealer_score` (dealer_id veya top_n)
  - Yeni tool `compare_dealers` (top-3 vs bottom-3 segment)
- **3.1.6 WA entegrasyonu:**
  - Aylık 1. günü cron: dağıtıcıya "Bayi performans raporu" push (ilk 3 + son 3 skor, panel link)
  - Skor 30'un altına düşen bayi için admin uyarı push
- **3.1.7 Tahmini saat:** Tasarım 1 / Kod 5 / Test 2 = **8 saat**
- **3.1.8 Öncelik:** **Kritik** (Faz A — temel veri katmanı, diğer katmanlar bu skoru tüketir)
- **3.1.9 Marketing parlatma:** *"Bayilerinin gerçek satış gücünü 0-100 skorla anında görür, kimi güçlendirmek gerek bilirsin — performans paneli sadece 2 ayda ortalama ciroyu %18 artırır."*

---

### 3.2 Churn Riski Erken Uyarı

- **3.2.1 Ne yapacak:** 30/60/90 gün sipariş yoksa + vade gecikmesi varsa bayi "risk altında" işaretlenir, dağıtıcıya aksiyon listesi sunulur.
- **3.2.2 Nasıl çalışır:**
  - View `bayi_churn_signals`: son sipariş tarihi, vade gecikme günleri, sipariş trendi (4-haftalık moving average), skor düşüşü kombinasyonu.
  - 3 seviye: 🟢 Sağlıklı / 🟡 Watch / 🔴 Yüksek Risk.
  - Dashboard banner "5 bayi risk altında — Aksiyon Al"; tıklayınca recovery flow.
- **3.2.3 Backend:**
  - Migration: SQL view `bayi_churn_signals` (read-only, runtime).
  - Helper: `src/platform/bayi-churn/score.ts` — risk hesabı + threshold config.
  - Cron: `/api/cron/bayi-churn` (günlük 03:00) — eşik aşan bayi için notification + skor update.
- **3.2.4 UI:**
  - `bayiler` liste sayfasına "🔴 Risk" filter chip
  - `/tr/bayi-risk` yeni sayfa: risk altındaki bayiler tabloda, "Recovery aksiyonu" CTA (otomatik %5 indirim kuponu veya hatırlatma)
  - `bayiler/[id]` detayda "Risk Sinyalleri" kartı (son sipariş, vade durumu, neden flagged)
- **3.2.5 Agent:**
  - Tool `get_churn_risks` (top_n) — agent sabah özetinde proactive sunabilir
  - Tool `trigger_recovery_action` (dealer_id, action_type) — agent öneri olarak kuponu hazırlar, admin onaylar
- **3.2.6 WA:**
  - Bayi 60 günü aştığında admin'e ⚠️ push
  - Recovery action onayında bayiye otomatik kupon mesajı (24-saat window kontrolü)
- **3.2.7 Tahmini saat:** Tasarım 1 / Kod 4 / Test 2 = **7 saat**
- **3.2.8 Öncelik:** **Kritik** (Faz A — performans skoru ile aynı veri katmanını paylaşır, immediate value)
- **3.2.9 Marketing parlatma:** *"Bayini kaybetmeden 30 gün önce sistem haber verir — otomatik recovery aksiyonu ile churn'ü %30'a kadar düşürdüğümüz onaylanmıştır."*

---

### 3.3 Cross-sell / Upsell Öneri Motoru

- **3.3.1 Ne yapacak:** "Bunu alan bunu da aldı" — her bayiye geçmiş siparişlerine göre 5 ürün önerisi, sipariş ekranında otomatik öneri.
- **3.3.2 Nasıl çalışır:**
  - Item-item co-occurrence: aynı bayinin son 6 ay siparişlerinde A ürünüyle birlikte alınan B ürünleri.
  - Stok+marj weighting: yüksek marjlı ve stokta olan ürünler önceliklendirilir.
  - Sipariş ekranında "Bunu da deneyin" rail, bayi profilinde "Önerilen ürünler" tabı.
- **3.3.3 Backend:**
  - Migration: `bayi_cross_sell_pairs` (product_a_id, product_b_id, co_occurrence_count, score) — cron yeniler.
  - Helper: `src/platform/bayi-recommendations/cross-sell.ts`
  - Cron: `/api/cron/bayi-recommendations` (günlük 04:00)
- **3.3.4 UI:**
  - `bayiler/[id]` detayda "Bu bayiye öner" widget (5 ürün)
  - `bayi-siparis-ver` sepet ekranında "Bunu da deneyin" yatay rail
  - Bayi-tarafı (`bayi-siparis-ver` dealer view) aynı widget
- **3.3.5 Agent:**
  - Tool `suggest_cross_sell` (dealer_id) — chat'te "X bayisi için ne önerirsin?" sorusu cevaplanır
  - Tool `bulk_cross_sell_proposal` (segment) — admin için "ilk 10 bayiye yeni ürün önerisi taslağı"
- **3.3.6 WA:**
  - Sipariş tamamlandıktan 24 saat sonra bayiye "Senin gibi bayiler şunları aldı" push (24h customer service window içinde)
  - Opt-in/opt-out tercih (notification_preferences `cross_sell_suggestion` tipi)
- **3.3.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.3.8 Öncelik:** **Orta** (Faz B — 3.1 + 3.2 ile sipariş trend verisini paylaşır)
- **3.3.9 Marketing parlatma:** *"Her sipariş ekranında 'bunu alanlar bunu da aldı' önerisi — yapay zekâ aylık cironu doğal şekilde %12-18 yukarı çeker, sipariş başına ek satış 4 üründen az değil."*

---

### 3.4 Otomatik Kampanya & Teklif Sistemi

- **3.4.1 Ne yapacak:** Trigger + condition + action kuralları: "Bayi 30 gün sipariş atmadıysa %5 indirim kuponu" gibi otomasyonlar; admin kuralı bir kez tanımlar, sistem çalıştırır.
- **3.4.2 Nasıl çalışır:**
  - Rule engine: event (siparişsizlik / vade aşımı / yeni ürün) → koşul (segment / skor) → aksiyon (kupon / WA mesajı / e-posta).
  - Cron event tarayıcı + kural eşleştirme + idempotency (aynı bayiye aynı kural 30 gün içinde tekrarlamaz).
- **3.4.3 Backend:**
  - Migration: `bayi_campaign_triggers` (id, name, event_type, conditions JSONB, action_type, action_payload JSONB, active, last_run).
  - Migration: `bayi_campaign_executions` (trigger_id, dealer_id, executed_at, status) — idempotency log.
  - Cron: `/api/cron/bayi-campaign-triggers` (saatlik) — event tara, kural çalıştır, kupon mint.
  - Helper: `src/platform/bayi-campaigns/rule-engine.ts`
- **3.4.4 UI:**
  - `/tr/bayi-kampanya-otomatik` yeni sayfa — kural listesi + 3-step wizard (event → segment → action)
  - "Yeni kural" formu: event dropdown (siparişsizlik N gün / vade aşımı / skor düşüşü / yeni ürün), segment seçici, aksiyon (kupon kodu / WA mesajı / e-posta)
  - Geçmiş çalıştırmalar tab — hangi kural hangi bayiye ne zaman tetiklendi
- **3.4.5 Agent:**
  - Tool `create_campaign_trigger` (kural taslağı hazırlar, admin onaylar)
  - Tool `list_active_campaigns` + `pause_campaign`
- **3.4.6 WA:**
  - Trigger çalıştığında bayi WA'sına otomatik mesaj (template'ler `notification_preferences`'tan opt-out)
  - Admin'e haftalık özet "5 kural çalıştı, 12 bayi etkilendi, 3 sipariş döndü"
- **3.4.7 Tahmini saat:** Tasarım 2 / Kod 8 / Test 3 = **13 saat**
- **3.4.8 Öncelik:** **Orta** (Faz B — 3.1 skoru + 3.2 risk verisini condition'da kullanır)
- **3.4.9 Marketing parlatma:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın: sipariş düşen bayiye otomatik kupon, vade gecikenine hatırlatma, yeni ürünle ilk 10 bayiye ön-erişim — manuel kampanya saatleri %70 azalır."*

---

### 3.5 Online Vitrin + Lead Form Widget

- **3.5.1 Ne yapacak:** Bayinin son müşterisi için dağıtıcının ürün katalogu — bayi-spesifik fiyat, lead form (sipariş talebi), bayinin kendi sub-domain'i veya gömülebilir widget.
- **3.5.2 Nasıl çalışır:**
  - Her bayiye unique `vitrine_slug` (örn `retailai.upudev.nl/v/ahmet-boya`).
  - Public sayfa: ürün listesi (bayi fiyatı + stok rozet), filtreler, "Sipariş Talep Et" form.
  - Form submit → `leads` tablosu insert → bayiye WA push, admin'e bildirim.
  - Bayi panel "Müşteri Talepleri" sayfasından lead'leri görür, onaylayınca otomatik bayi-siparişine dönüşür.
- **3.5.3 Backend:**
  - Migration: `bayi_vitrines` (dealer_id, slug UNIQUE, theme JSONB, is_active, custom_logo_url, custom_color).
  - Migration: `bayi_leads` (id, dealer_id, customer_name, customer_phone, customer_email, items JSONB, message, status, source, converted_order_id).
  - Public route `/v/[slug]` (locale-aware) — auth yok, RLS allow anonymous insert leads.
  - Helper: `src/platform/bayi-vitrine/render.ts`
- **3.5.4 UI:**
  - `/tr/bayi-vitrinim` (bayi-side) — vitrine editor: logo, renk, başlık, hangi ürünler görünür, "Önizle" buton
  - `/tr/bayi-musteri-talepleri` (bayi-side) — lead listesi, onay/red, dönüşüm metriği
  - `/v/[slug]` public ürün katalogu + lead form (mobile-first, no-auth)
  - `bayiler/[id]` admin detayda "Vitrin durumu" özet (lead sayısı, dönüşüm oranı)
- **3.5.5 Agent:**
  - Tool `get_dealer_leads` (dealer_id) — lead-to-order dönüşüm raporu
  - Tool `suggest_vitrine_improvements` (dealer_id) — düşük dönüşümlü bayilere öneri
- **3.5.6 WA:**
  - Yeni lead → bayiye anlık WA push ("Bayisinden talep: Ahmet Boyu, 3 ürün")
  - Lead 24 saatte yanıtsız → bayiye + admin'e hatırlatma
- **3.5.7 Tahmini saat:** Tasarım 3 / Kod 10 / Test 5 = **18 saat** (yeni public route + bayi-tarafı kompleksliği)
- **3.5.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, diğer katmanlara bağlı değil ama bayi-tarafı yeni yüzey)
- **3.5.9 Marketing parlatma:** *"Her bayinin kendi mini vitrini var — son müşterisi internetten sipariş talep eder, bayiye anlık WA bildirim gider, dağıtıcı satışı bayiden ötesine ulaşır. Bir mağaza, sınırsız online vitrin."*

---

### 3.6 Marketing Automation (Drip + Segment)

- **3.6.1 Ne yapacak:** 5-7 mesajlık otomatik drip dizileri (yeni bayi onboarding / churn recovery / upsell sequence), segment-based broadcast (WA + e-posta).
- **3.6.2 Nasıl çalışır:**
  - Drip = `bayi_drip_campaigns` + `bayi_drip_steps` (step_order, delay_days, channel, template, condition).
  - Bayi belirli "audience" girer (yeni bayi / risk altında / upsell hedef) → drip otomatik tetiklenir.
  - Cron her gün step delay'i kontrol eder, mesajları gönderir, log tutar.
- **3.6.3 Backend:**
  - Migration: `bayi_drip_campaigns` (id, name, audience JSONB, channel, active).
  - Migration: `bayi_drip_steps` (campaign_id, step_order, delay_days, channel, template, send_condition).
  - Migration: `bayi_drip_enrollments` (campaign_id, dealer_id, enrolled_at, current_step, status).
  - Migration: `bayi_drip_sends` (enrollment_id, step_id, sent_at, status, error).
  - Cron: `/api/cron/bayi-drip` (saatlik) — pending step'leri gönder.
  - Helper: `src/platform/bayi-marketing/drip-engine.ts`
- **3.6.4 UI:**
  - `/tr/bayi-marketing` yeni sayfa — drip listesi
  - Drip editor (5-step wizard): audience seç, kanal (WA/e-posta), step ekle (delay + template), önizle
  - Segment builder: skor aralığı, son sipariş, kategori, vade durumu
  - Broadcast formu: tek seferlik mesaj segment'e gönder
- **3.6.5 Agent:**
  - Tool `create_drip_campaign` — agent kullanıcıyla konuşarak drip taslağı hazırlar
  - Tool `get_drip_performance` — açılma/dönüşüm raporu
  - Tool `suggest_audience_for_template` — verilen template'e uygun bayi seç
- **3.6.6 WA:**
  - Tüm drip mesajları WA Cloud API üzerinden (24-saat customer service window gate kontrolü helper'da)
  - WA başarısızsa e-posta fallback (SES/Postmark)
- **3.6.7 Tahmini saat:** Tasarım 3 / Kod 9 / Test 4 = **16 saat**
- **3.6.8 Öncelik:** **Düşük** (Faz C — 3.4 trigger sistemiyle örtüşür; trigger = anlık tek mesaj, drip = zamana yayılmış dizi)
- **3.6.9 Marketing parlatma:** *"Yeni bayi onboarding'i, churn recovery, upsell — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu insanları taşır; manuel ekip yerine sistem konuşur."*

---

### 3.7 Referans Programı (Bayi → Bayi Davet)

- **3.7.1 Ne yapacak:** Bayi yeni bayi davet ederse, davet kabul edilip ilk siparişi geçtiğinde davet eden bayiye komisyon kredisi (3 ay %5 veya sabit ₺ kredi).
- **3.7.2 Nasıl çalışır:**
  - Bayi panel "Davet et" sayfası — unique link + WA share button.
  - Davet kabul + ilk sipariş → `bayi_referrals.status='earned'` + kredi tahakkuk eder.
  - Krediyi bayi bir sonraki siparişinde uygular (auto-apply checkbox).
- **3.7.3 Backend:**
  - Migration: `bayi_referral_codes` (code, dealer_id, created_at, expires_at, max_uses, current_uses).
  - Migration: `bayi_referrals` (referrer_dealer_id, referred_dealer_id, code_id, status, reward_amount, reward_currency, earned_at, applied_at).
  - Migration: `bayi_dealer_credits` (dealer_id, balance, last_movement_at) + `bayi_credit_movements` (delta, source, reference_id).
  - Helper: `src/platform/bayi-referral/engine.ts`
  - Trigger: yeni `bayi_dealer_orders` insert → referrer credit kontrolü
- **3.7.4 UI:**
  - `/tr/bayi-davet-et` (bayi-side) — unique kod, paylaş butonu, kazanım grafiği
  - `bayi-cari` ekstresinde "Kredi bakiyesi" satırı
  - Sipariş ekranında "Kredi kullan" checkbox
  - Admin görünüm `/tr/bayi-referans-yonet` — toplam referans, top referrer'lar
- **3.7.5 Agent:**
  - Tool `get_referral_status` (dealer_id)
  - Tool `top_referrers` — admin için
- **3.7.6 WA:**
  - Davet edilen bayi kabul ettiğinde referrer'a "Davetin kabul oldu, ilk siparişiyle ₺X kazanacaksın" push
  - İlk sipariş tetiklendiğinde "Kredin tahakkuk etti" push
- **3.7.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.7.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, viral büyüme aracı)
- **3.7.9 Marketing parlatma:** *"Bayiler birbirini davet eder, sen para vermeden ağ büyür — her başarılı davet bayiye kredi, sana yeni gelir kanalı. Viral büyüme: ilk 6 ayda bayi sayısı +%25."*

---

### 3.8 Aktif Öneri Motoru (Yatay — Tüm SaaS'larda Aynı Pattern)

- **3.8.1 Ne yapacak:** Sayfa açar açmaz "Sana özel 3 öneri" — sistem son N gün veriyi tarayıp aksiyona dönüşebilen kısa tavsiyeler sunar. Örn: *"Bu hafta sipariş vermeyen 5 bayine WA gönder"*, *"Stoğu azalan 8 ürün için tedarikçi sipariş hazırla"*, *"AI mesajlarının %85'ini kullandın — Pro'ya geç"*, *"3 bayinin vadesi yarın doluyor — hatırlatma at"*.
- **3.8.2 Nasıl çalışır:**
  - Rule registry — her tenant için 10-15 öneri kuralı (event/query/threshold + suggestion template + action_type).
  - Saatlik cron tüm rule'ları evaluate eder; eşik aşıldığında `recommendation_runs` row açılır (idempotency: aynı user × rule × hedef 24h kapalı).
  - Dashboard widget en yüksek skorlu 3 öneri gösterir (skor = recency × impact × actionability).
  - Action button 1-tıkla aksiyona: kupon mint / WA broadcast taslağı / sipariş ekranı deeplink / kampanya tetik / billing yönlendirme.
  - **Yatay yapı:** engine tenant-agnostic, her SaaS kendi `recommendations.ts` adapter'ı verir (rule registry + evaluator). Bayi'de "sipariş vermeyen bayi", emlak'ta "30 gün ulaşılamayan müşteri", market'ta "SKT yaklaşan ürün" gibi.
- **3.8.3 Backend:**
  - Migration: `recommendation_rules` (tenant_key, code UNIQUE, title_template, body_template, action_type, severity, is_active, last_evaluated_at) — config + analytics.
  - Migration: `recommendation_runs` (id, tenant_id, user_id, rule_code, target_ids JSONB, payload JSONB, severity, status='open'|'acted'|'dismissed'|'expired', acted_at, dismissed_at, expires_at, created_at) — 3 index (user+status+created, tenant+rule+created, expires).
  - Helper: `src/platform/recommendations/engine.ts` — tenant-agnostic dispatcher (tenantKey → adapter).
  - Tenant adapter: `src/tenants/bayi/recommendations.ts` — bayi kuralları (BAYI_RULES: pasif bayi, kritik stok, vade yaklaşan, churn risk, quota dolma vb.).
  - Cron: `/api/cron/recommendations` (saatlik) — tüm tenant adapter'ları çalıştırır.
- **3.8.4 UI:**
  - `src/components/recommendations/RecommendationCard.tsx` — sağ üst widget (panel-aware, tenant-aware).
  - Bayi `bayi-panel` dashboard üstüne mount — "Sana özel 3 öneri" başlık + 3 kart (başlık + 1-2 satır body + "Şimdi yap" + "Sonra" + "Kapat").
  - `/tr/bayi-oneriler` full liste sayfası — geçmiş + dismissed dahil, filter (open/acted/dismissed), severity badge.
  - Action handler modal'ları (tenant-shared): WA broadcast taslağı modal, sipariş sepeti pre-fill modal, kupon mint modal, billing deeplink.
- **3.8.5 Agent:**
  - Tool `get_recommendations` (limit=5) — son 24h `recommendation_runs status='open'` listesi.
  - Tool `act_on_recommendation` (run_id, choice='accept'|'dismiss') — action_type'a göre downstream tool çağırır (örn `act → send_dealer_message` veya `act → trigger_recovery_action`).
  - Agent prompt'a context: "şu an N öneri açık" — chat başında proactive sunabilir.
- **3.8.6 WA:**
  - Severity='high' öneri 6 saatte action edilmezse admin'e WA hatırlatma.
  - Action sonucu downstream sendNotification helper çalıştırır (WA push, e-posta yok).
- **3.8.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 2 = **10 saat**
- **3.8.8 Öncelik:** **Orta** (Faz B — 3.1 skor + 3.2 risk + 3.3 cross-sell verilerini tüketir). **Yatay yapı:** engine + UI component diğer 5 SaaS'da aynı koddur; her tenant yalnız `recommendations.ts` adapter dosyası ekler.
- **3.8.9 Marketing parlatma:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi bayiye WA atılmalı, hangi ürün sipariş edilmeli, hangi kampanya çalıştırılmalı söyler. Tıkla, yapsın. Beyin gibi düşünür, asistan gibi çalışır."*

---

## 4. Faz Sırası

### Faz A — Hızlı Kazanç (1-2 hafta, **Kritik**)

**Kapsam:** 3.1 Bayi Performans Skoru + 3.2 Churn Riski Erken Uyarı

**Gerekçe:**
- Her ikisi aynı veri katmanını (sipariş geçmişi + vade + tahsilat) tüketir — paralel implement edilebilir.
- Anlık değer: ilk gün dağıtıcı paneli açtığında "5 bayi risk altında" banner'ı görür → SaaS değerinin somut kanıtı.
- Diğer katmanlar (3.3 cross-sell, 3.4 kampanya) skor/risk verisini condition'da kullanır — Faz A altyapı.
- Migration risk düşük (yeni tablo + view, yıkıcı değişiklik yok).

**Tahmini:** 15 saat

### Faz B — Orta (3-4 hafta)

**Kapsam:** 3.3 Cross-sell + 3.4 Otomatik Kampanya & Teklif + **3.8 Aktif Öneri Motoru**

**Gerekçe:**
- Faz A'nın skor + risk verisini segment/condition olarak kullanır.
- Cross-sell rekomandasyon motoru bağımsız ama ortak `bayi-recommendations` modülünde toplanır.
- Otomatik kampanya kural motoru: en yüksek manuel-iş-azaltma kazancı, marketing pitch'inde "70% manuel azaltma" iddiası buradan.
- **3.8 Aktif Öneri Motoru** Faz A+B'nin tüm output'larını (skor, risk, cross-sell, kampanya tetiği) tek widget'a toplar — "panel açar açmaz aksiyon" deneyimi. **Yatay yapı:** engine + UI tüm SaaS'larda aynı koddur; bu Faz B'de yazılır, diğer 5 SaaS yalnız `recommendations.ts` adapter ekler.

**Tahmini:** 34 saat (11 + 13 + 10)

### Faz C — Uzun Vadeli (5-8 hafta)

**Kapsam:** 3.5 Online Vitrin + 3.6 Marketing Automation + 3.7 Referans Programı

**Gerekçe:**
- 3.5 Vitrin: yeni public route + bayi-tarafı yeni yüzey, en uzun kapsamlı modül.
- 3.6 Drip: 3.4 trigger sistemini genişletir, time-based dizilere taşır.
- 3.7 Referans: bağımsız viral büyüme aracı, billing entegrasyonu (Mollie kupon code) ile bağlı.
- Faz C bittiğinde "satış lokomotifi" söylemi tam olarak savunulabilir hale gelir.

**Tahmini:** 45 saat

---

## 5. Toplam Saat Tahmini

| Katman | Tasarım | Kod | Test | Toplam |
|--------|---------|-----|------|--------|
| 3.1 Bayi Performans Skoru | 1 | 5 | 2 | **8** |
| 3.2 Churn Riski Erken Uyarı | 1 | 4 | 2 | **7** |
| 3.3 Cross-sell / Upsell | 2 | 6 | 3 | **11** |
| 3.4 Otomatik Kampanya | 2 | 8 | 3 | **13** |
| 3.5 Online Vitrin + Lead | 3 | 10 | 5 | **18** |
| 3.6 Marketing Automation | 3 | 9 | 4 | **16** |
| 3.7 Referans Programı | 2 | 6 | 3 | **11** |
| 3.8 Aktif Öneri Motoru (yatay) | 2 | 6 | 2 | **10** |
| **TOPLAM** | **16** | **54** | **24** | **94 saat** |

**Faz bazında:** Faz A 15h · Faz B 34h · Faz C 45h
**Kalibrasyon notu:** Sprint 2+3 yaklaşık 6 saat sürdü (stok UI + Mollie billing). Bu plan ~94 saat = realistik olarak 3-4 hafta yoğun tempoda, 2 ay rahat tempoda. 3.8 yatay yapı — diğer 5 SaaS'a sadece adapter ekleyerek (~2 saat/tenant) yayılır, ekstra 10 saat değil, paylaşılan kazanç.

---

## 6. Bağımlılıklar ve Riskler

### Üçüncü taraf entegrasyon
- **Mollie:** mevcut (Sprint 3) — 3.7 referans programında kupon code akışı eklenecek (`paymentMethods.iDEAL` + discount stack).
- **WA Cloud API:** mevcut — 3.4/3.6 broadcast'lerde **24-saat customer service window** gate zorunlu. Template message gerekirse Meta onay süresi 3-5 gün; mümkün olduğunca freeform mesaj (24h içinde).
- **E-posta SES/Postmark:** 3.6'da fallback için yok şu an — eklenmesi gerekir veya başlangıçta WA-only drip.

### Veri kalitesi gereksinimleri
- **3.1 + 3.2** için en az **3 ay** sipariş + vade verisi gerekir. Yeni tenant'ta scoring "Yeterli veri yok" placeholder; cron 90 günden sonra skor hesaplar.
- **3.3 Cross-sell** için en az **20 sipariş** tarihçesi gerek; altında "geliştirme aşamasında" UI.

### DB migration kuralları (CLAUDE.md)
- 14-digit timestamp prefix, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- DROP/destructive ALTER → ASK first.
- Worker SQL dosyasını yazar + `supabase db push` ile apply eder + commit + push. Migration yerel `.planning/migrations/` değil, `supabase/migrations/`.

### Backward compat
- WA komut router devre dışı (BAYI_COMMANDS_ENABLED=false) — Faz B/C broadcast UI'sı yeni route kullanacak, eski 37 komut dosyası inert kalır.
- agent_quotas plan_key Sprint 3'te Mollie webhook ile sync — 3.4 kupon tetiği `subscriptions.amount`'a dokunmaz; yalnız `bayi_dealer_credits` ledger'ında çalışır.
- `notifications` tablosu mevcut — 3.4/3.6 mesaj sendNotification helper'a düşer, audit trail merkezi.

### Risk haritası
| Risk | Olasılık | Etki | Karşı önlem |
|------|----------|------|-------------|
| Skor formülü subjektif → güvensizlik | Orta | Yüksek | Açık formül + tooltip breakdown + admin override |
| WA 24h window ihlali → Meta hesap askısı | Düşük | Çok yüksek | `shouldNotify` gate'inde `last_inbound_at` kontrolü zorunlu |
| Drip spam → bayi opt-out fırtınası | Orta | Orta | step başına opt-out link + frequency cap (haftalık max 2 mesaj) |
| Vitrine slug çakışması | Düşük | Düşük | UNIQUE + auto-suffix (-2, -3) |
| Referans kupon stack abuse | Orta | Orta | Max 1 kredi/sipariş + monthly cap + audit log |

---

## 7. Kabul Kriterleri (Acceptance)

### Faz A bitince
- [ ] Dağıtıcı `/tr/bayiler` → bayi liste'de "Skor" kolonu, sort çalışıyor
- [ ] Dağıtıcı `/tr/bayiler/[id]` → "Performans" tabı 4 alt-skor + 12-hafta trend grafiği
- [ ] Dağıtıcı `/tr/bayi-panel` → "5 bayi risk altında" banner görünüyor
- [ ] `/tr/bayi-risk` sayfa açılıyor, recovery aksiyon CTA çalışıyor
- [ ] Cron `bayi-scoring` haftalık, `bayi-churn` günlük schedule'a alındı, manuel test başarılı
- [ ] Agent `get_dealer_score` + `get_churn_risks` tool'ları çalışıyor, quota artmıyor sıfır kullanımda
- [ ] WA: skor 30 altına düşen bayi tetiği admin'e ulaştı (test bayi ile)

### Faz B bitince
- [ ] `bayi-siparis-ver` ekranında "Bunu da deneyin" rail 5 ürün gösteriyor
- [ ] `/tr/bayi-kampanya-otomatik` sayfa açıyor, "Yeni Kural" wizard tamam
- [ ] Trigger çalıştığında: bayi WA mesajı, geçmiş tab'da log var, idempotency 30 gün
- [ ] Cron `bayi-recommendations` günlük, `bayi-campaign-triggers` saatlik
- [ ] Agent `suggest_cross_sell` + `create_campaign_trigger` tool'ları çalışıyor
- [ ] `bayi-panel` üstüne "Sana özel 3 öneri" widget — 3 öneri görünür (skor/risk/stok/quota karışımı)
- [ ] Öneri kartında 1-tıkla aksiyon: WA broadcast modal / sipariş sepeti pre-fill / kupon mint / billing deeplink
- [ ] `/tr/bayi-oneriler` full liste sayfası (filter: open/acted/dismissed)
- [ ] Cron `recommendations` saatlik, idempotency 24h aynı user×rule×hedef
- [ ] Agent `get_recommendations` + `act_on_recommendation` tool'ları çalışıyor
- [ ] Severity='high' öneri 6 saatte acted değilse admin WA hatırlatma alındı

### Faz C bitince
- [ ] `/v/<slug>` public sayfası açıyor (auth-free), lead form submit edilebiliyor
- [ ] Bayi `/tr/bayi-musteri-talepleri` lead listesi + onay/red akışı tam
- [ ] `/tr/bayi-marketing` drip editor 5-step wizard tamam
- [ ] Bayi `/tr/bayi-davet-et` unique kod görüyor, paylaş çalışıyor; davet kabul + ilk sipariş → kredi tahakkuk
- [ ] `bayi-cari` ekstresinde kredi bakiyesi satırı
- [ ] Sipariş ekranında "Kredi kullan" checkbox aktif

---

## 8. Pazarlama Mesajları (Sales-Ready Liste)

Her katman için landing page, demo, satış sunumunda kullanılabilir 1-2 cümlelik vurgu:

- **3.1 Bayi Performans Skoru:** *"Bayilerinin gerçek satış gücünü 0-100 skorla anında görür, kimi güçlendirmek gerek bilirsin — performans paneli sadece 2 ayda ortalama ciroyu %18 artırır."*
- **3.2 Churn Riski:** *"Bayini kaybetmeden 30 gün önce sistem haber verir — otomatik recovery aksiyonu ile churn'ü %30'a kadar düşürür."*
- **3.3 Cross-sell:** *"Her sipariş ekranında 'bunu alanlar bunu da aldı' önerisi — yapay zekâ aylık cironu %12-18 yukarı çeker, sipariş başına ek satış 4 üründen az değil."*
- **3.4 Otomatik Kampanya:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın — sipariş düşen bayiye otomatik kupon, vade gecikenine hatırlatma. Manuel kampanya saatleri %70 azalır."*
- **3.5 Online Vitrin + Lead:** *"Her bayinin kendi mini vitrini var — son müşterisi internetten sipariş talep eder, bayiye anlık WA bildirim gider. Bir mağaza, sınırsız online vitrin."*
- **3.6 Marketing Automation:** *"Onboarding, churn recovery, upsell — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu insanları taşır; manuel ekip yerine sistem konuşur."*
- **3.7 Referans Programı:** *"Bayiler birbirini davet eder, sen para vermeden ağ büyür — her başarılı davet bayiye kredi, sana yeni gelir kanalı. Viral büyüme: ilk 6 ayda bayi sayısı +%25."*
- **3.8 Aktif Öneri Motoru:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi bayiye WA atılmalı, hangi ürün sipariş edilmeli, hangi kampanya çalıştırılmalı söyler. Tıkla, yapsın. Beyin gibi düşünür, asistan gibi çalışır."*

**Üst başlık vurgu (landing hero):**
*"UPU Bayi — sipariş + tahsilat + bayi yönetimi yetmez. Satışını arttırır, churn'unu azaltır, marketing'ini otomatize eder. Bir abonelik, 7 satış lokomotifi."*

---

## 9. Sıradaki Adım

Bu master plan Çağrı tarafından onaylandıktan sonra:

1. **Faz A başlatma:**
   - Worker: bayi (tmux upu-bayi)
   - İlk commit: `feat(db): bayi_dealer_scores + bayi_churn_signals view migration`
   - İkinci commit: `feat(bayi-scoring): cron + helper (calculate.ts)`
   - Üçüncü commit: `feat(bayi): /tr/bayi-risk + score badge + bayiler liste sort`
   - 4. commit: `feat(agent/bayi): get_dealer_score + get_churn_risks tools`

2. **Sprint task'larına böl:** Faz A her katman için 4-5 task (DB migration → API → UI → cron → agent tool → WA template → kabul testi).

3. **Diğer 5 SaaS master planı:** Bu template'i şablon olarak `.planning/saas-roadmap/`:
   - `emlak-master-plan.md` — emlak worker
   - `market-master-plan.md` — market worker
   - `otel-master-plan.md` — otel worker
   - `restoran-master-plan.md` — restoran worker
   - `siteyonetim-master-plan.md` — siteyonetim worker
   - Her tenant kendi domain'ine uyarladığı 7 lokomotif katmanını yazar (örn emlak için "müşteri churn", "portföy skoru", "lead routing"; market için "müşteri sadakat skoru", "raf optimizasyonu" vb.)

4. **Versiyonlama:** Her sprint sonunda bu doküman `Versiyon 1.1`, `1.2` şeklinde güncellenir. "Tamamlandı / Devam / Plan" durumları her katman üstüne işaretlenir.

---

*Bu doküman bayi worker (`tmux upu-bayi`) tarafından 2026-05-21 tarihinde üretildi. Onay sonrası Faz A başlatılır.*
