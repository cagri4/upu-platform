# Emlak SaaS — Master Plan (Satış Lokomotifi Dönüşümü)

> **Tarih:** 2026-05-22
> **Versiyon:** 1.0 — Bayi master plan v1.1 şablonundan emlak (gayrimenkul danışmanlığı + CRM + portföy + sunum + websitem) tenant'ına adapte edilmiştir
> **Sahibi:** Çağrı
> **Worker:** emlak (tmux upu-emlak)
> **Durum:** Onay bekliyor — Faz A başlatma için
> **Mevcut ilerleme:** Faz 6 (KVKK consent + Google bağla + WA OTP step-up + branded QR + 2-buton login) ve Faz 7 (KVKK aydınlatma metni + Gizlilik paneli) tamamlandı; satış lokomotifi katmanları sıra.

---

## 1. Mevcut Durum (5 Açılı Değerlendirme)

### 1.1 UI Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Panel sayfaları | 18+ sayfa (panel, mulklerim, musterilerim, sunumlarim, sozlesmelerim, sozlesme-yap, takvim, takip, ara, bildirimler, oneri, uyelik, panel-ayarlari, eklenti, hakkinda, destek, web-sayfam, profil-duzenle) | Onboarding tur akışı, müşteri detay timeline, portföy analitiği (drill-down), audit log | `mulkekle-form` ve `musteri-ekle-form` ayrı sayfalar — modal'a alınabilir |
| Sidebar nav | Role-aware (emlakçı / broker / asistan), separatorBefore gruplama | Sub-menu collapse yok | — |
| Mobile UX | Bottom drawer + topbar, responsive grid, mobile-first form | PWA installable test edilmedi, fotoğraf çekip mülke ekleme akışı pürüzlü | — |
| Agent widget | Sağ alt floating, slide-in panel, 3 katman quota UX | Streaming yok, suggestion chip dinamik değil, sesli not transcripti yok | — |
| Bell + bildirim merkezi | Topbar bell badge, geçmiş sayfası, filter | Browser push, e-posta fallback | — |
| Sunum (presentation) | `sunumlarim` listesi, sunum oluştur akışı, magic token viewer link | Sunum açılma analitiği zayıf (view event log eksik), sunum kapanışına bağlı CTA yok | — |
| Web-sayfam (kişisel vitrin) | `/tr/web-sayfam` editör başlangıcı | Public render (`/v/<slug>`) eksik veya basit; lead form yok, SEO meta yok | — |

### 1.2 Dağıtıcı (Admin) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Emlakçı yönetimi | Liste, detay, davet (statik + branded QR), üyelik plan görünümü | **Müşteri sıcaklık ortalaması, soğuma riski göstergesi**, segmentasyon, sahaya çıkış takvimi | — |
| Müşteri (lead) | CRUD, kaynak, etiket, takip log | Otomatik soğuma flag, son dokunma > 30 gün filter, kriter-eşleşme metriği | — |
| Portföy | CRUD, fotoğraf, lokasyon, fiyat geçmişi | Stok-yaşı analizi, fiyat-düşürme tavsiyesi, ilan yenileme hatırlatma | — |
| Sözleşme | CRUD, taraflar, başlangıç/bitiş, tip (kiralama/satış) | **Bitime 30 gün kalan otomatik uyarı**, yenileme akışı, mülk sahibi kaybı banner'ı | — |
| Sunum | CRUD, magic-link token, görüntülenme sayısı temel | Açılma + scroll + tıklama analitiği, sunum sonrası lead CTA dönüşüm | — |
| Eşleşme motoru | Basit "kriter A=B" match (eslestir komutu) | **ML-light upgrade**: co-occurrence (3+1 → 4+1), alıcı + yatırımcı ortak match | — |
| Marketing | Hiç yok | Drip campaign, segmentli WA broadcast, mülk sahibi yıllık değer raporu | — |
| Audit + KVKK | Aydınlatma metni + consent modal + gizlilik paneli (Faz 7 tamam) | Kullanıcı verisi indirme/silme self-service, audit log sayfası | — |
| Billing | Mollie plan tier (Free/Starter/Pro/Premium), iptal | Yıllık ödeme indirimi, kupon, ek paket (sınırsız sunum), referans kredisi entegrasyonu | — |

### 1.3 Emlakçı (Reseller / Danışman) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Onboarding | `/tr/uye-ol` + branded QR + Google bağla (Faz 6) | İlk kayıt sonrası rehberli tur, ilk mülk ekleme wizard | — |
| Mülk ekle | `mulk-ekle` WA + `mulkekle-form` web | Toplu import (CSV), fotoğraf bulk upload sürükle-bırak | — |
| Müşteri yönet | `musterilerim`, `musteri-ekle`, `musteri-takip`, `musteri-sil` | **Sıcaklık skoru görünür değil**, "bugün ara" listesi, otomatik takip hatırlatma | — |
| Sunum oluştur | `sunum-olustur` + magic link | Sunum şablon kütüphanesi, marka logo + renk customize, sunum açıldığında WA push | — |
| Mini vitrin | `web-sayfam` editör başlangıcı | **Lead form çalışır halde değil**, public `/v/<emlakci-slug>` portföy katalogu eksik, SEO + OG tag yok | — |
| Sahaya çıkış | Yok | Mobile-first çağrı listesi, "bugün ara" timeline (3.6 müşteri segmentinden besler) | — |
| Performans dashboard | Temel rakamlar (mülk/müşteri sayısı) | **Aylık görüşme sayısı, sunum açılma oranı, dönüşüm grafiği** | — |

### 1.4 UPU Claude Agent (AI Eleman) Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| Tools | Emlak tarafında temel set (mülk listele, müşteri özet, eşleştir, sunum durumu) | `get_customer_heat_score`, `get_cooling_customers`, `get_expiring_contracts`, `suggest_property_match`, `create_followup_campaign`, `route_lead_to_agent` | — |
| Quota | 4 plan tier, 3 katman UX, period renewal cron | Token + cost grafiği, kullanılmayan tool öneri | — |
| Prompt | Tenant-aware (emlak prompt), `cache_control: ephemeral` | Streaming SSE, mod karakter geçiş (özet / pazarlama / Q&A) | — |
| Proactive | Yok | Sabah özeti push (bugün aranacak müşteri + sözleşme bitiyor), agent-initiated WA mesajı | — |
| Defense | Cross-tenant `saveMessage` guard, tool tenant assert | — | — |

### 1.5 WhatsApp Açısı

| Kategori | Var | Eksik | Fazla / Temizlenmeli |
|----------|-----|-------|---------------------|
| WA komut router | Emlak komut seti aktif (portfoyum, musterilerim, fiyatsor, eslestir, sunum, ipucu, sozlesme, takip-et, vb. 20+ komut) | Komut router'a sezgisel doğal-dil köprü (Claude agent fallback) | Bazı komut handler'ları placeholder (örn `medya.ts`, `web-sayfam.ts` minimal) — pivot tamamlanmalı |
| Notification push | `sendText` / `sendUrlButton` / `sendNotification`, KVKK + DND gate, WA OTP step-up (Faz 6.6) | Soğuyan müşteri tetik push, sözleşme bitimi push, sunum açıldı geri bildirimi | — |
| Sabah brifing | Cron mevcut (genel) — emlak için kısaltma + müşteri/sözleşme parametresi yok | "Bugün arayacağın 3 müşteri" + "30 gün içinde biten 2 sözleşme" formatı | — |
| Broadcast | Hiç (manuel sendButtons handler vardı) | Segment broadcast UI (sıcak müşteri listesi, mülk sahibi grubu) + 24h gate | — |
| Lead → emlakçı routing | Manuel | **Yeni lead public formdan geldiğinde emlakçıya anlık WA push** (3.5 vitrine ile bağlı) | — |

---

## 2. Hedef: Satış Lokomotifi B2C/B2B SaaS

**Vizyon:** Bu SaaS'ı alan emlakçı / broker / ofis sahibi; portföy + müşteri + sunum + sözleşme + websitem'i tek yerde yönetir; soğuyan müşteriyi sistem ona hatırlatır, sözleşmesi biten mülk sahibini kaybetmez, otomatik mülk-müşteri eşleşmesi ile daha az dokunarak daha çok satar.

**Pazarlama vurgusu:** *"Müşteriyi bul, sunumu hazırla, sözleşmeyi kapat — sistem önden düşünür."* Tek aboneliğin içinde 7 satış lokomotifi: sıcaklık skoru, soğuma uyarısı, akıllı eşleşme, otomatik takip, mini vitrin + lead, drip marketing, tavsiye programı + aktif öneri motoru.

**Ölçülebilir hedefler (Faz A+B+C sonu, 6 ay):**
- Aylık kapanan sözleşme +%20 (akıllı eşleşme + sıcak müşteri tetik)
- Müşteri "kaybı" (30+ gün dokunulmamış lead) -%40 (soğuma uyarısı + recovery drip)
- Mülk sahibi kaybı (sözleşme bitip yenilenmeyen) -%35 (30 gün önce uyarı)
- Manuel takip / mesaj hazırlama saati -%65
- Lead → görüşme dönüşüm +%30 (mini vitrin + lead form, otomatik routing)
- Aylık abonelik upgrade oranı (Starter→Pro) +%25

---

## 3. 7+1 Satış Lokomotifi Katmanı

### 3.1 Müşteri Sıcaklık Skoru

- **3.1.1 Ne yapacak:** Her müşteriye 0-100 sıcaklık skoru — engagement (WA yanıt hızı), takip yanıtı, görüşme sayısı, sunum açma + scroll davranışı, kriter eşleşme yoğunluğu karışımı.
- **3.1.2 Nasıl çalışır:**
  - Cron (günlük) her müşteri için 5 alt-skor hesaplar (Engagement / Takip Yanıtı / Görüşme / Sunum Etkileşimi / Eşleşme Yoğunluğu).
  - Skor `emlak_customer_heat_scores` tablosuna yazılır + haftalık snapshot timeline.
  - Müşteri listesinde renk kodlu pill (🔥 sıcak / 🌤 ılık / ❄️ soğuk), liste sort + filter.
- **3.1.3 Backend:**
  - Migration: `emlak_customer_heat_scores` (customer_id, agent_id, period_start, score_total, sub_engagement, sub_followup, sub_meeting, sub_presentation, sub_match, snapshot_at).
  - Helper: `src/platform/emlak-scoring/calculate.ts` — formula + persist.
  - Cron: `/api/cron/emlak-heat-scoring` (günlük 02:30).
- **3.1.4 UI:**
  - `src/components/emlak/CustomerHeatBadge.tsx` (renk kodlu pill + tooltip breakdown).
  - `musterilerim` liste sayfasında skor kolonu + sort + "🔥 Sıcak" filter chip.
  - `musterilerim/[id]` detayda "Sıcaklık" tabı (5 alt-skor + 8-hafta trend grafiği).
- **3.1.5 Agent entegrasyonu:**
  - Yeni tool `get_customer_heat_score` (customer_id veya top_n) — "en sıcak 5 müşterim kim?" sorusu cevaplanır.
  - Yeni tool `compare_customers` (top-3 vs bottom-3, agent için pazarlama önerisi üretir).
- **3.1.6 WA entegrasyonu:**
  - Sabah brifingine: "🔥 Bugün arayacağın 3 sıcak müşteri" satırı.
  - Skor 80+ aniden yükseldiğinde emlakçıya "🚀 Ahmet Yılmaz sıcaklığı yükseldi — şimdi ara" push.
- **3.1.7 Tahmini saat:** Tasarım 1 / Kod 5 / Test 2 = **8 saat**
- **3.1.8 Öncelik:** **Kritik** (Faz A — temel veri katmanı, diğer katmanlar bu skoru tüketir)
- **3.1.9 Marketing parlatma:** *"Her müşterinin gerçek sıcaklığını 0-100 skorla anında görür, kimi şimdi araman gerek bilirsin — sıcaklık paneli kapanan sözleşmeyi %20 artırır."*

---

### 3.2 Müşteri Soğuma & Mülk Sahibi Kaybı Erken Uyarı

- **3.2.1 Ne yapacak:** İki paralel uyarı:
  1. **Müşteri soğuması:** 30/60/90 gün konuşulmayan müşteri "soğuyor" işaretlenir, recovery aksiyonu sunulur.
  2. **Mülk sahibi kaybı:** sözleşme bitime 30/15/7 gün kala "kaybedebilirsin" banner'ı, yenileme akışı.
- **3.2.2 Nasıl çalışır:**
  - View `emlak_customer_cooling_signals`: son dokunma, sıcaklık skor düşüşü (4-haftalık delta), yanıtsız mesaj sayısı kombinasyonu.
  - View `emlak_contract_expiry_signals`: sözleşme bitime kalan gün + yenileme niyeti flag.
  - 3 seviye: 🟢 Sağlıklı / 🟡 Watch / 🔴 Yüksek Risk.
  - Dashboard banner "5 müşteri soğuyor, 2 sözleşme 30 gün içinde bitiyor — Aksiyon Al".
- **3.2.3 Backend:**
  - Migration: SQL view `emlak_customer_cooling_signals` (read-only).
  - Migration: SQL view `emlak_contract_expiry_signals` (read-only, `expires_at - now()` bucket).
  - Helper: `src/platform/emlak-churn/score.ts` — risk hesabı + threshold config.
  - Cron: `/api/cron/emlak-churn` (günlük 03:30) — eşik aşan müşteri/sözleşme için notification + skor update.
- **3.2.4 UI:**
  - `musterilerim` liste sayfasına "❄️ Soğuyor" filter chip.
  - `sozlesmelerim` liste sayfasına "⏳ 30 gün içinde bitiyor" filter chip.
  - `/tr/musteri-risk` yeni sayfa: soğuyan müşteriler + biten sözleşmeler tabloda, "Recovery aksiyonu" CTA (otomatik WA + sunum hatırlatma veya yenileme teklifi).
  - `musterilerim/[id]` detayda "Soğuma Sinyalleri" kartı (son dokunma, yanıtsız mesaj, neden flagged).
- **3.2.5 Agent:**
  - Tool `get_cooling_customers` (top_n) — sabah özetinde proactive.
  - Tool `get_expiring_contracts` (within_days=30) — biten sözleşme listesi.
  - Tool `trigger_recovery_action` (customer_id, action_type='followup_wa'|'present_new_property'|'contract_renewal').
- **3.2.6 WA:**
  - Müşteri 60 günü aştığında emlakçıya ⚠️ push.
  - Sözleşme bitime 30 gün kalınca mülk sahibine "yenileme görüşmesi" hatırlatma, emlakçıya paralel push.
  - Recovery aksiyon onayında müşteriye otomatik WA mesajı (24h window kontrolü).
- **3.2.7 Tahmini saat:** Tasarım 1 / Kod 5 / Test 2 = **8 saat** (iki paralel view bayi tek view'dan kompleks)
- **3.2.8 Öncelik:** **Kritik** (Faz A — sıcaklık skoru ile aynı veri katmanını paylaşır, immediate value)
- **3.2.9 Marketing parlatma:** *"Müşterini kaybetmeden 30 gün önce, mülk sahibini kaybetmeden 30 gün önce sistem haber verir — otomatik recovery ile müşteri kaybı %40, mülk sahibi kaybı %35 düşer."*

---

### 3.3 Akıllı Mülk-Müşteri Eşleşme Motoru (ML-Light Upgrade)

- **3.3.1 Ne yapacak:** Mevcut basit "kriter A=B" eşleşmesini ML-light upgrade — co-occurrence öğrenmesi ile "3+1 isteyen genelde 4+1'e de razı oluyor", "alıcı kategorisinden yatırımcıya atlama", lokasyon yakınlığı, fiyat esnekliği bandı.
- **3.3.2 Nasıl çalışır:**
  - Tarihsel kapanan sözleşme + sunum açılma analitiğinden co-occurrence öğrenir: hangi kriter kümeleri birlikte oluyor.
  - Müşteri kriterleri vektör + portföy kriterleri vektör → cosine + business-rule weight.
  - Her müşteriye günlük "top 5 eşleşen mülk" + her mülke "top 5 ilgilenebilir müşteri" listesi.
  - Mülk ekle ekranında "Bu mülke uygun 7 müşterin var — sunum hazırla" CTA.
  - Müşteri detayda "Senin için 5 yeni eşleşme" widget.
- **3.3.3 Backend:**
  - Migration: `emlak_match_pairs` (customer_id, property_id, score, reasons JSONB, computed_at, expires_at) — günlük cron yeniler.
  - Migration: `emlak_criteria_cooccurrence` (criteria_a, criteria_b, co_count, score) — haftalık aggregate.
  - Helper: `src/platform/emlak-matching/engine.ts` — vector + cosine + rule layer.
  - Cron: `/api/cron/emlak-matching` (günlük 04:00).
  - Mevcut `eslestir` komut handler'ı bu motoru tüketecek şekilde refactor.
- **3.3.4 UI:**
  - `musterilerim/[id]` detayında "Eşleşen Mülkler" rail (5 kart, score badge, "Sunum Hazırla" buton).
  - `mulklerim/[id]` detayında "İlgilenebilir Müşteriler" rail (5 kart, score badge, "WA gönder" buton).
  - `mulk-ekle` form submit sonrası ekran: "Bu mülke uygun 7 müşterin var" success state.
- **3.3.5 Agent:**
  - Tool `suggest_property_match` (customer_id) — chat'te "Ahmet için ne uygun?" cevabı.
  - Tool `suggest_customer_match` (property_id) — "yeni eklediğim X mülküne kim uygun?".
  - Tool `bulk_match_proposal` (segment) — "ilk 10 sıcak müşteriye yeni mülk önerisi taslağı".
- **3.3.6 WA:**
  - Yeni mülk eklendikten 1 saat sonra eşleşen müşterilere "Aradığın kriterlere uygun yeni bir mülk geldi" push (opt-in tipi).
  - Müşteri kriterleri günceller → uygun mülkler değişti → emlakçıya "3 müşterin için yeni eşleşmeler hazır" özet push.
- **3.3.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.3.8 Öncelik:** **Orta** (Faz B — 3.1 sıcaklık skorunu weighting'de kullanır, 3.4 otomatik tetik için input)
- **3.3.9 Marketing parlatma:** *"Sistem öğrenir: '3+1 isteyenin %40'ı 4+1'e razı', 'bu lokasyonda alıcılar yatırımcıya dönüşüyor'. Her gün taze 5 eşleşme — saatlerce manuel filtre yerine 1 tıklama."*

---

### 3.4 Otomatik Müşteri Takibi & Eşleşme Tetiği

- **3.4.1 Ne yapacak:** Trigger + condition + action: "Müşteri 14 gün sessizse + sıcaklığı 50+ ise → otomatik WA + uygun mülk sunumu hazırla", "Fiyat %5 düştü → ilgilenen müşterilere haber", "Yeni mülk geldi → kriter eşleşen müşterilere sunum link".
- **3.4.2 Nasıl çalışır:**
  - Rule engine: event (sessizlik N gün / fiyat düşüşü / yeni mülk / sözleşme bitimi) → koşul (segment / sıcaklık / kriter eşleşme) → aksiyon (WA mesajı / otomatik sunum oluştur + link gönder / hatırlatma görevi).
  - Cron event tarayıcı + kural eşleştirme + idempotency (aynı müşteriye aynı kural 14 gün içinde tekrarlamaz).
- **3.4.3 Backend:**
  - Migration: `emlak_followup_triggers` (id, name, event_type, conditions JSONB, action_type, action_payload JSONB, active, last_run).
  - Migration: `emlak_followup_executions` (trigger_id, customer_id, property_id?, executed_at, status) — idempotency log.
  - Cron: `/api/cron/emlak-followup-triggers` (saatlik) — event tara, kural çalıştır, otomatik sunum mint (presentation oluştur + magic link).
  - Helper: `src/platform/emlak-followup/rule-engine.ts`
- **3.4.4 UI:**
  - `/tr/emlak-otomatik-takip` yeni sayfa — kural listesi + 3-step wizard (event → segment → action).
  - "Yeni kural" formu: event dropdown (sessizlik N gün / fiyat düşüşü / yeni mülk / sözleşme bitimi / sıcaklık değişim), segment seçici, aksiyon (WA mesajı template / otomatik sunum oluştur / hatırlatma takvime ekle).
  - Geçmiş çalıştırmalar tab — hangi kural hangi müşteriye ne zaman tetiklendi, dönüşüm metriği (kaç sunum açıldı, kaç görüşme oldu).
- **3.4.5 Agent:**
  - Tool `create_followup_campaign` (kural taslağı hazırlar, emlakçı onaylar).
  - Tool `list_active_followups` + `pause_followup`.
- **3.4.6 WA:**
  - Trigger çalıştığında müşteriye otomatik WA (template'ler `notification_preferences`'tan opt-out).
  - Emlakçıya haftalık özet "4 kural çalıştı, 18 müşteriye dokunuldu, 6 sunum açıldı, 2 görüşme oluştu".
- **3.4.7 Tahmini saat:** Tasarım 2 / Kod 7 / Test 3 = **12 saat** (otomatik sunum mint katmanı bayi kupon mint'inden biraz kompleks)
- **3.4.8 Öncelik:** **Orta** (Faz B — 3.1 skor + 3.2 risk + 3.3 eşleşme verisini condition'da kullanır)
- **3.4.9 Marketing parlatma:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın: 14 gün sessiz müşteriye otomatik mülk önerisi, fiyat düşen ilana ilgilenenlere haber, sözleşme bitenine yenileme — manuel takip saatleri %65 azalır."*

---

### 3.5 Emlakçı Mini-Vitrin + Lead Form

- **3.5.1 Ne yapacak:** Her emlakçıya `upudev.nl/v/<emlakci-slug>` sub-path mini vitrin — portföyü kart-grid (fiyat, lokasyon, fotoğraf), filtre (oda, fiyat, bölge), "İlgileniyorum" lead form. Lead → emlakçıya anlık WA push, otomatik müşteri kaydına dönüşüm.
- **3.5.2 Nasıl çalışır:**
  - Her emlakçıya unique `vitrine_slug` (örn `upudev.nl/v/ahmet-emlak`).
  - Public sayfa: portföy listesi (kart-grid + harita view opsiyonel), filtreler, mülk detay sayfası, "İlgileniyorum" form.
  - Form submit → `emlak_leads` insert → emlakçıya WA push, admin'e bildirim → emlakçı "Onayla" derse otomatik `emlak_customers` insert + kaynak `vitrine`.
  - SEO meta + OG tag (paylaşımda mülk fotoğrafı + fiyat + lokasyon görünür).
- **3.5.3 Backend:**
  - Migration: `emlak_vitrines` (agent_id, slug UNIQUE, theme JSONB, is_active, custom_logo_url, custom_color, hero_text, contact_phone, contact_whatsapp).
  - Migration: `emlak_leads` (id, agent_id, customer_name, customer_phone, customer_email, property_id, message, status='new'|'contacted'|'converted'|'dismissed', source, converted_customer_id, created_at).
  - Public route `/v/[slug]` (locale-aware) — auth yok, RLS allow anonymous read properties + insert lead.
  - Public route `/v/[slug]/mulk/[propertySlug]` — mülk detay sayfası.
  - Helper: `src/platform/emlak-vitrine/render.ts` + `src/platform/emlak-vitrine/notify.ts` (lead-to-agent push).
  - Mevcut `/tr/web-sayfam` editör bu data modeline migrate edilir.
- **3.5.4 UI:**
  - `/tr/web-sayfam` (emlakçı-side) — vitrine editor: logo, renk, hero metni, hangi mülkler görünür, "Önizle" buton, OG paylaşım önizlemesi.
  - `/tr/lead-liste` (emlakçı-side) — lead listesi, onay/red, dönüşüm metriği, "Müşteriye Çevir" buton. (Mevcut `/tr/lead-liste` route'u bu modüle bağlanır.)
  - `/v/[slug]` public ürün katalogu (mobile-first, no-auth, hızlı yükleme + lazy image).
  - `/v/[slug]/mulk/[propertySlug]` mülk detay + "İlgileniyorum" form.
  - `(admin)` panel emlakçı detayda "Vitrin durumu" özet (lead sayısı, dönüşüm oranı, top mülkler).
- **3.5.5 Agent:**
  - Tool `get_agent_leads` (agent_id) — lead-to-customer dönüşüm raporu.
  - Tool `suggest_vitrine_improvements` (agent_id) — düşük dönüşümlü vitrinlere öneri (hero metni, fotoğraf kalitesi, fiyat aralığı).
  - Tool `route_lead_to_agent` (lead_id) — multi-agent ofiste lead'i en uygun emlakçıya ata.
- **3.5.6 WA:**
  - Yeni lead → emlakçıya anlık WA push ("🆕 Lead: Ahmet, Bağcılar 3+1, 5M TL bütçe — Onayla / Yanıtla").
  - Lead 24 saatte yanıtsız → emlakçıya + admin'e hatırlatma.
  - Onaylanan lead'in mülke ilgi tepkisi → otomatik sunum oluştur (3.4 trigger ile bağlı).
- **3.5.7 Tahmini saat:** Tasarım 3 / Kod 10 / Test 5 = **18 saat** (yeni public route + mülk detay sayfası + SEO + mevcut `web-sayfam` migrate)
- **3.5.8 Öncelik:** **Düşük** (Faz C — yeni public yüzey, en uzun kapsamlı modül)
- **3.5.9 Marketing parlatma:** *"Her emlakçının kendi mini vitrini var — `upudev.nl/v/ahmet-emlak`. Müşteri Google'dan bulsun, mülke baksın, 'İlgileniyorum' bassın — anlık WA bildirim sana gelsin. Lead %30 daha fazla dönüşür."*

---

### 3.6 Emlakçı Drip + Müşteri Sıcaklığa Göre Segment Dripleri

- **3.6.1 Ne yapacak:** 5-7 mesajlık otomatik drip dizileri:
  - **Yeni müşteri onboarding** (5 mesaj: hoş geldin → kriterleri netleştir → eşleşen ilk mülkler → sunum önizleme → görüşme talep)
  - **Soğuyan müşteri recovery** (3 mesaj: "Hala arıyor musun?" → "Fiyat aralığı esnedi mi?" → "Yeni mülkler geldi")
  - **Mülk sahibi yıllık değer raporu** (1 mesaj: "Mülkünüzün güncel değer tahmini" — yıllık)
  - **Sunum açıldı ama görüşme olmadı** (2 mesaj: "Beğendin mi?" → "Benzer 3 mülk daha")
- **3.6.2 Nasıl çalışır:**
  - Drip = `emlak_drip_campaigns` + `emlak_drip_steps`.
  - Müşteri belirli "audience" girer (yeni müşteri / soğuyan / mülk sahibi / sunum açtı) → drip otomatik tetiklenir.
  - Cron her gün step delay'i kontrol eder, mesajları gönderir, log tutar.
  - Audience seçimi 3.1 sıcaklık + 3.2 soğuma + 3.3 eşleşme verisini kullanır.
- **3.6.3 Backend:**
  - Migration: `emlak_drip_campaigns` (id, name, audience JSONB, channel, active).
  - Migration: `emlak_drip_steps` (campaign_id, step_order, delay_days, channel, template, send_condition).
  - Migration: `emlak_drip_enrollments` (campaign_id, customer_id, enrolled_at, current_step, status).
  - Migration: `emlak_drip_sends` (enrollment_id, step_id, sent_at, status, error).
  - Cron: `/api/cron/emlak-drip` (saatlik) — pending step'leri gönder.
  - Helper: `src/platform/emlak-marketing/audience.ts` (sıcaklık + soğuma segmenti) — engine paylaşılır (bkz Yatay Yapı).
- **3.6.4 UI:**
  - `/tr/emlak-marketing` yeni sayfa — drip listesi.
  - Drip editor (5-step wizard): audience seç, kanal (WA/e-posta), step ekle (delay + template), önizle.
  - Segment builder: sıcaklık aralığı, son dokunma, kriter, müşteri rolü (alıcı/kiralık/mülk sahibi).
  - Broadcast formu: tek seferlik mesaj segment'e gönder.
- **3.6.5 Agent:**
  - Tool `create_drip_campaign` — agent kullanıcıyla konuşarak drip taslağı hazırlar.
  - Tool `get_drip_performance` — açılma/yanıt/dönüşüm raporu.
  - Tool `suggest_audience_for_template` — verilen template'e uygun müşteri seç.
- **3.6.6 WA:**
  - Tüm drip mesajları WA Cloud API üzerinden (24h gate `shouldNotify` helper'da).
  - WA başarısızsa e-posta fallback (henüz e-posta entegre değilse WA-only başlat).
- **3.6.7 Tahmini saat:** Tasarım 3 / Kod 8 / Test 4 = **15 saat** (engine paylaşıldığı için bayi'den 1h tasarruf)
- **3.6.8 Öncelik:** **Düşük** (Faz C — 3.4 trigger sistemiyle örtüşür; trigger = anlık tek mesaj, drip = zamana yayılmış dizi)
- **3.6.9 Marketing parlatma:** *"Yeni müşteri onboarding'i, soğuyan müşteri recovery, mülk sahibine yıllık değer raporu — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu insanları sıcak tutar."*

---

### 3.7 Emlakçı Tavsiye Programı

- **3.7.1 Ne yapacak:** İki tip referans:
  1. **Emlakçı → Emlakçı davet:** SaaS aboneliğine yeni emlakçı katılırsa davet edene komisyon paylaşımı %10 ilk 6 ay (UPU komisyonundan).
  2. **Müşteri → Müşteri tavsiye:** Mevcut müşterinin önerdiği yeni müşteri ile sözleşme kapanırsa, emlakçıya komisyon bonusu + tavsiye eden müşteriye hediye (örn 1 yıllık ev temizlik hizmeti veya ekspertiz raporu).
- **3.7.2 Nasıl çalışır:**
  - Emlakçı panel "Davet et" sayfası — unique link + WA share button.
  - Davet kabul → `emlak_referrals.status='enrolled'`; ilk sözleşme kapanışı → `status='earned'` + kredi tahakkuk.
  - Müşteri tavsiye: emlakçı panelinde "Müşteri tavsiye kodu" üretir, müşteriye gönderir, müşteri başkasına paylaşır, kod ile gelen kişi sözleşme kapatırsa bonus.
- **3.7.3 Backend:**
  - Migration: `emlak_referral_codes` (code, agent_id, customer_id NULL (müşteri için), created_at, expires_at, max_uses, current_uses, type='agent_invite'|'customer_referral').
  - Migration: `emlak_referrals` (referrer_id, referred_id, referrer_type, code_id, status, reward_amount, reward_type='subscription_credit'|'commission_bonus'|'gift', reward_currency, earned_at, applied_at).
  - Migration: `emlak_agent_credits` (agent_id, balance, last_movement_at) + `emlak_credit_movements` (delta, source, reference_id).
  - Helper: `src/platform/emlak-referral/engine.ts` (engine paylaşılır — bkz Yatay Yapı).
  - Trigger: yeni `emlak_contracts` insert (status='signed') → referrer credit kontrolü.
- **3.7.4 UI:**
  - `/tr/emlak-davet-et` (emlakçı-side) — unique kod, paylaş butonu, kazanım grafiği, müşteri tavsiye kodu üret sekmesi.
  - `uyelik` ekstresinde "Kredi bakiyesi" satırı.
  - Üyelik fatura ekranında "Krediyi kullan" checkbox.
  - Admin görünüm `/tr/emlak-referans-yonet` — toplam referans, top referrer'lar, ödenen reward.
- **3.7.5 Agent:**
  - Tool `get_referral_status` (agent_id).
  - Tool `top_referrers` — admin için.
- **3.7.6 WA:**
  - Davet edilen emlakçı kayıt olunca referrer'a "Davetin kabul oldu, ilk sözleşmesiyle ₺X kazanacaksın" push.
  - İlk sözleşme tetiklendiğinde "Kredin tahakkuk etti" push.
  - Müşteri tavsiyesinden sözleşme kapanınca emlakçıya bonus + tavsiye eden müşteriye hediye bilgilendirmesi.
- **3.7.7 Tahmini saat:** Tasarım 2 / Kod 6 / Test 3 = **11 saat**
- **3.7.8 Öncelik:** **Düşük** (Faz C — bağımsız modül, viral büyüme aracı)
- **3.7.9 Marketing parlatma:** *"Emlakçı arkadaşını davet et — ilk 6 ay komisyonun %10'u senin. Müşterin yeni müşteri getirsin — sana bonus, ona hediye. Viral büyüme: ilk 6 ayda emlakçı ağı +%25."*

---

### 3.8 Aktif Öneri Motoru (Yatay — Tüm SaaS'larda Aynı Pattern)

- **3.8.1 Ne yapacak:** Sayfa açar açmaz "Sana özel 3 öneri" — sistem son N gün veriyi tarayıp aksiyona dönüşebilen kısa tavsiyeler sunar. Emlak örnekleri:
  - *"Bu hafta 5 müşterinle 30+ gündür konuşmadın — toplu WA gönder"*
  - *"3 sıcak müşterin var ama sunum hazırlamadın — şimdi hazırla"*
  - *"2 sözleşmen 30 gün içinde bitiyor — mülk sahibiyle yenileme görüşmesi planla"*
  - *"Bağcılar bölgesinde 4 mülk var ama 90 gündür satılmadı — fiyat düşürme önerisi"*
  - *"İlan yenileme zamanı geldi: 7 portföy ilanı pasifleşti"*
  - *"AI mesajlarının %85'ini kullandın — Pro'ya geç"*
- **3.8.2 Nasıl çalışır:**
  - Rule registry — emlak için 5-7 öneri kuralı (event/query/threshold + suggestion template + action_type).
  - Saatlik cron tüm rule'ları evaluate eder; eşik aşıldığında `recommendation_runs` row açılır (idempotency: aynı user × rule × hedef 24h kapalı).
  - Dashboard widget en yüksek skorlu 3 öneri gösterir (skor = recency × impact × actionability).
  - Action button 1-tıkla aksiyona: WA broadcast taslağı / sunum oluştur deeplink / sözleşme yenileme akışı / fiyat düşürme modal / üyelik upgrade.
  - **Yatay yapı:** engine tenant-agnostic (`src/platform/recommendations/engine.ts` — bayi'de yazılmış), emlak adapter'ı (`src/tenants/emlak/recommendations.ts`) sadece kural registry'sini sağlar.
- **3.8.3 Backend:**
  - Engine + tablo (`recommendation_rules`, `recommendation_runs`) Faz B (bayi) tarafında oluşturulmuştur — emlak ekstra migration gerektirmez, sadece `tenant_key='emlak'` kayıtları seed eder.
  - Tenant adapter: `src/tenants/emlak/recommendations.ts` — emlak kuralları:
    1. `cooling_customers_batch` — son 30 gün konuşulmamış müşteri ≥ 5
    2. `hot_customers_no_presentation` — sıcaklık ≥ 80 ama son 7 gün sunum yok ≥ 3
    3. `contracts_expiring_soon` — 30 gün içinde biten sözleşme ≥ 1
    4. `stale_listings_price_drop` — 90+ gün pasif portföy ≥ 3
    5. `listing_renewal_due` — ilan yenileme tarihi geçen ≥ 1
    6. `quota_near_limit` — AI quota %85 üstü
    7. `new_match_batch` — son 24h içinde yeni eşleşmeler hazır ≥ 5
  - Cron: `/api/cron/recommendations` (saatlik, bayi'de mevcut) — emlak adapter'ı otomatik dispatch eder.
- **3.8.4 UI:**
  - `src/components/recommendations/RecommendationCard.tsx` — paylaşılan (bayi'de yazılmış), emlak tenant-aware mount.
  - Emlak `panel` (`/tr/panel`) dashboard üstüne mount — "Sana özel 3 öneri" başlık + 3 kart.
  - `/tr/oneri` mevcut route — full liste sayfasına genişlet (geçmiş + dismissed dahil, filter, severity badge). Mevcut basit "ipucu" yapısı bu modüle migrate.
  - Action handler modal'ları paylaşılan (WA broadcast taslağı, sunum oluştur deeplink, sözleşme yenileme, fiyat düşürme, üyelik deeplink).
- **3.8.5 Agent:**
  - Tool `get_recommendations` (limit=5) — paylaşılan helper, tenant_key='emlak' filter.
  - Tool `act_on_recommendation` (run_id, choice='accept'|'dismiss') — emlak action_type'ları için downstream tool eşleştirmesi.
  - Agent prompt'a context: "şu an N öneri açık".
- **3.8.6 WA:**
  - Severity='high' öneri 6 saatte action edilmezse emlakçıya WA hatırlatma.
  - Action sonucu downstream `sendNotification` helper çalıştırır.
- **3.8.7 Tahmini saat:** Adapter implement Tasarım 1 / Kod 3 / Test 1 = **5 saat** (engine + UI bayi'de yazılmış, emlak yalnız adapter + rule seed + dashboard mount)
- **3.8.8 Öncelik:** **Orta** (Faz B — 3.1 skor + 3.2 risk + 3.3 eşleşme + portföy verilerini tüketir). **Yatay yapı:** engine + UI bayi worker'ında yazıldıktan sonra emlak yalnız adapter ekler.
- **3.8.9 Marketing parlatma:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi müşteriyi araman gerek, hangi sunumu hazırlaman gerek, hangi sözleşmeyi yenilemen gerek söyler. Tıkla, yapsın. Beyin gibi düşünür, asistan gibi çalışır."*

---

## Yatay Yapı (Tüm Tenant'larda Aynı Engine)

Bayi worker'ında yazılan aşağıdaki helper'lar **tenant-agnostic** olup emlak adapter'ı ile yeniden kullanılır. Bu sayede emlak master plan'da gözüken saat tahminleri "yalnızca adapter implementi" baz alınmıştır — ortak engine tekrar yazılmaz.

| Paylaşılan Engine | Bayi'de Konum | Emlak Adapter | Adapter Saati |
|---|---|---|---|
| **Öneri motoru** (3.8) | `src/platform/recommendations/engine.ts` | `src/tenants/emlak/recommendations.ts` — 7 kural registry | ~2h |
| **Vitrin notify pattern** (3.5) | `src/platform/bayi-vitrine/notify.ts` (bayi-spesifik) | `src/platform/emlak-vitrine/notify.ts` veya unified `src/platform/vitrine/` extract — emlak için yeni public route + SEO + mülk detay sayfası nedeniyle bayi'den daha fazla iş; pattern + helper paylaşılır, route'lar tenant-spesifik | ~2h (pattern reuse, geri kalanı 3.5'in 18h içinde) |
| **Drip engine** (3.6) | `src/platform/bayi-marketing/drip-engine.ts` | `src/platform/emlak-marketing/audience.ts` — segment kuralları (sıcaklık + soğuma) emlak-spesifik, engine + step runner paylaşılır | ~2h (engine reuse, geri kalanı 3.6'nın 15h içinde) |
| **Referans ledger** (3.7) | `src/platform/bayi-referral/engine.ts` | `src/platform/emlak-referral/engine.ts` — kod generate + claim + award + ledger pattern aynı; reward kuralları (komisyon paylaşımı + müşteri tavsiye hediye) emlak config | ~2h (engine reuse, geri kalanı 3.7'nin 11h içinde) |
| **Notification helper** | `src/platform/notifications/send-notification.ts` | Doğrudan kullanılır (tenant-agnostic, KVKK + DND + 24h gate hepsi içeride) | 0h — değişiklik yok |

**Toplam paylaşılan kazanç:** Emlak ~8 saat tasarruf (her engine adapter ortalama 2h, eğer scratch yazılsa katmanın saatine eklenmesi gerekirdi).

**Sıralama notu:** Bayi worker Faz B'de 3.8 engine + 3.6 drip + 3.7 referral engine'ini yazar. Emlak worker bu engine'ler tamamlandıktan sonra adapter ekler — bayi PR'ı merge bekleyebilir. Eğer paralel ilerlerse, emlak worker scratch yazıp sonra bayi'nin merge'iyle convergence yapar (1-2h ekstra refactor).

---

## 4. Faz Sırası

### Faz A — Hızlı Kazanç (1-2 hafta, **Kritik**)

**Kapsam:** 3.1 Müşteri Sıcaklık Skoru + 3.2 Soğuma & Mülk Sahibi Kaybı Erken Uyarı

**Gerekçe:**
- İkisi aynı veri katmanını (müşteri etkileşim + sözleşme + sunum açılma) tüketir — paralel implement edilebilir.
- Anlık değer: ilk gün emlakçı paneli açtığında "5 müşterin soğuyor, 2 sözleşmen 30 gün içinde bitiyor" banner'ı → SaaS değerinin somut kanıtı.
- Diğer katmanlar (3.3 eşleşme, 3.4 otomatik takip) sıcaklık + risk verisini condition'da kullanır — Faz A altyapı.
- Migration risk düşük (yeni tablo + 2 view, yıkıcı değişiklik yok).

**Tahmini:** 16 saat

### Faz B — Orta (3-4 hafta)

**Kapsam:** 3.3 Akıllı Eşleşme + 3.4 Otomatik Takip & Eşleşme Tetiği + **3.8 Aktif Öneri Motoru (adapter)**

**Gerekçe:**
- Faz A'nın sıcaklık + risk verisini segment/condition olarak kullanır.
- Eşleşme motoru emlak'ın asıl satış lokomotifi — "her gün 5 yeni eşleşme" deneyimi günlük kullanım habit'i yaratır.
- Otomatik takip + sunum mint kombinasyonu manuel iş azaltma kazancı, marketing pitch'inde "65% manuel azaltma" iddiası buradan.
- **3.8 Aktif Öneri Motoru** Faz A+B'nin tüm output'larını tek widget'a toplar — "panel açar açmaz aksiyon" deneyimi. Engine + UI bayi'de yazıldığı için emlak yalnız 5h adapter.

**Tahmini:** 28 saat (11 + 12 + 5)

### Faz C — Uzun Vadeli (5-8 hafta)

**Kapsam:** 3.5 Mini-Vitrin + Lead + 3.6 Drip Marketing + 3.7 Tavsiye Programı

**Gerekçe:**
- 3.5 Mini-Vitrin: yeni public route + mülk detay + SEO + lead routing, emlak'ın en uzun kapsamlı modülü; mevcut `web-sayfam` + `lead-liste` skeletlerini gerçek modüle dönüştürür.
- 3.6 Drip: 3.4 trigger sistemini zamana yayılmış dizilere taşır; engine paylaşıldığı için kısaltıldı.
- 3.7 Referans: bağımsız viral büyüme aracı, billing entegrasyonu ile bağlı; engine paylaşıldığı için kısaltıldı.
- Faz C bittiğinde "satış lokomotifi" söylemi tam savunulabilir, emlakçı abonelik kararını "vitrin + drip + tavsiye" katmanları üzerinden verir.

**Tahmini:** 44 saat (18 + 15 + 11)

---

## 5. Toplam Saat Tahmini

| Katman | Tasarım | Kod | Test | Toplam |
|--------|---------|-----|------|--------|
| 3.1 Müşteri Sıcaklık Skoru | 1 | 5 | 2 | **8** |
| 3.2 Soğuma + Sözleşme Bitimi Uyarı | 1 | 5 | 2 | **8** |
| 3.3 Akıllı Mülk-Müşteri Eşleşme | 2 | 6 | 3 | **11** |
| 3.4 Otomatik Takip & Eşleşme Tetiği | 2 | 7 | 3 | **12** |
| 3.5 Mini-Vitrin + Lead Form | 3 | 10 | 5 | **18** |
| 3.6 Drip + Segment Marketing | 3 | 8 | 4 | **15** |
| 3.7 Tavsiye Programı | 2 | 6 | 3 | **11** |
| 3.8 Aktif Öneri Motoru (yatay adapter) | 1 | 3 | 1 | **5** |
| **TOPLAM** | **15** | **50** | **23** | **88 saat** |

**Faz bazında:** Faz A 16h · Faz B 28h · Faz C 44h
**Kalibrasyon notu:** Bayi master plan 94h (3.8 engine scratch). Emlak 88h, çünkü 3.8 engine + 3.6 drip engine + 3.7 referral engine bayi worker'da yazıldıktan sonra adapter olarak gelir (~8h tasarruf). Faz 6+7 (KVKK + WA OTP + branded QR + 2-buton login + Gizlilik paneli) ~12 saat sürdü; bu plan ~88 saat = realistik olarak 3-4 hafta yoğun tempoda, 2 ay rahat tempoda.

---

## 6. Bağımlılıklar ve Riskler

### Üçüncü taraf entegrasyon
- **Mollie:** mevcut — 3.7 referans programında kupon code akışı eklenecek (`paymentMethods.iDEAL` + discount stack).
- **WA Cloud API:** mevcut — 3.4/3.6 broadcast'lerde **24-saat customer service window** gate zorunlu. Drip ve trigger mesajları freeform (24h içinde); template message gerekirse Meta onay 3-5 gün.
- **E-posta SES/Postmark:** 3.6'da fallback için yok — başlangıçta WA-only drip; e-posta kanalı sonradan eklenebilir.
- **Harita / lokasyon servisi (3.5 mülk detay opsiyonel):** OpenStreetMap embed yeterli (Google Maps API ücretli).

### Veri kalitesi gereksinimleri
- **3.1 + 3.2** için en az **30 gün** müşteri etkileşim + 1 ay sözleşme verisi gerekir. Yeni emlakçıda scoring "Yeterli veri yok" placeholder.
- **3.3 Eşleşme** için en az **10 sözleşme + 30 müşteri** tarihçesi co-occurrence öğrenmesi için gerekli; altında "kural tabanlı eşleşme" fallback (mevcut basit match).

### DB migration kuralları (CLAUDE.md)
- 14-digit timestamp prefix, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- DROP/destructive ALTER → ASK first.
- Worker SQL dosyasını yazar + `supabase db push` ile apply eder + commit + push.

### Bayi worker bağımlılığı (yatay yapı)
- 3.8 öneri engine, 3.6 drip engine, 3.7 referral engine bayi tarafında **önce** yazılmalı. Bayi Faz B/C tamamlandıktan sonra emlak adapter PR'ı temiz olur.
- Eğer emlak paralel çalışırsa, scratch yazıp bayi merge sonrası convergence refactor (+1-2h).

### Backward compat
- Emlak WA komut router **aktif** (bayi'den farklı olarak emlakçı WA komutlarını yoğun kullanıyor) — broadcast UI komut router'ı bozmamalı.
- `notifications` tablosu mevcut — 3.4/3.6 mesaj `sendNotification` helper'a düşer.
- Mevcut `eslestir` komutu 3.3 motoruna refactor edilir, eski basit match yedek path olarak korunur.
- Mevcut `/tr/web-sayfam` + `/tr/lead-liste` 3.5 modülüne migrate edilir, eski data formatı varsa migration script ile dönüştürülür.

### Risk haritası
| Risk | Olasılık | Etki | Karşı önlem |
|------|----------|------|-------------|
| Sıcaklık formülü subjektif → güvensizlik | Orta | Yüksek | Açık formül + tooltip breakdown + emlakçı override |
| WA 24h window ihlali → Meta hesap askısı | Düşük | Çok yüksek | `shouldNotify` gate'inde `last_inbound_at` kontrolü zorunlu |
| Drip spam → müşteri opt-out fırtınası | Orta | Orta | step başına opt-out link + frequency cap (haftalık max 2 mesaj) + KVKK consent kontrolü |
| Vitrin slug çakışması | Düşük | Düşük | UNIQUE + auto-suffix (-2, -3) |
| Eşleşme motoru "saçma" öneri (cold-start) | Yüksek | Orta | İlk 30 gün rule-based fallback; co-occurrence asgari N=10 sözleşme sonrası aktif |
| Lead form spam (vitrine public) | Orta | Orta | reCAPTCHA v3 + IP rate limit + telefon doğrulama opsiyonel |
| Referans kupon stack abuse | Orta | Orta | Max 1 kredi/sözleşme + monthly cap + audit log |
| KVKK lead form veri toplama | Düşük | Yüksek | Lead form altında aydınlatma metni linki + checkbox onay (Faz 7'de yazılan modal'dan reuse) |

---

## 7. Kabul Kriterleri (Acceptance)

### Faz A bitince
- [ ] Emlakçı `/tr/musterilerim` → liste'de "🔥/🌤/❄️ Sıcaklık" kolonu, sort + filter çalışıyor
- [ ] Emlakçı `/tr/musterilerim/[id]` → "Sıcaklık" tabı 5 alt-skor + 8-hafta trend grafiği
- [ ] Emlakçı `/tr/panel` → "5 müşteri soğuyor, 2 sözleşme bitiyor" banner görünüyor
- [ ] `/tr/musteri-risk` sayfa açılıyor, recovery aksiyon CTA çalışıyor (WA + sunum hatırlatma)
- [ ] `/tr/sozlesmelerim` → "⏳ 30 gün içinde bitiyor" filter chip ve uyarı banner
- [ ] Cron `emlak-heat-scoring` günlük, `emlak-churn` günlük schedule'a alındı, manuel test başarılı
- [ ] Agent `get_customer_heat_score` + `get_cooling_customers` + `get_expiring_contracts` tool'ları çalışıyor
- [ ] WA: 60 gün sessiz müşteri tetiği ve sözleşme bitime 30 gün tetiği emlakçıya ulaştı (test müşteri ile)
- [ ] Sabah brifing "🔥 Bugün arayacağın 3 sıcak müşteri" formatına geçti

### Faz B bitince
- [ ] `musterilerim/[id]` detayında "Eşleşen Mülkler" rail 5 mülk + "Sunum Hazırla" buton çalışıyor
- [ ] `mulklerim/[id]` detayında "İlgilenebilir Müşteriler" rail 5 müşteri + "WA Gönder" buton
- [ ] `mulk-ekle` sonrası "Bu mülke uygun N müşterin var" success state
- [ ] `/tr/emlak-otomatik-takip` sayfa açıyor, "Yeni Kural" wizard tamam (event → segment → action)
- [ ] Trigger çalıştığında: müşteriye WA mesajı + opsiyonel otomatik sunum oluştur, geçmiş tab'da log var, idempotency 14 gün
- [ ] Cron `emlak-matching` günlük, `emlak-followup-triggers` saatlik
- [ ] Agent `suggest_property_match` + `suggest_customer_match` + `create_followup_campaign` tool'ları çalışıyor
- [ ] `panel` üstüne "Sana özel 3 öneri" widget — 3 öneri görünür (sıcaklık/soğuma/sözleşme/eşleşme karışımı)
- [ ] Öneri kartında 1-tıkla aksiyon: WA broadcast modal / sunum oluştur deeplink / sözleşme yenileme akışı / fiyat düşürme modal / üyelik deeplink
- [ ] `/tr/oneri` full liste sayfası (filter: open/acted/dismissed)
- [ ] Cron `recommendations` saatlik (paylaşılan), emlak adapter aktif, idempotency 24h aynı user×rule×hedef
- [ ] Severity='high' öneri 6 saatte acted değilse emlakçı WA hatırlatma alındı

### Faz C bitince
- [ ] `/v/<emlakci-slug>` public sayfası açıyor (auth-free), portföy listesi + filtre + mülk detay sayfası, lead form submit edilebiliyor
- [ ] SEO meta + OG tag mülk detayında doğru (paylaşımda fotoğraf + fiyat + lokasyon)
- [ ] Emlakçı `/tr/lead-liste` lead listesi + onay/red akışı tam + "Müşteriye Çevir" buton
- [ ] Yeni lead → emlakçıya anlık WA push (test lead ile)
- [ ] `/tr/web-sayfam` editör (logo + renk + hero + mülk seçimi) çalışıyor + önizleme
- [ ] `/tr/emlak-marketing` drip editor 5-step wizard tamam
- [ ] 4 hazır drip (yeni müşteri / soğuyan recovery / mülk sahibi yıllık / sunum açıldı) seed edildi
- [ ] Emlakçı `/tr/emlak-davet-et` unique kod görüyor (emlakçı + müşteri tavsiye iki sekme), paylaş çalışıyor
- [ ] Davet kabul + ilk sözleşme → kredi tahakkuk
- [ ] `uyelik` ekstresinde kredi bakiyesi satırı
- [ ] Üyelik fatura ekranında "Krediyi kullan" checkbox aktif
- [ ] KVKK lead form: aydınlatma metni linki + onay checkbox zorunlu

---

## 8. Pazarlama Mesajları (Sales-Ready Liste)

Her katman için landing page, demo, satış sunumunda kullanılabilir 1-2 cümlelik vurgu:

- **3.1 Müşteri Sıcaklık Skoru:** *"Her müşterinin gerçek sıcaklığını 0-100 skorla anında görür, kimi şimdi araman gerek bilirsin — sıcaklık paneli kapanan sözleşmeyi 2 ayda %20 artırır."*
- **3.2 Soğuma + Mülk Sahibi Kaybı:** *"Müşterini kaybetmeden 30 gün önce, mülk sahibini kaybetmeden 30 gün önce sistem haber verir — müşteri kaybı %40, mülk sahibi kaybı %35 düşer."*
- **3.3 Akıllı Eşleşme:** *"Sistem öğrenir: '3+1 isteyenin %40'ı 4+1'e razı', 'bu lokasyonda alıcı yatırımcıya dönüşüyor'. Her gün taze 5 eşleşme — saatlerce manuel filtre yerine 1 tıklama."*
- **3.4 Otomatik Takip:** *"Bir kez kural yaz, sistem yıl boyu çalıştırsın: 14 gün sessiz müşteriye otomatik mülk önerisi, fiyat düşen ilana ilgilenenlere haber, sözleşme bitenine yenileme. Manuel takip saatleri %65 azalır."*
- **3.5 Mini-Vitrin + Lead:** *"Her emlakçının kendi mini vitrini var — `upudev.nl/v/ahmet-emlak`. Müşteri Google'dan bulsun, mülke baksın, 'İlgileniyorum' bassın — anlık WA bildirim sana gelsin. Lead %30 daha fazla dönüşür."*
- **3.6 Drip Marketing:** *"Yeni müşteri onboarding, soğuyan recovery, mülk sahibi yıllık değer raporu — hepsi otomatik 5-mesajlık dizilerle. Bir kez kur, sistem yıl boyu müşterilerini sıcak tutar."*
- **3.7 Tavsiye Programı:** *"Emlakçı arkadaşını davet et — ilk 6 ay komisyonun %10'u senin. Müşterin yeni müşteri getirsin — sana bonus, ona hediye. Viral büyüme: ilk 6 ayda emlakçı ağı +%25."*
- **3.8 Aktif Öneri Motoru:** *"Panel'i açar açmaz 'Sana özel 3 öneri' görürsün — sistem hangi müşteriyi araman gerek, hangi sunumu hazırlaman gerek, hangi sözleşmeyi yenilemen gerek söyler. Tıkla, yapsın. Beyin gibi düşünür, asistan gibi çalışır."*

**Üst başlık vurgu (landing hero):**
*"UPU Emlak — portföy + müşteri + sunum + sözleşme yetmez. Soğuyan müşteriyi yakalar, mülk sahibini kaybetmez, akıllı eşleşme ile az dokunarak çok satar. Bir abonelik, 7 satış lokomotifi."*

---

## 9. Sıradaki Adım

Bu master plan Çağrı tarafından onaylandıktan sonra:

1. **Faz A başlatma:**
   - Worker: emlak (tmux upu-emlak)
   - İlk commit: `feat(db): emlak_customer_heat_scores + emlak_customer_cooling_signals + emlak_contract_expiry_signals view migration`
   - İkinci commit: `feat(emlak-scoring): cron + helper (calculate.ts)`
   - Üçüncü commit: `feat(emlak): /tr/musteri-risk + heat badge + musterilerim liste sort + sozlesmelerim biten filter`
   - 4. commit: `feat(agent/emlak): get_customer_heat_score + get_cooling_customers + get_expiring_contracts tools`
   - 5. commit: `feat(emlak): sabah brifing 'bugün arayacağın 3 sıcak müşteri' formatı`

2. **Sprint task'larına böl:** Faz A her katman için 4-5 task (DB migration → API → UI → cron → agent tool → WA template → kabul testi).

3. **Bayi worker ile koordinasyon:** 3.8 öneri engine + 3.6 drip engine + 3.7 referral engine bayi Faz B/C'de yazılır. Emlak Faz A başlarken bayi Faz A/B paralel; emlak Faz B 3.8 adapter için bayi 3.8 engine merge bekler. Emlak Faz C 3.6/3.7 için bayi 3.6/3.7 engine merge bekler. Eğer paralel ilerlerse convergence refactor +1-2h.

4. **Versiyonlama:** Her sprint sonunda bu doküman `Versiyon 1.1`, `1.2` şeklinde güncellenir. "Tamamlandı / Devam / Plan" durumları her katman üstüne işaretlenir.

---

*Bu doküman emlak worker (`tmux upu-emlak`) tarafından 2026-05-22 tarihinde üretildi. Bayi master plan v1.1 şablonundan adapte edildi. Onay sonrası Faz A başlatılır.*
