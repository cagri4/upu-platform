# Siteyönetim SaaS — Master Plan (Satış Lokomotifi Dönüşümü)

> **Tarih:** 2026-05-22
> **Versiyon:** 1.0 — Bayi master plan'ı (v1.1) şablonundan siteyönetim sektörüne adapte edildi
> **Sahibi:** Çağrı
> **Worker:** siteyonetim (tmux upu-siteyonetim)
> **Durum:** Onay bekliyor — Faz A başlatma için

---

## 1. Mevcut Durum (5 Açılı Değerlendirme)

### 1.1 UI Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Panel sayfaları | `/site` ana sayfa (tek route, layout + page), site init endpoint ile session attach | Site yönetimi dashboard (aidat tahsilat oranı, açık talep, duyuru, bekleyen rezervasyon), daire/sakin liste, aidat tahsilat sayfası, bakım talep yönetim, duyuru CRUD, ortak alan rezervasyon takvimi, gelir-gider raporu, yıllık genel kurul arşivi | — |
| Sidebar nav | Henüz role-aware nav yok (tek sayfa) | Sakin / yönetici / muhasebe ayrımıyla nav, bekleyen talep badge | — |
| Mobile UX | `/site` page mobil uyumlu basic | Sakin-tarafı mobile-first deneyim (aidat öde, talep aç, duyuru oku) zayıf | — |
| Agent widget | Yok | Sağ alt floating agent (aidat sorgu, talep özeti, duyuru taslağı) | — |
| Bell + bildirim merkezi | Yok | Topbar bell (yeni talep, geciken aidat, yaklaşan toplantı), geçmiş sayfası | — |

### 1.2 Site Yöneticisi (Admin Ofis) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Daire/sakin yönetimi | WA `kayit` komutu ile sakin ekleme (helpers.ts), `binakodu` ile blok eşleme | **Sakin memnuniyet skoru, aidat düzeni skoru**, daire-sakin matrisi UI, kiracı/malik ayrımı, taşınan/yeni sakin onboarding | — |
| Aidat takibi | WA `aidat` + `borcum` komutları, ödeme bildirim akışı | Tahsilat sayfası (vade takvimi, otomatik hatırlatma yapılandırma UI), banka mutabakat (dekont upload), kredi kartı linki (Iyzico/Stripe), borç dökümü PDF | — |
| Bakım/arıza talebi | WA `ariza` komutu, talep oluşturma | Talep havuzu UI (open/in-progress/done), fotoğraf eki, ustaya WA yönlendirme, SLA timer, sözleşmeli firma listesi | — |
| Duyuru | WA `duyuru` komutu, broadcast | Yöneticinin panelden duyuru yazıp tüm sakinlere WA push UI, duyuru kategorisi (acil/genel/etkinlik), arşiv | — |
| Rapor | WA `rapor` komutu (aidat/gider özeti) | Aylık gelir-gider PDF, sakin bazlı borç ekstresi, yıllık genel kurul raporu auto-generate | — |
| Ortak alan rezervasyonu | Yok | Spor salonu/toplantı odası/havuz/bahçıvan takvimi, sakin online rezervasyon, çakışma kontrolü | — |
| Marketing | Hiç yok | Yeni daire ilanı (boş daire için kiracı arama vitrini), drip campaign, broadcast | — |
| Kullanıcı yönetim | WA `kayit` ile sakin kayıt + admin manual | Audit log (kim hangi aidatı tahsil etti, kim hangi talebi kapatti), yönetici/muhasebeci/güvenlik rol matrisi | — |
| Billing | Yok | Site yöneticisi kendi UPU aboneliği (daire sayısına göre tier: <50 / 50-200 / 200+), Mollie/Iyzico | — |

### 1.3 Sakin (Resident) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Sakin onboarding | WA `kayit` ile telefon + blok-daire eşleştirme | Karşılama paketi (site kuralları, ortak alan listesi, yönetim iletişim), QR ile hızlı kayıt, eğitim mini-tur | — |
| Aidat öde | WA `borcum` görüntüleme, ödeme bildirim | **Tek-tıkla online ödeme** (Iyzico link), otomatik talimat (auto-pay), borç geçmişi PDF, ortak ödeme planı (taksit) | — |
| Talep aç | WA `ariza` ile arıza bildirme | Mobile-first form, fotoğraf eki, talep durumu canlı takip, geri bildirim/memnuniyet anketi | — |
| Duyuru oku | WA push üzerinden | Sakin mini-panel: son duyurular feed, okundu işareti, kategori filtresi | — |
| Komşu/Topluluk | Yok | Sakin-sakin ortak alan paylaşımı, hizmet öneri (bahçıvan paylaş, eşya paylaş), etkinlik takvimi | — |
| Rezervasyon | Yok | Spor salonu/havuz/toplantı odası slot bul, rezerve et, iptal | — |

### 1.4 UPU Claude Agent (AI Eleman) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Tools | `siteyonetim/agents/` dizini var, base akış | `get_resident_score`, `get_overdue_residents`, `suggest_communal_usage`, `create_announcement`, `segment_residents`, `route_maintenance`, `get_reservation_load` | — |
| Quota | Henüz tenant-tier quota yok | 4 plan tier (Free <30 daire / Starter 30-100 / Pro 100-300 / Premium 300+), period renewal cron | — |
| Prompt | Tenant-aware temel prompt | Yönetici / muhasebe / sakin için 3 kişilik (rol-aware), aidat yumuşatma tonu, sakin memnuniyet odaklı | — |
| Proactive | Yok | Sabah özeti push (geciken aidat, bugünkü rezervasyon, açık talep), kritik durumda agent-initiated mesaj | — |
| Defense | Cross-tenant guard var (platform katmanı) | Sakin-tarafı agent yalnız kendi dairesini görsün — RLS + tool assert | — |

### 1.5 WhatsApp Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| WA komut router | Aktif — 7 komut (aidat, ariza, binakodu, borcum, durum, duyuru, kayit, rapor) | Sakin self-service genişletme: rezervasyon yap, etkinlik kaydı, ödeme linki iste | — |
| Notification push | Helpers var, send pattern aktif | **Yönetici-tarafı WA bot** (yönetici panelden segment'e broadcast atabilsin), drip scheduler | — |
| Sabah brifing | Yok | Cron (yöneticiye sabah özet: geciken aidat sayısı, açık talep, bugünkü rezervasyon, panel link) | — |
| Broadcast | `duyuru` komutu manuel — tek seferlik | Segment broadcast UI (yalnız geciken sakinler / blok A / tüm site) + WA Cloud API 24h gate kontrolü | — |

---

## 2. Hedef: Satış Lokomotifi B2B Site Yönetim SaaS

**Vizyon:** Bu SaaS'ı alan site yöneticisi aidat+talep+duyuru+rezervasyon'u tek yerde yapar; sakinlerini memnun eder, gecikme oranını düşürür, ek hizmet önerisiyle gelir çıkarır, kendi marketing'ini (boş daire ilanı, etkinlik) otomatize eder.

**Pazarlama vurgusu:** *"Onu alan bunu da aldı"* — aidat yöneten her site yöneticisi bu SaaS'ı seçtiğinde otomatik olarak sakin memnuniyet skoru, gecikme alarmı, ek hizmet önerisi ve site bilgi vitrini yanında gelir. Tek aboneliğin içinde 7 satış lokomotifi.

**Ölçülebilir hedefler (Faz A+B+C sonu, 6 ay):**
- Aidat zamanında tahsilat oranı +%22 (otomatik hatırlatma + online ödeme)
- Sakin şikayet/talep çözüm süresi -%40 (SLA timer + rotasyon)
- Manuel duyuru/hatırlatma hazırlama saati -%70 (trigger-based otomasyon)
- Sakin memnuniyet (NPS) +25 puan (rezervasyon + topluluk + ek hizmet)
- Site yöneticisi UPU abonelik upgrade oranı (Starter→Pro) +%30 (Pro-only rezervasyon + drip)

---

## 3. 7 Satış Lokomotifi Katmanı

### 3.1 Sakin Memnuniyet & Aidat Düzeni Skoru

- **3.1.1 Ne yapacak:** Her daireye / sakine 0-100 birleşik skor — aidat ödeme düzeni (gecikme sayısı/gün), bildirim açma oranı, talep yanıtlama/memnuniyet, etkinlik & duyuru etkileşimi karışımı.
- **3.1.2 Nasıl çalışır:**
  - Cron (haftalık) her sakin için 4 alt-skor hesaplar (Aidat Düzeni / İletişim / Talep Yanıt / Etkileşim).
  - Skor `site_resident_scores` tablosuna yazılır + timeline (haftalık snapshot).
  - Dashboard'da daire liste skor-sıralı, sakin detayda breakdown grafiği; site bazında "memnun / risk altında" segment.
- **3.1.3 Backend:**
  - Migration: `site_resident_scores` (resident_id, unit_id, period_start, score_total, sub_payment, sub_communication, sub_response, sub_engagement, snapshot_at).
  - Helper: `src/platform/site-scoring/calculate.ts` — formula + persist.
  - Cron: `/api/cron/site-scoring` (haftalık Pazartesi 02:00).
- **3.1.4 UI:**
  - `src/components/site/ResidentScoreBadge.tsx` (renk kodlu pill, tooltip breakdown)
  - `daireler` / `sakinler` liste sayfasında skor kolonu + sort
  - `sakinler/[id]` detayda "Memnuniyet" tabı (4 alt-skor, 12-hafta trend grafiği)
- **3.1.5 Agent entegrasyonu:**
  - Yeni tool `get_resident_score` (resident_id veya top_n)
  - Yeni tool `compare_residents` (memnun vs risk altında segment)
- **3.1.6 WA entegrasyonu:**
  - Aylık 1. günü cron: yöneticiye "Site memnuniyet raporu" push (ilk 5 memnun + son 5 risk altında, panel link)
  - Skor 40 altına düşen sakin için yöneticiye uyarı push
- **3.1.7 Tahmini saat:** Tasarım 1 / Kod 4 / Test 2 = **7 saat**
- **3.1.8 Öncelik:** **Kritik** (Faz A — temel veri katmanı, diğer katmanlar bu skoru tüketir)
- **3.1.9 Marketing parlatma:** *"Sakinlerinin memnuniyet ve aidat düzenini 0-100 skorla anında görür, kime daha fazla ilgi gerek bilirsin — memnuniyet paneli ilk 2 ayda tahsilat oranını %22 yukarı çeker."*

---

### 3.2 Aidat Geciken / Memnuniyetsiz Sakin Uyarısı

- **3.2.1 Ne yapacak:** 30+ gün aidatı geçen sakin + birden fazla şikayet bildirimi → yönetimde "kritik sakin" uyarısı + erken iletişim önerisi. Ayrıca site bazında çıkış oranı uyarısı (3+ daire 6 ayda taşındı → semt fiyat/hizmet sorgula).
- **3.2.2 Nasıl çalışır:**
  - View `site_churn_signals`: son aidat ödeme tarihi, gecikme günü, kapatılmayan talep sayısı, memnuniyet skoru düşüşü, taşınma sıklığı kombinasyonu.
  - 3 seviye: 🟢 Memnun / 🟡 İzlenmeli / 🔴 Kritik Risk.
  - Dashboard banner "5 sakin kritik durumda — İletişim Aç"; tıklayınca recovery flow (ödeme planı önerisi / yüz yüze toplantı taslağı).
- **3.2.3 Backend:**
  - Migration: SQL view `site_churn_signals` (read-only, runtime).
  - Helper: `src/platform/site-churn/score.ts` — risk hesabı + threshold config (gecikme gün eşik, talep sayısı eşik).
  - Cron: `/api/cron/site-churn` (günlük 03:00) — eşik aşan sakin için notification + skor update.
- **3.2.4 UI:**
  - `sakinler` liste sayfasına "🔴 Kritik" filter chip
  - `/tr/site-kritik-sakin` yeni sayfa: kritik sakinler tabloda, "Recovery aksiyonu" CTA (otomatik ödeme planı önerisi / yöneticiyle randevu)
  - `sakinler/[id]` detayda "Risk Sinyalleri" kartı (son ödeme, açık talep, neden flagged)
  - Site bazında "Çıkış Oranı Uyarısı" banner (semt karşılaştırması)
- **3.2.5 Agent:**
  - Tool `get_overdue_residents` (top_n) — agent sabah özetinde proactive sunabilir
  - Tool `trigger_payment_plan` (resident_id, plan_type) — agent öneri olarak ödeme planı taslağı hazırlar, yönetici onaylar
- **3.2.6 WA:**
  - Sakin 60 günü aştığında yöneticiye ⚠️ push
  - Ödeme planı onayında sakine otomatik mesaj (24-saat window kontrolü) + link
- **3.2.7 Tahmini saat:** Tasarım 1 / Kod 4 / Test 2 = **7 saat**
- **3.2.8 Öncelik:** **Kritik** (Faz A — memnuniyet skoru ile aynı veri katmanını paylaşır, immediate value)
- **3.2.9 Marketing parlatma:** *"Sakini kaybetmeden / aidat kaynamadan 30 gün önce sistem haber verir — otomatik ödeme planı + iletişim önerisi ile gecikmeyi %35'e kadar düşürür."*

---

### 3.3 Ek Hizmet & Ortak Alan Kullanım Önerisi (Cross-sell)

- **3.3.1 Ne yapacak:** "Senin gibi sakinler bunu da kullandı" — her sakine geçmiş kullanım verisine göre kişisel öneri: spor salonu kullanımı (haftada 2x katılan diğer sakinler de spa kullanıyor), bahçıvan paylaş, dolap-eşya paylaşım, kuru temizleme toplu indirim, fitness eğitmen.
- **3.3.2 Nasıl çalışır:**
  - Item-item co-occurrence: aynı sakinin son 6 ay rezervasyon/hizmet kullanımında A hizmetiyle birlikte kullanılan B hizmetleri.
  - Site kapasite weighting: boş slotu olan ortak alan + sözleşmeli hizmet önceliklendirilir.
  - Sakin mini-panelinde "Senin için" rail, yönetici görünümünde "Bu sakine öner" widget.
- **3.3.3 Backend:**
  - Migration: `site_service_pairs` (service_a_id, service_b_id, co_occurrence_count, score) — cron yeniler.
  - Helper: `src/platform/site-recommendations/cross-sell.ts`
  - Cron: `/api/cron/site-recommendations` (günlük 04:00)
- **3.3.4 UI:**
  - `sakinler/[id]` detayda "Bu sakine öner" widget (5 hizmet/etkinlik)
  - Sakin mini-panel ana sayfasında "Senin için" yatay rail
  - Yönetici dashboard'da "Ortak alan doluluk + öneri" rapor
- **3.3.5 Agent:**
  - Tool `suggest_communal_usage` (resident_id) — chat'te "X dairesine ne önerirsin?" sorusu cevaplanır
  - Tool `bulk_service_proposal` (segment) — yönetici için "ilk 10 sakine yeni hizmet önerisi taslağı"
- **3.3.6 WA:**
  - Rezervasyon tamamlandıktan 24 saat sonra sakine "Senin gibi sakinler şunu da denedi" push (24h window içinde)
  - Opt-in/opt-out tercih (`notification_preferences` `service_suggestion` tipi)
- **3.3.7 Tahmini saat:** Tasarım 2 / Kod 5 / Test 3 = **10 saat**
- **3.3.8 Öncelik:** **Orta** (Faz B — 3.1 + 3.2 ile rezervasyon trend verisini paylaşır)
- **3.3.9 Marketing parlatma:** *"Her sakin için 'senin gibi sakinler bunu da kullandı' önerisi — ortak alan doluluk %25 artar, ek hizmet geliri sakinden değil işletmeden gelir, site cazibesi yükselir."*

---

### 3.4 Otomatik Aidat Hatırlatma & Bakım Tetiği

- **3.4.1 Ne yapacak:** Trigger + condition + action kuralları — kural: aidat vade 3 gün önce WA, vadede SMS, 7 gün geçince yöneticiye eskalasyon. Bakım sözleşme bitimine 30 gün uyarı, yıllık genel kurul duyuru tetiği. Yönetici kuralı bir kez tanımlar, sistem çalıştırır.
- **3.4.2 Nasıl çalışır:**
  - Rule engine: event (aidat vade / talep SLA aşımı / sözleşme bitimi / genel kurul yaklaşan) → koşul (segment / skor / blok) → aksiyon (WA mesajı / e-posta / yönetici eskalasyon).
  - Cron event tarayıcı + kural eşleştirme + idempotency (aynı sakine aynı kural 7 gün içinde tekrarlamaz).
- **3.4.3 Backend:**
  - Migration: `site_campaign_triggers` (id, name, event_type, conditions JSONB, action_type, action_payload JSONB, active, last_run).
  - Migration: `site_campaign_executions` (trigger_id, resident_id, executed_at, status) — idempotency log.
  - Cron: `/api/cron/site-campaign-triggers` (saatlik) — event tara, kural çalıştır.
  - Helper: `src/platform/site-campaigns/rule-engine.ts`
- **3.4.4 UI:**
  - `/tr/site-otomasyon` yeni sayfa — kural listesi + 3-step wizard (event → segment → action)
  - "Yeni kural" formu: event dropdown (aidat vade N gün önce / vade aşımı / talep SLA / sözleşme bitimi / genel kurul yaklaşan), segment seçici (blok / skor aralığı / kiracı/malik), aksiyon (WA template / e-posta / yönetici eskalasyon)
  - Geçmiş çalıştırmalar tab — hangi kural hangi sakine ne zaman tetiklendi
- **3.4.5 Agent:**
  - Tool `create_campaign_trigger` (kural taslağı hazırlar, yönetici onaylar)
  - Tool `list_active_campaigns` + `pause_campaign`
- **3.4.6 WA:**
  - Trigger çalıştığında sakin WA'sına otomatik mesaj (template'ler `notification_preferences`'tan opt-out)
  - Yöneticiye haftalık özet "5 kural çalıştı, 23 sakin hatırlatıldı, 18 aidat zamanında geldi"
- **3.4.7 Tahmini saat:** Tasarım 2 / Kod 7 / Test 3 = **12 saat**
- **3.4.8 Öncelik:** **Orta** (Faz B — 3.1 skoru + 3.2 gecikme verisini condition'da kullanır)
- **3.4.9 Marketing parlatma:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın: vade öncesi WA, vade sonrası SMS, sözleşme bitimine 30 gün önce uyarı, genel kurul tetiği — manuel hatırlatma saatleri %70 azalır."*

---

### 3.5 Site Bilgi Sayfası + Sakin Başvuru / İletişim Formu

- **3.5.1 Ne yapacak:** Her sitenin sub-domain `/v/<site-slug>` — site özellikleri (yönetim ofisi açık saat, ortak alan listesi, son duyurular, sözleşmeli hizmetler), "Daire İlanı / Soru" lead formu (potansiyel yeni sakin, kiralık daire arayanlar için). Lead → yöneticiye WA push.
- **3.5.2 Nasıl çalışır:**
  - Her siteye unique `vitrine_slug` (örn `siteyonetim.upudev.nl/v/yesil-vadi-konutlari`).
  - Public sayfa: site özet bilgi (konum, daire sayısı, ortak alan listesi, açık saat), son 3 genel duyuru (kategori: etkinlik), boş daire listesi (yönetici işaretlediyse), "İletişim/Başvuru" form.
  - Form submit → `leads` tablosu insert → yöneticiye WA push, bekleyen başvuru bildirimi.
  - Yönetici panel "Başvurular" sayfasından lead'leri görür, onaylayınca kayıt → sakin onboarding akışı.
- **3.5.3 Backend:**
  - Migration: `site_vitrines` (site_id, slug UNIQUE, theme JSONB, is_active, custom_logo_url, custom_color, show_vacant_units BOOL).
  - Migration: `site_leads` (id, site_id, lead_type ENUM('rent','buy','question','service'), name, phone, email, message, unit_interest, status, source, converted_resident_id).
  - Public route `/v/[slug]` (locale-aware) — auth yok, RLS allow anonymous insert leads.
  - Helper: `src/platform/site-vitrine/render.ts`
- **3.5.4 UI:**
  - `/tr/site-vitrinim` (yönetici-side) — vitrine editor: logo, renk, başlık, hangi ortak alan görünür, boş daire toggle, "Önizle" buton
  - `/tr/site-basvurular` (yönetici-side) — lead listesi, onay/red, dönüşüm metriği (lead → sakin)
  - `/v/[slug]` public site bilgi sayfası + lead form (mobile-first, no-auth)
- **3.5.5 Agent:**
  - Tool `get_site_leads` (site_id) — lead-to-resident dönüşüm raporu
  - Tool `suggest_vitrine_improvements` (site_id) — düşük dönüşümlü site için öneri
- **3.5.6 WA:**
  - Yeni lead → yöneticiye anlık WA push ("Başvuru: Ahmet Y., 3+1 kiralık arıyor, blok A için sordu")
  - Lead 24 saatte yanıtsız → yöneticiye hatırlatma
- **3.5.7 Tahmini saat:** Tasarım 2 / Kod 8 / Test 4 = **14 saat** (yeni public route + yönetici-tarafı kompleksliği)
- **3.5.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, diğer katmanlara bağlı değil ama yönetici-tarafı yeni yüzey)
- **3.5.9 Marketing parlatma:** *"Her sitenin kendi mini bilgi sayfası var — daire arayan internetten başvurur, yöneticiye anlık WA gider, kira/satış zinciri site içinden hızlanır. Bir yönetim ofisi, sınırsız online vitrin."*

---

### 3.6 Sakin Drip — Yeni Sakin Onboarding + Yıllık Memnuniyet + Aidat Yolculuğu

- **3.6.1 Ne yapacak:** 5-7 mesajlık otomatik drip dizileri — (a) yeni taşınan sakine 5-mesaj welcome (kurallar, ortak alanlar, iletişim, ödeme bilgisi, etkinlik); (b) yıllık memnuniyet anketi drip (3-mesajlık nazik takip); (c) aidat düzeni teşviki (3 ay zamanında ödeyene "düzenli sakin" rozeti + sosyal tanıtım); segment-based broadcast (WA + e-posta).
- **3.6.2 Nasıl çalışır:**
  - Drip = `site_drip_campaigns` + `site_drip_steps` (step_order, delay_days, channel, template, condition).
  - Sakin belirli "audience" girer (yeni sakin / aidat geciken / memnun) → drip otomatik tetiklenir.
  - Cron her gün step delay'i kontrol eder, mesajları gönderir, log tutar.
- **3.6.3 Backend:**
  - Migration: `site_drip_campaigns` (id, name, audience JSONB, channel, active).
  - Migration: `site_drip_steps` (campaign_id, step_order, delay_days, channel, template, send_condition).
  - Migration: `site_drip_enrollments` (campaign_id, resident_id, enrolled_at, current_step, status).
  - Migration: `site_drip_sends` (enrollment_id, step_id, sent_at, status, error).
  - Cron: `/api/cron/site-drip` (saatlik) — pending step'leri gönder.
  - Helper: `src/platform/site-marketing/drip-engine.ts` (yatay `drip-engine.ts` üzerinden audience adapter)
- **3.6.4 UI:**
  - `/tr/site-marketing` yeni sayfa — drip listesi
  - Drip editor (5-step wizard): audience seç (yeni sakin / aidat geciken / memnun), kanal (WA/e-posta), step ekle, önizle
  - Segment builder: skor aralığı, son ödeme tarihi, blok, kiracı/malik
  - Broadcast formu: tek seferlik mesaj segment'e gönder
- **3.6.5 Agent:**
  - Tool `create_drip_campaign` — agent kullanıcıyla konuşarak drip taslağı hazırlar
  - Tool `get_drip_performance` — açılma/dönüşüm raporu
  - Tool `suggest_audience_for_template` — verilen template'e uygun sakin seç
- **3.6.6 WA:**
  - Tüm drip mesajları WA Cloud API üzerinden (24-saat customer service window gate)
  - WA başarısızsa e-posta fallback (SES/Postmark)
- **3.6.7 Tahmini saat:** Tasarım 2 / Kod 8 / Test 4 = **14 saat**
- **3.6.8 Öncelik:** **Düşük** (Faz C — 3.4 trigger sistemiyle örtüşür; trigger = anlık tek mesaj, drip = zamana yayılmış dizi)
- **3.6.9 Marketing parlatma:** *"Yeni taşınan sakine onboarding, yıllık memnuniyet anketi, aidat teşvik — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu sakinleri taşır; yönetici insan ilişkisinde, sistem rutin işte."*

---

### 3.7 Sakin Tavsiye = Aidat İndirimi / Site → Site Referans

- **3.7.1 Ne yapacak:** Sakin arkadaşına daire kiralatırsa ay sonu aidat %10 indirim. Site yöneticisi başka site yöneticisini sisteme davet ederse ilk ay UPU aboneliği %50 indirim. Viral B2B + B2C carma.
- **3.7.2 Nasıl çalışır:**
  - Sakin mini-panel "Arkadaş davet et" — unique link + WA share button (kiralık daire için).
  - Davet kabul + ilk aidat ödendi → `site_referrals.status='earned'` + kredi tahakkuk eder (aidat indirimi).
  - Site yöneticisi panel "Yönetici davet et" — unique link. Davet edilen yönetici UPU aboneliği aldığında ilk ay %50 indirim, davet edene de ay sonu kredi.
  - Krediyi sakin bir sonraki aidatında uygular (auto-apply checkbox); yönetici bir sonraki abonelik faturasında.
- **3.7.3 Backend:**
  - Migration: `site_referral_codes` (code, referrer_type ENUM('resident','manager'), referrer_id, created_at, expires_at, max_uses, current_uses).
  - Migration: `site_referrals` (referrer_id, referrer_type, referred_id, code_id, status, reward_amount, reward_type ENUM('dues_discount','subscription_discount'), earned_at, applied_at).
  - Migration: `site_resident_credits` (resident_id, balance, last_movement_at) + `site_credit_movements` (delta, source, reference_id).
  - Helper: `src/platform/site-referral/engine.ts` (yatay referral engine üzerinden reward adapter)
  - Trigger: yeni `site_dues_payments` insert → referrer credit kontrolü
- **3.7.4 UI:**
  - `/tr/site-davet-et` (sakin-side) — unique kod, paylaş butonu, kazanım grafiği
  - `/tr/site-yonetici-davet` (yönetici-side) — unique kod (UPU referansı)
  - Sakin aidat ekranında "Kredi bakiyesi" satırı + "Kredi kullan" checkbox
  - Yönetici görünüm `/tr/site-referans-yonet` — toplam referans, top referrer'lar
- **3.7.5 Agent:**
  - Tool `get_referral_status` (referrer_id)
  - Tool `top_referrers` — yönetici için
- **3.7.6 WA:**
  - Davet edilen sakin/yönetici kabul ettiğinde referrer'a "Davetin kabul oldu, ilk ödeme/abonelikle ₺X kazanacaksın" push
  - İlk ödeme tetiklendiğinde "Kredin tahakkuk etti" push
- **3.7.7 Tahmini saat:** Tasarım 2 / Kod 5 / Test 3 = **10 saat**
- **3.7.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, viral B2B + B2C büyüme aracı)
- **3.7.9 Marketing parlatma:** *"Sakin arkadaşına daire kiralatır, aidatı %10 düşer. Yönetici başka yöneticiyi davet eder, UPU aboneliği %50 indirimle başlar. Viral büyüme: 6 ayda referansla gelen yönetici sayısı +%30."*

---

### 3.8 Aktif Öneri Motoru (Yatay — Tüm SaaS'larda Aynı Pattern)

- **3.8.1 Ne yapacak:** Sayfa açar açmaz "Sana özel 3 öneri" — sistem son N gün veriyi tarayıp aksiyona dönüşebilen kısa tavsiyeler sunar. Örn: *"Aidatı geciken 5 sakine WA hatırlatma at"*, *"Bu hafta bakım sözleşmesi biten 2 firma var — yenileme teklifi hazırla"*, *"Yıllık genel kurul 20 gün sonra — duyuru taslağı hazırla"*, *"Spor salonu Pazartesi 19:00 boş 4 slot — sakinlere öneri at"*, *"3 memnuniyetsiz sakin son 7 günde 2+ talep açtı — geri arama planla"*.
- **3.8.2 Nasıl çalışır:**
  - Rule registry — siteyonetim için 5-7 öneri kuralı (event/query/threshold + suggestion template + action_type).
  - Saatlik cron tüm rule'ları evaluate eder; eşik aşıldığında `recommendation_runs` row açılır (idempotency: aynı user × rule × hedef 24h kapalı).
  - Dashboard widget en yüksek skorlu 3 öneri gösterir (skor = recency × impact × actionability).
  - Action button 1-tıkla aksiyona: WA broadcast taslağı / duyuru pre-fill / ödeme planı modal / rezervasyon takvim deeplink / kampanya tetik.
  - **Yatay yapı:** engine tenant-agnostic (`src/platform/recommendations/engine.ts`), siteyonetim yalnız `src/tenants/siteyonetim/recommendations.ts` adapter dosyası verir (SITE_RULES: aidat geciken sakin, bakım sözleşme bitimi, yıllık genel kurul yaklaşan, ortak alan boş slot, memnuniyetsiz sakin yanıt vb.).
- **3.8.3 Backend:**
  - Migration: ortak `recommendation_rules` + `recommendation_runs` tabloları (bayi master plan 3.8 ile aynı şema, tenant_key alanı ile filtre).
  - Helper: ortak `src/platform/recommendations/engine.ts` — tenant-agnostic dispatcher.
  - Tenant adapter: `src/tenants/siteyonetim/recommendations.ts` — SITE_RULES (5-7 kural).
  - Cron: ortak `/api/cron/recommendations` (saatlik) — tüm tenant adapter'ları çalıştırır.
- **3.8.4 UI:**
  - Ortak `src/components/recommendations/RecommendationCard.tsx` (panel-aware, tenant-aware).
  - Siteyonetim yönetici dashboard üstüne mount — "Sana özel 3 öneri" başlık + 3 kart.
  - `/tr/site-oneriler` full liste sayfası — geçmiş + dismissed dahil, filter (open/acted/dismissed), severity badge.
  - Action handler modal'ları (tenant-shared): WA broadcast taslağı, duyuru pre-fill, ödeme planı, rezervasyon deeplink.
- **3.8.5 Agent:**
  - Tool `get_recommendations` (limit=5) — son 24h `recommendation_runs status='open'` listesi.
  - Tool `act_on_recommendation` (run_id, choice='accept'|'dismiss') — action_type'a göre downstream tool çağırır.
  - Agent prompt'a context: "şu an N öneri açık" — chat başında proactive sunabilir.
- **3.8.6 WA:**
  - Severity='high' öneri 6 saatte action edilmezse yöneticiye WA hatırlatma.
  - Action sonucu downstream sendNotification helper çalıştırır.
- **3.8.7 Tahmini saat:** Tasarım 1 / Kod 2 / Test 1 = **4 saat** (adapter + 5-7 kural; engine + UI bayi fazında zaten yazıldı, burada yalnız adapter)
- **3.8.8 Öncelik:** **Orta** (Faz B — 3.1 skor + 3.2 risk + 3.3 cross-sell verilerini tüketir). **Yatay yapı:** engine + UI bayi master planda yazıldı; siteyonetim yalnız adapter ekler.
- **3.8.9 Marketing parlatma:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi sakine WA hatırlatma atılmalı, hangi sözleşme yenilenmeli, hangi rezervasyon teşvik edilmeli söyler. Tıkla, yapsın. Yönetim ofisinin sessiz asistanı."*

---

## 4. Faz Sırası

### Faz A — Hızlı Kazanç (1-2 hafta, **Kritik**)

**Kapsam:** 3.1 Sakin Memnuniyet & Aidat Düzeni Skoru + 3.2 Aidat Geciken / Memnuniyetsiz Sakin Uyarısı

**Gerekçe:**
- Her ikisi aynı veri katmanını (aidat ödeme geçmişi + talep + memnuniyet sinyali) tüketir — paralel implement edilebilir.
- Anlık değer: ilk gün yönetici paneli açtığında "5 sakin kritik durumda" banner'ı görür → SaaS değerinin somut kanıtı.
- Diğer katmanlar (3.3 cross-sell, 3.4 otomasyon) skor/risk verisini condition'da kullanır — Faz A altyapı.
- Mevcut WA komutları (aidat, borcum, ariza) ham veri sağlar — yeni komut yazmadan skor hesaplanabilir.
- Migration risk düşük (yeni tablo + view, yıkıcı değişiklik yok).

**Tahmini:** 14 saat

### Faz B — Orta (3-4 hafta)

**Kapsam:** 3.3 Ek Hizmet Önerisi + 3.4 Otomatik Aidat Hatırlatma & Bakım Tetiği + **3.8 Aktif Öneri Motoru (adapter)**

**Gerekçe:**
- Faz A'nın skor + risk verisini segment/condition olarak kullanır.
- Cross-sell rekomandasyon motoru bağımsız ama ortak `site-recommendations` modülünde toplanır.
- Otomatik hatırlatma kural motoru: en yüksek manuel-iş-azaltma kazancı, marketing pitch'inde "70% manuel azaltma" iddiası buradan.
- **3.8 Aktif Öneri Motoru** Faz A+B'nin tüm output'larını (skor, risk, cross-sell, tetik) tek widget'a toplar — "panel açar açmaz aksiyon" deneyimi. **Yatay yapı:** engine + UI bayi fazında yazıldı; siteyonetim yalnız adapter (~4 saat).

**Tahmini:** 26 saat (10 + 12 + 4)

### Faz C — Uzun Vadeli (5-8 hafta)

**Kapsam:** 3.5 Site Bilgi Sayfası + Lead + 3.6 Sakin Drip + 3.7 Referans Programı

**Gerekçe:**
- 3.5 Vitrin: yeni public route + yönetici-tarafı yeni yüzey, en uzun kapsamlı modül; kira/satış zincirinde değer.
- 3.6 Drip: 3.4 trigger sistemini genişletir, yeni sakin onboarding + yıllık memnuniyet dizilerine taşır.
- 3.7 Referans: bağımsız viral büyüme aracı, hem sakin (B2C) hem yönetici (B2B) tarafı; billing entegrasyonu (Iyzico/Mollie kupon code) ile bağlı.
- Faz C bittiğinde "satış lokomotifi" söylemi tam olarak savunulabilir hale gelir.

**Tahmini:** 38 saat

---

## 5. Toplam Saat Tahmini

| Katman | Tasarım | Kod | Test | Toplam |
|--------|---------|-----|------|--------|
| 3.1 Sakin Memnuniyet & Aidat Skoru | 1 | 4 | 2 | **7** |
| 3.2 Geciken / Memnuniyetsiz Sakin Uyarısı | 1 | 4 | 2 | **7** |
| 3.3 Ek Hizmet & Ortak Alan Önerisi | 2 | 5 | 3 | **10** |
| 3.4 Otomatik Aidat Hatırlatma & Bakım Tetiği | 2 | 7 | 3 | **12** |
| 3.5 Site Bilgi Sayfası + Lead | 2 | 8 | 4 | **14** |
| 3.6 Sakin Drip (Onboarding/Memnuniyet/Aidat) | 2 | 8 | 4 | **14** |
| 3.7 Referans Programı (Sakin + Yönetici) | 2 | 5 | 3 | **10** |
| 3.8 Aktif Öneri Motoru (yatay adapter) | 1 | 2 | 1 | **4** |
| **TOPLAM** | **13** | **43** | **22** | **78 saat** |

**Faz bazında:** Faz A 14h · Faz B 26h · Faz C 38h
**Kalibrasyon notu:** Siteyonetim'in mevcut UI yüzeyi bayi'den dar (`/site` ana page + 7 WA komutu). Bu yüzden 3.1/3.2 daha hızlı (ortak veri katmanı). 3.5 vitrin tarafında bayi'ye benzer kompleksite ama lead-to-resident dönüşüm daha basit (onay → kayıt). 3.8 yatay: engine + UI bayi master planında yazıldı; burada yalnız `siteyonetim/recommendations.ts` adapter ~4 saat.

---

## 6. Bağımlılıklar ve Riskler

### Üçüncü taraf entegrasyon
- **Iyzico / Stripe / Mollie:** mevcut değil — 3.7 referans + sakin online aidat ödeme için ödeme sağlayıcı seçimi gerekir (TR için Iyzico öncelik). Aidat link akışı için ek faz veya 3.4'e merge.
- **WA Cloud API:** mevcut — 3.4/3.6 broadcast'lerde **24-saat customer service window** gate zorunlu. Aidat hatırlatma template message gerekirse Meta onay süresi 3-5 gün; freeform için son inbound 24h gate.
- **SMS gateway (Netgsm / Twilio):** 3.4'te "vadede SMS" adımı için gerekli, mevcut değil — opsiyonel veya WA-only.
- **E-posta SES/Postmark:** 3.6'da fallback için yok — eklenmesi gerekir veya başlangıçta WA-only drip.

### Veri kalitesi gereksinimleri
- **3.1 + 3.2** için en az **3 ay** aidat + talep + memnuniyet verisi gerekir. Yeni tenant'ta scoring "Yeterli veri yok" placeholder; cron 90 günden sonra skor hesaplar.
- **3.3 Cross-sell** için en az **20 rezervasyon** geçmişi gerek; altında "geliştirme aşamasında" UI.
- **3.5 Vitrin** için yöneticinin site bilgilerini (foto, ortak alan listesi, açık saat) doldurması gerek — boş vitrin yayınlanmaz.

### DB migration kuralları (CLAUDE.md)
- 14-digit timestamp prefix, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- DROP/destructive ALTER → ASK first.
- Worker SQL dosyasını yazar + `supabase db push` ile apply eder + commit + push. Migration `supabase/migrations/`.
- Diğer worker'lar (bayi/emlak) parallel çalışıyorsa rapor sonu `git pull` notu zorunlu.

### Backward compat
- WA komut router AKTİF — Faz B/C broadcast UI'sı yeni route kullanacak, mevcut 7 komut (aidat, ariza, binakodu, borcum, durum, duyuru, kayit, rapor) korunur. Yeni sakin self-service komutları (rezervasyon, etkinlik) opsiyonel.
- `site/init` endpoint'i ve sakin profili pattern'i mevcut — yeni sayfalar bu auth akışı üzerine inşa edilir (`requireAuth` + `resolveTenantProfile` zorunlu).
- `notifications` tablosu mevcut — 3.4/3.6 mesaj sendNotification helper'a düşer, audit trail merkezi.

### Risk haritası
| Risk | Olasılık | Etki | Karşı önlem |
|------|----------|------|-------------|
| Skor formülü sakin tarafından "haksız" algılansa | Orta | Yüksek | Skor sakine GÖSTERİLMEZ (yalnız yönetici görür) + açık formül + yönetici override |
| WA 24h window ihlali → Meta hesap askısı | Düşük | Çok yüksek | `shouldNotify` gate'inde `last_inbound_at` kontrolü zorunlu, aidat hatırlatma template onayı |
| Aidat hatırlatma spam → sakin opt-out fırtınası | Orta | Yüksek | step başına opt-out link + frequency cap (aidat dönemi başına max 3 mesaj) + KVKK aydınlatma |
| Vitrine slug çakışması | Düşük | Düşük | UNIQUE + auto-suffix (-2, -3) |
| Referans kupon stack abuse (aidat indirimi) | Orta | Orta | Max 1 kredi/aidat + aylık cap (₺200) + audit log |
| Sakin KVKK / kişisel veri ihlali | Düşük | Çok yüksek | Sakin telefonu yalnız tenant scope + RLS + lead → resident dönüşümünde explicit consent |

---

## 7. Kabul Kriterleri (Acceptance)

### Faz A bitince
- [ ] Yönetici `/tr/sakinler` → sakin liste'de "Skor" kolonu, sort çalışıyor
- [ ] Yönetici `/tr/sakinler/[id]` → "Memnuniyet" tabı 4 alt-skor + 12-hafta trend grafiği
- [ ] Yönetici site dashboard → "5 sakin kritik durumda" banner görünüyor
- [ ] `/tr/site-kritik-sakin` sayfa açılıyor, recovery aksiyon CTA (ödeme planı önerisi) çalışıyor
- [ ] Cron `site-scoring` haftalık, `site-churn` günlük schedule'a alındı, manuel test başarılı
- [ ] Agent `get_resident_score` + `get_overdue_residents` tool'ları çalışıyor, quota artmıyor sıfır kullanımda
- [ ] WA: skor 40 altına düşen sakin tetiği yöneticiye ulaştı (test sakin ile)

### Faz B bitince
- [ ] Sakin mini-panel / yönetici görünümünde "Senin için / Bu sakine öner" rail 5 hizmet/rezervasyon gösteriyor
- [ ] `/tr/site-otomasyon` sayfa açıyor, "Yeni Kural" wizard tamam
- [ ] Trigger çalıştığında: sakin WA mesajı, geçmiş tab'da log var, idempotency 7 gün
- [ ] Cron `site-recommendations` günlük, `site-campaign-triggers` saatlik
- [ ] Agent `suggest_communal_usage` + `create_campaign_trigger` tool'ları çalışıyor
- [ ] Yönetici dashboard üstüne "Sana özel 3 öneri" widget — 3 öneri görünür (aidat/talep/rezervasyon karışımı)
- [ ] Öneri kartında 1-tıkla aksiyon: WA broadcast modal / duyuru pre-fill / ödeme planı modal / rezervasyon deeplink
- [ ] `/tr/site-oneriler` full liste sayfası (filter: open/acted/dismissed)
- [ ] `recommendations` adapter (`src/tenants/siteyonetim/recommendations.ts`) 5-7 SITE_RULES tanımlı, evaluate çalışıyor
- [ ] Severity='high' öneri 6 saatte acted değilse yönetici WA hatırlatma alındı

### Faz C bitince
- [ ] `/v/<site-slug>` public sayfası açıyor (auth-free), site bilgisi + son duyurular + lead form submit edilebiliyor
- [ ] Yönetici `/tr/site-basvurular` lead listesi + onay/red akışı tam, onaylanan lead sakin kaydına dönüşüyor
- [ ] `/tr/site-marketing` drip editor 5-step wizard tamam (yeni sakin onboarding / yıllık memnuniyet / aidat teşvik)
- [ ] Sakin `/tr/site-davet-et` unique kod görüyor, paylaş çalışıyor; davet kabul + ilk aidat → kredi tahakkuk
- [ ] Yönetici `/tr/site-yonetici-davet` unique kod görüyor, davet edilen yönetici UPU abonelik → kredi
- [ ] Sakin aidat ekranında kredi bakiyesi satırı + "Kredi kullan" checkbox aktif

---

## 8. Pazarlama Mesajları (Sales-Ready Liste)

Her katman için landing page, demo, satış sunumunda kullanılabilir 1-2 cümlelik vurgu:

- **3.1 Sakin Memnuniyet & Aidat Skoru:** *"Sakinlerinin memnuniyet ve aidat düzenini 0-100 skorla anında görür, kime daha fazla ilgi gerek bilirsin — memnuniyet paneli ilk 2 ayda tahsilat oranını %22 yukarı çeker."*
- **3.2 Geciken / Memnuniyetsiz Sakin Uyarısı:** *"Aidat 30 günü geçmeden sistem haber verir — otomatik ödeme planı önerisi + iletişim ile gecikme oranını %35 düşürür."*
- **3.3 Ek Hizmet & Ortak Alan:** *"Her sakin için 'senin gibi sakinler bunu da kullandı' önerisi — ortak alan doluluk %25 artar, site içi hizmet geliri büyür, sakin memnuniyeti yükselir."*
- **3.4 Otomatik Aidat Hatırlatma & Bakım Tetiği:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın — vade öncesi WA, vade sonrası SMS, sözleşme bitimine 30 gün uyarı. Manuel hatırlatma saatleri %70 azalır."*
- **3.5 Site Bilgi Sayfası + Lead:** *"Her sitenin kendi mini bilgi sayfası — daire arayan internetten başvurur, yöneticiye anlık WA gider. Bir yönetim ofisi, sınırsız online vitrin."*
- **3.6 Sakin Drip:** *"Yeni taşınan sakine onboarding, yıllık memnuniyet anketi, aidat teşvik — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu sakinleri taşır."*
- **3.7 Referans Programı:** *"Sakin arkadaşına daire kiralatır, aidatı %10 düşer. Yönetici başka yöneticiyi davet eder, UPU aboneliği %50 indirimle başlar. Viral büyüme, sıfır maliyet."*
- **3.8 Aktif Öneri Motoru:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi sakine hatırlatma atılmalı, hangi sözleşme yenilenmeli, hangi rezervasyon teşvik edilmeli söyler. Tıkla, yapsın."*

**Üst başlık vurgu (landing hero):**
*"UPU Siteyönetim — aidat + talep + duyuru yetmez. Tahsilat oranını arttırır, sakini memnun eder, ofis rutinini otomatize eder. Bir abonelik, 7 satış lokomotifi."*

---

## 9. Yatay Yapı (Tüm Tenant'larda Aynı Engine)

Aşağıdaki modüller bayi master planında **engine + UI** olarak yazılır, siteyonetim yalnız **adapter** (~2 saat/modül) ekler. Toplam yatay kazanç: 5 tenant × 4 modül × ~2 saat = ~40 saat tasarruf platform genelinde.

| Modül | Engine yolu | Siteyonetim adapter | Adapter saat |
|-------|-------------|---------------------|--------------|
| Aktif Öneri Motoru (3.8) | `src/platform/recommendations/engine.ts` | `src/tenants/siteyonetim/recommendations.ts` (SITE_RULES) | ~2 |
| Vitrin + Lead (3.5) | `src/platform/bayi-vitrine/` pattern → `src/platform/site-vitrine/` veya unified `vitrine/` | siteyonetim render adapter (site bilgi şeması, lead_type enum) | ~2 |
| Drip Engine (3.6) | `src/platform/bayi-marketing/drip-engine.ts` → ortak `drip-engine.ts` | siteyonetim audience adapter (segment: yeni sakin / aidat geciken / memnun) | ~2 |
| Referral Engine (3.7) | `src/platform/bayi-referral/engine.ts` → ortak referral engine | siteyonetim reward adapter (aidat indirimi / abonelik indirimi) + ledger tenant config | ~2 |
| Notification helper | `src/platform/notifications/send-notification.ts` | Ortak — tenant_key parametresi ile | 0 |

**Sonuç:** Siteyonetim master plan'ında 3.5/3.6/3.7 saatleri "yatay yapı varsayımıyla" hesaplandı (engine zaten var). Engine yoksa +30-40 saat ekstra; o saat bayi master planında ödenir. Bu master plan **bayi master planının yatay engine'lerini tükettiği varsayımıyla** kalibre edilmiştir.

---

## 10. Sıradaki Adım

Bu master plan Çağrı tarafından onaylandıktan sonra:

1. **Faz A başlatma:**
   - Worker: siteyonetim (tmux upu-siteyonetim)
   - İlk commit: `feat(db): site_resident_scores + site_churn_signals view migration`
   - İkinci commit: `feat(site-scoring): cron + helper (calculate.ts)`
   - Üçüncü commit: `feat(siteyonetim): /tr/site-kritik-sakin + score badge + sakinler liste sort`
   - 4. commit: `feat(agent/siteyonetim): get_resident_score + get_overdue_residents tools`

2. **Sprint task'larına böl:** Faz A her katman için 4-5 task (DB migration → API → UI → cron → agent tool → WA template → kabul testi).

3. **Bağımlılık check:**
   - 3.8 adapter'ı yazmadan önce `src/platform/recommendations/engine.ts` mevcut mu kontrol (bayi worker'ı Faz B'sini bitirdi mi?). Yoksa siteyonetim Faz B yarım kalır → bayi worker'ı ile koordine et.
   - 3.5/3.6/3.7 için aynı şekilde yatay modül mevcudiyeti kontrolü.

4. **Versiyonlama:** Her sprint sonunda bu doküman `Versiyon 1.1`, `1.2` şeklinde güncellenir. "Tamamlandı / Devam / Plan" durumları her katman üstüne işaretlenir.

---

*Bu doküman siteyonetim worker (`tmux upu-siteyonetim`) tarafından 2026-05-22 tarihinde üretildi. Mevcut `site/init` endpoint, sakin profili pattern ve 7 WA komutu üzerine inşa edilmiştir. Onay sonrası Faz A başlatılır.*
