# Bayi Parity Audit — 2026-05-14

Bayi tenant'ın son 6-7 günde emlak'a eklenen Faz 6.x / 7.x / 9.x feature'lara karşı parity durumu.
Pure audit — hiçbir kod değişmedi. Sadece kanıt + boşluk + sprint önerisi.

Karşılaştırılan emlak feature'ları:
- Faz 5.x — Banking BBVA depth (Üyelik, Bildirimler, Eklenti, Destek, hero slider)
- Faz 6.x — Cookie session `.upudev.nl` + Google OAuth + tenant-aware /tr/giris
- Faz 7.0 — KVKK aydınlatma + consent modal + Gizlilik
- Faz 7.1a — Cookie banner + ToS + İade/iptal
- Faz 7.1b/c — Verilerim → panel-ayarlari + Mollie billing_address sync
- Faz 9.x — /tr/uye-ol i18n + branded QR

---

## Özet

| # | Kategori | Durum |
|---|----------|-------|
| 1 | Cookie session + Google OAuth | ⚠️ KISMI |
| 2 | Banking BBVA design depth | ❌ YOK |
| 3 | KVKK consent modal + endpoint | ❌ YOK (bayi'de mount edilmiyor) |
| 4 | ToS + İade/iptal sayfası | ⚠️ KISMI (var ama "UPU Emlak" hardcoded, sidebar linki yok) |
| 5 | Cookie banner | ✅ VAR (tenant-agnostic, bayi'ye de gözüküyor) |
| 6 | Verilerim panel-ayarlari | ❌ YOK |
| 7 | Mollie webhook billing_address | ⚠️ KISMI (tenant filter yok) |
| 8 | i18n public landing /tr/uye-ol | ⚠️ KISMI (var ama "UPU Emlak" hardcoded) |

**Dağılım:** 1 ✅ VAR · 4 ⚠️ KISMI · 3 ❌ YOK

**En kritik 3 boşluk:**

1. **Bayi `panel-ayarlari` sayfası tamamen yok.** Emlak'taki 12+ bölümlü ayarlar sayfası (profil, KVKK, gizlilik, data export, delete request, abonelik) bayi tarafında karşılığı olmadığı için bayi user yasal hakları olan veri indir/silme + abonelik yönetimi + KVKK onayı'na erişemiyor. (Madde 3, 6)
2. **KVKK modal bayi panelinde mount edilmiyor.** `KvkkConsentModal` yalnızca `src/app/[locale]/(panel)/panel/page.tsx:442`'de render ediliyor — bayi user `/tr/bayi-panel`'e girince modal asla pop-up olmuyor, `kvkk_consent_version` zorunlu hâle gelmiyor. KVKK uyum riski. (Madde 3)
3. **Bayi-specific giriş sayfası ve public landing yok.** `/tr/giris` ve `/tr/uye-ol` "UPU Emlak" hardcoded — `retailai.upudev.nl/tr/uye-ol`'a giren kullanıcıya emlak markası gözüküyor. Bayi public signup organik akışı tanımsız (sadece WA invite kodu). (Madde 1, 8)

**Tavsiye edilen sprint sırası:** Sprint A (Yasal/uyum) → Sprint B (UX parity) → Sprint C (Brand/i18n) — detay raporun sonunda.

---

## 1. Cookie session + Google OAuth (Faz 6.x)

**Durum:** ⚠️ KISMI

**Detay:**
- Cookie altyapısı **multi-tenant ready**: `src/platform/auth/session.ts:21` (`COOKIE_NAME = "upu_session"`), `:63-66` (production'da `.upudev.nl` domain — tüm subdomain'lerle paylaşılır), `:102-107` (`getSessionFromCookies()` JWT verify, tenant ayrımsız).
- Bayi layout cookie kabul ediyor: `src/app/[locale]/(bayipanel)/layout.tsx:51-54` — önce `/api/bayi-panel/me` (cookie ile), 401 olursa token fallback. Yani teorik olarak bayi user emlak'ta giriş yapıp `retailai.upudev.nl/tr/bayi-panel`'e cookie ile geçebilir.
- Google OAuth endpoint'leri **tenant-agnostic**: `src/app/api/auth/google/start/route.ts:20-38` (link mode cookie kontrolü), `src/app/api/auth/google/callback/route.ts:126-170` (`tenantId` session'a kaydedilir, `attachSessionToResponse` ile).
- `src/middleware.ts:1-53` — yalnızca hostname → tenant header inject. Cookie okumaz; tenant fark etmeden geçer.

**Bayi-specific not:**
- **Bayi-spesifik giriş sayfası yok**. `/tr/giris` tek sayfa, `src/app/[locale]/giris/page.tsx:29`'da `"UPU Emlak"` başlığı hardcoded. `retailai.upudev.nl/tr/giris`'e giren bayi user'a "UPU Emlak" yazısı gözüküyor.
- `next` query parametresi Google start'a geçirilirse callback doğru subdomain'e döner, ama bayi user'a "Google ile giriş yap" CTA'sı sunan bir bayi landing/giriş ekranı yok.

**Boşluk:** Bayi user için (a) `giris/page.tsx`'i tenant-aware yap (middleware'den `x-tenant-key` header'ını okuyup brand title değiştir), (b) `/tr/bayi-panel`'e Google ile direkt giriş CTA'sı koy (bayi-specific landing veya tenant-aware giris).

---

## 2. Banking BBVA design depth (Faz 5.x)

**Durum:** ❌ YOK

**Detay:**
- Banking component katalog mevcut: `src/components/banking/index.ts:1-12` — `StatCard`, `ActionCircle`, `ListCard`, `HeroBanner`, `InfoChip`, `LoadingState`, `Skeleton`, `StepUpModal`, `KvkkConsentModal`, `BackButton`, `CookieBanner`.
- Emlak panelinde aktif kullanım: `src/app/[locale]/(panel)/panel/page.tsx:28-35` import bloğu (`HeroBanner, ActionCircle, StatCard, ListCard, InfoChip, Skeleton, KvkkConsentModal`). Emlak `(panel)/uyelik`, `bildirimler`, `eklenti`, `destek`, `sozlesmelerim`, `sunumlarim` sayfalarında banking primitives ile render.
- Bayi `(bayipanel)/bayi-panel/page.tsx:1-40` import bloğu **banking components import etmiyor**. KPI'lar inline gradient `<a>` elementlerinde, `StatCard` yerine elle yazılmış div'ler.
- Bayi sidebar accent: `src/tenants/bayi/components/sidebar.ts` indigo (`BAYI_ACCENT`), AdminLayout `ACCENT_CLASSES` map'inde tanımlı (`admin-layout.tsx:122`).

**Bayi-specific not:**
- AdminLayout multi-tenant ready (`accentColor`, `brandTitle`, `tenantKey` prop'larıyla); design language eksiği AdminLayout değil **page-level** — bayi sayfaları banking primitives'i ihmal ediyor.
- Banking depth Faz 5.x'in *karşılığı* sayfa olarak yok: bayi'de Üyelik / Bildirimler / Eklenti / Destek sayfaları sade placeholder'lar veya yok (`bayi-destek`, `bayi-oneri` placeholder dosyalar Dalga 2'de eklendi).

**Boşluk:** Bayi `(bayipanel)/bayi-panel`, `bayi-siparislerim`, `bayi-tahsilatlarim`, `bayi-raporlar`, `bayi-profilim` sayfalarını banking primitives (`StatCard`, `ListCard`, `HeroBanner`) ile refactor — emlak Faz 5.x pattern'ini takip. Bayi Üyelik/Bildirimler/Eklenti analoğu sayfaları (varsa) ek sprint.

---

## 3. KVKK consent modal + endpoint (Faz 7.0)

**Durum:** ❌ YOK (bayi'de mount edilmiyor)

**Detay:**
- Modal mevcut: `src/components/banking/KvkkConsentModal.tsx`. Prop'ları sadece `onAccepted` ve `onDefer` (tenant prop almıyor).
- Mount yalnızca **bir** yerde: `src/app/[locale]/(panel)/panel/page.tsx:442`. `[locale]/layout.tsx`'te app-wide mount **YOK** (sadece `CookieBanner` mount ediliyor, `layout.tsx:3,18`).
- Endpoint'ler tenant-agnostic ama doğru:
  - `src/app/api/profile/kvkk-status/route.ts:24-28` — `resolvePanelAuth()` userId döner, `profiles.kvkk_consent_version` global karşılaştırılır.
  - `src/app/api/profile/kvkk-accept/route.ts:25-30` — userId'ye `CURRENT_KVKK_VERSION = "v1"` yazar.
- Migration: `supabase/migrations/20260513160000_kvkk_consent_version.sql` — `profiles.kvkk_consent_version` kolonu tüm tenant'lar için.
- Modal metni hardcoded: `KvkkConsentModal.tsx:79` — `"UPU Emlak'ı kullanırken kişisel verilerinizin..."`. Bayi user görürse emlak yazısı.
- Aydınlatma metni sayfası: `src/app/[locale]/aydinlatma-metni/page.tsx:10,11,33,40` — "UPU Emlak / UPU Dev" Veri Sorumlusu olarak hardcoded.

**Bayi-specific not:**
- Bayi user `/tr/bayi-panel`'e girince **KVKK modal'ı asla pop-up olmuyor** — `kvkk_consent_version` boş kalsa bile zorlamayan akış. KVKK uyum riski.
- Bayi'nin Aydınlatma Metni'nde işlediği veri (dealer phone, order amount, IBAN vb.) emlak'ın işlediğinden (mülk adresi, müşteri telefon) farklı — tek metin tüm tenant'ları kapsamıyor.

**Boşluk:**
1. `KvkkConsentModal`'ı `(bayipanel)/bayi-panel/page.tsx`'e mount et (veya `[locale]/layout.tsx`'e app-wide al ama tenant-aware text).
2. Modal'a `tenantKey?` prop ekle, içerik switch case ile değişsin (en az "UPU Emlak" yerine "UPU Bayi").
3. `aydinlatma-metni/page.tsx`'i tenant-aware yap — bayi için ayrı veri sorumlusu metni veya `/tr/bayi-aydinlatma-metni` ayrı sayfa.

---

## 4. ToS + İade/iptal sayfası (Faz 7.1a)

**Durum:** ⚠️ KISMI

**Detay:**
- Sayfalar var: `src/app/[locale]/hizmet-sartlari/page.tsx:34` ("UPU Dev (UPU Emlak)" hardcoded), 10 bölüm. `src/app/[locale]/iade-iptal/page.tsx:34` (aynı branding, 5 bölüm, 14 gün cayma + Mollie reference).
- Bayi sidebar footer'ında bu sayfalara link YOK: `src/tenants/bayi/components/sidebar.ts:18-31` listesinde sadece "UPUDev Hakkında / Öneri / Destek" — ToS / İade-iptal / KVKK linkleri yok.
- Emlak'ta da explicit sidebar linki yok (sayfa link'leri footer veya in-page'de görünüyor); ama emlak `panel-ayarlari` "Yasal" bölümünden ulaşılabilir — bayi'de panel-ayarlari yok (bkz. Madde 6).

**Bayi-specific not:**
- ToS metninin 2. bölümü "Hesap Oluşturma ve Üyelik" emlak danışmanı'na yazılmış. Bayi domain'i farklı (distribütör + dealer roller, ürün stok, vade).
- 14 gün cayma + Mollie referansı bayi billing akışı için doğru olabilir (eğer bayi Mollie üzerinden ödüyorsa — bkz. Madde 7), ama bayi-specific tarafların belirsizliği var.

**Boşluk:**
1. Bayi-spesifik ToS metni hazırla (distribütör/dealer rolleri, ürün entegrasyonu, anlaşma akışı) veya `hizmet-sartlari/page.tsx`'i tenant-aware yap (tenant'a göre 2. bölüm switch).
2. Bayi panel'inde ToS/İade/KVKK linkleri için yer (sidebar footer veya panel-ayarlari sayfası).

---

## 5. Cookie banner (Faz 7.1a)

**Durum:** ✅ VAR (tenant-agnostic ama çalışıyor)

**Detay:**
- `src/components/banking/CookieBanner.tsx:18` — `COOKIE_NAME = "cookie_consent_v1"` global.
- Domain logic: `:34-35` — `window.location.hostname.endsWith("upudev.nl")` → `.upudev.nl` domain attribute. 365 gün TTL (`COOKIE_MAX_AGE_DAYS`).
- App-wide mount: `src/app/[locale]/layout.tsx:18` — tüm route group'ların altında. `(bayipanel)` dahil.
- Değer: `"all"` veya `"necessary"` — tenant-aware değil.
- Banner metni tenant-agnostic ("Çerez tercihleri", "Analytics çerezleri") — markaya özel değil, dolayısıyla bayi'de yanlış görünmüyor.

**Bayi-specific not:** Banner bayi sayfalarına da bottom-fixed render. Cookie subdomain-shared (`.upudev.nl`), aynı kabul tüm tenant'larda geçerli. Aynı kullanıcı emlak + bayi panellerine giriyorsa tek "kabul" yetiyor (UX +).

**Boşluk:** Yok — çalışıyor. (Opsiyonel: analytics opt-in'i server-side enforcement'a bağla, ama bu emlak'ta da yok, parity için gerek değil.)

---

## 6. Verilerim panel-ayarlari (Faz 7.1b/c)

**Durum:** ❌ YOK

**Detay:**
- Emlak panel-ayarlari: `src/app/[locale]/(panel)/panel-ayarlari/page.tsx:614-634` — "Gizlilik ve Veriler" bölümü 2 buton:
  - **İndir** → `/api/profile/data-export`
  - **Silme talebi** → `mailto:info@upudev.nl`
- Data export endpoint: `src/app/api/profile/data-export/route.ts:76` — `schema: "upu-emlak-data-export/v1"` hardcoded, `:97` filename `"upu-emlak-veri-export-${today}.json"` hardcoded. Emlak tablolarını dump ediyor (`mulkler`, `musteriler`, `sozlesmeler` vb. — emlak-spesifik query'ler).
- **Bayi panel-ayarlari sayfası yok**: `src/app/[locale]/(bayipanel)/` listesinde `panel-ayarlari` / `ayarlar` / `gizlilik` yok. Bayi profilim (`bayi-profilim/page.tsx`) yalnızca read-only özet.
- Bayi sidebar'da "Panel Ayarları" item'ı yok: `BAYI_SIDEBAR` 12 item içeriyor (Panelim, Bayilerim, Siparişlerim, Tahsilatlarım, Vade Hatırlatma, Kampanyalarım, Cirolarım, Takvim, Profilim, UPUDev Hakkında, Öneri/Şikayet, Destek Talebi). Emlak default sidebar'da var: `admin-layout.tsx:66`.

**Bayi-specific not:**
- Bayi user için data export bayi tablolarını içermeli: `bayi_dealers`, `bayi_orders`, `bayi_dealer_invoices`, `bayi_products`, `bayi_payment_collections`, `bayi_tracking_rules` (Dalga 3'te eklenecek), `bayi_anlasmalar` (Dalga 3'te eklenecek).
- KVKK silme talebi yasal zorunluluk — bayi user için de aynı şekilde erişim noktası gerek.

**Boşluk:**
1. `(bayipanel)/bayi-panel-ayarlari/page.tsx` oluştur (emlak panel-ayarlari pattern'i).
2. `/api/profile/data-export` endpoint'ini tenant-aware refactor — tenant_key okuyup ilgili tabloları dump (bayi → bayi_* tabloları). Schema/filename'i tenant'a göre değiştir.
3. Bayi sidebar'ına "Panel Ayarları" item'ı ekle (separatorBefore'dan önce).

---

## 7. Mollie webhook billing_address sync (Faz 7.1b)

**Durum:** ⚠️ KISMI

**Detay:**
- Webhook: `src/app/api/billing/mollie-webhook/route.ts:79-91` — `handlePayment()` `payment.billingAddress` varsa `profiles.billing_address` jsonb kolonuna sync. Tenant filter **YOK** — `payment.metadata?.user_id`'ye göre direct update.
- Migration: `.planning/migrations/20260514100000_profile_billing_address.sql` (referans planda var, dosya henüz yok — sadece kayıt fact).
- Bayi billing akışı: `src/app/api/bayi-billing/` dizininde **refund** endpoint'i var; payment init endpoint görünmüyor (admin manuel aktivasyon ihtimali yüksek).
- Tenant config: `src/tenants/config.ts` bayi pricing tier'ı var (`starter: EUR 99` benzeri), Mollie ile ödenmesi planlı ama init endpoint görünmüyor.

**Bayi-specific not:**
- `profiles.billing_address` global kolon — bayi sahip kayıtları da bu kolonu kullanacak (multi-tenant safe profile schema).
- Webhook tenant filter yokluğu sürpriz değil çünkü `payment.metadata.user_id` zaten unique. Ama bayi Mollie üzerinden ödemiyorsa webhook'a hiç düşmez → bayi billing_address hiç dolmaz.
- Bayi sahip için billing_address'in nereden geleceği belirsiz (manuel form var mı? Bayi profilim sayfasına eklenecek mi?).

**Boşluk:**
1. Bayi billing akışını netleştir — Mollie mi, manuel mi, başka sağlayıcı mı? (Plan/karar dökümanı eksik.)
2. Mollie üzerindense, webhook handler tenant-aware test (bayi user_id ile gelen ödeme doğru senkronize ediliyor mu?).
3. Bayi billing_address Mollie üzerinden gelmiyorsa, bayi-profilim sayfasında manuel form veya bayi-panel-ayarlari "Fatura Adresi" bölümü.

---

## 8. i18n public landing /tr/uye-ol (Faz 9.x)

**Durum:** ⚠️ KISMI

**Detay:**
- Emlak landing: `src/app/[locale]/uye-ol/page.tsx:27-28` — `useTranslations("signup")` + `useLocale()` ile i18n. Banking style mobile button + desktop QR + KVKK/ToS checkbox'ları (line 182-219).
- Messages: `src/messages/{tr,en,nl}.json` — "signup" namespace ~15 key (title, subtitle, cta_button, kvkk_consent_text, tos_consent_text, qr_label vb.).
- Hardcoded brand: `uye-ol/page.tsx:99` — header `"UPU Emlak"` yazısı, tenant'a göre değişmiyor.
- QR: Desktop'ta `QRCode.toCanvas()` ile generated, BOT_PHONE `31644967207` hardcoded (line 79). Tek bot numarası tüm tenant'lar için (tenant config'te whatsappPhone alanı var ama landing kullanmıyor).
- **Bayi public signup landing yok**: `bayi-uye-ol`, `bayi/uye-ol`, `(bayipanel)/uye-ol` arama sonucu yok.
- Bayi onboarding kanalı: `src/app/api/whatsapp/route.ts:207-282` — `BAYI:CODE` prefix invite code akışı. `src/tenants/bayi/commands/bayi-davet.ts:85` admin manuel invite üretir. Organik (numarayı yazan) signup yok.

**Bayi-specific not:**
- `retailai.upudev.nl/tr/uye-ol` middleware'den geçer, bayi tenant header'ı set edilir, ama sayfa hardcoded "UPU Emlak" yazıyor. Bayi user'a yanlış brand görünüyor.
- Bayi "üye ol" akışı invite-only — public landing bayi için anlam ifade ediyor mu? Eğer bayi acquisition organik gerçekleşmeyecekse landing yerine "Davet kodun varsa WhatsApp'a şu numarayı yaz" sayfası daha doğru.

**Boşluk:**
1. `uye-ol/page.tsx`'i tenant-aware yap (`x-tenant-key` header'ından oku, başlık + CTA metni + QR target değişsin).
2. Bayi için karar: organik signup mı (invite kodu opsiyonel), yoksa invite-only landing mi (kod gerek, WhatsApp'a yaz)?
3. Tenant config'in `whatsappPhone` alanı zaten var (`src/tenants/config.ts`) — landing'in BOT_PHONE'u oradan al.

---

## Ek Sorular

### EK 1 — Bayi onboarding flow

Bayi yeni kullanıcı tamamen **invite-only** akışıyla geliyor:
- `src/app/api/whatsapp/route.ts:207-282` — `BAYI:CODE` text gelir → `bayi_invite_links` tablosunda 6-char hex doğrulanır (active=true, expiry/max_uses kontrol) → yeni auth user + profile INSERT (capabilities role'e göre seed: owner `*`, dealer `DEALER_PRESET`).
- `src/tenants/bayi/commands/dealer-onboarding.ts:15-21` — `dealer_id` null'sa 7 adımlı firma bilgileri onboarding başlar (firma adı → yetkili → kuruluş yılı → ürün → email → vergi no → şehir).
- `src/tenants/bayi/commands/bayi-davet.ts:85` — Owner panelden davet üretir, `buildInviteMessage()` country-aware (NL: KvK, TR: Vergi No).
- Organik (numarayı yazan) signup için bayi tarafında handler yok — `src/app/api/whatsapp/route.ts:575-599` unknown sender'a "Davet kodunuz varsa gönderin" mesajı dönüyor (saas_active_session kontrolü sonrası).

**Sonuç:** Bayi'nin "Üye olmak istiyorum" benzeri public landing button'ı yok. Akış tamamen WhatsApp + invite code. Public landing var (`/tr/uye-ol`) ama emlak için yazılmış, bayi tarafına yönlendirmiyor.

### EK 2 — Bayi panel-ayarlari sayfası

Yok. Bayi sidebar 12 item, emlak default 14 item — fark "Panel Ayarları" (`admin-layout.tsx:66`) ve "Web Sitem" (`:65`). Bayi-profilim sayfası (`(bayipanel)/bayi-profilim/page.tsx:47-108`) sade read-only özet (Hesap 2 field + Firma Bilgileri 7 field).

**Gerek mi?** Evet — KVKK Data Export + Delete Request, abonelik durumu, fatura adresi, bildirim tercihi, hızlı işlem ayarları, KVKK durumu için bayi user'ın da `panel-ayarlari` benzeri sayfasına ihtiyacı var. Madde 3 + 6 + 7 bu sayfa olmadığı için bayi'ye uygulanamıyor.

### EK 3 — Tenant-aware components

**Multi-tenant ready (prop alıyor):**
- `AdminLayout` (`src/components/admin-layout.tsx:128-141`) — `sidebarItems`, `brandTitle`, `accentColor`, `tenantKey`, `botPhone`. Bayi layout doğru geçiyor (`bayipanel/layout.tsx:103-112`).

**Tenant-agnostic (prop almıyor — tenant değişse de aynı render):**
- `CookieBanner` — hardcoded metin ama markaya özel değil, sorun yok.
- `KvkkConsentModal` — `onAccepted, onDefer` only (`KvkkConsentModal.tsx:19`); "UPU Emlak" hardcoded içerikte.
- `StepUpModal` — tenant prop yok (Banking 2FA flow için).
- `HeroBanner`, `StatCard`, `ActionCircle`, `ListCard`, `InfoChip` — design primitives, tenant-agnostic (doğru).

**Mount stratejisi:**
- `[locale]/layout.tsx:3,18` — sadece `CookieBanner` app-wide mount.
- `(panel)/panel/page.tsx:442` — `KvkkConsentModal` emlak-only mount.
- Bayi panel'inde `KvkkConsentModal` mount edilmiyor → bayi user modal'ı hiç görmüyor.

### EK 4 — Shared infra'da hardcoded "emlak"/"estateai"/"UPU Emlak"

**(a) Hardcoded brand string — bayi user'a yanlış görünme RİSKİ:**
- `src/components/banking/KvkkConsentModal.tsx:79` — "UPU Emlak'ı kullanırken..."
- `src/app/[locale]/giris/page.tsx:29` — `<span>UPU Emlak</span>` logo başlık
- `src/app/[locale]/uye-ol/page.tsx:99` — landing header brand
- `src/app/[locale]/aydinlatma-metni/page.tsx:10,11,33,40` — title/description/Veri Sorumlusu
- `src/app/[locale]/hizmet-sartlari/page.tsx:34` — "UPU Dev (UPU Emlak)"
- `src/app/[locale]/iade-iptal/page.tsx:34` — aynı branding
- `src/components/pwa-install-card.tsx:85,123,138` — PWA install prompt'unda 3 yerde "UPU Emlak"
- `src/app/api/profile/data-export/route.ts:76,97` — schema name + filename "upu-emlak-data-export"
- `src/app/api/sozlesmelerim/pdf/route.ts:109,210` — PDF metadata/footer (emlak-specific endpoint olduğu için doğrudan risk değil, ama bayi sözleşme PDF'leri ayrı oluşturulurken pattern olarak unutulmamalı)

**(b) Default fallback (orphan tenant'a karşı koruma):**
- `src/components/admin-layout.tsx:135,138` — default `brandTitle = "🖥 UPU Emlak"`, `tenantKey = "emlak"`. Bayi layout doğru override ediyor ama yeni tenant unutursa emlak yansır.

**(c) Tenant routing / domain-specific (doğal):**
- `src/middleware.ts` DOMAIN_MAP entry'leri.
- `src/tenants/emlak/commands/mulk-ekle.ts:1422` — `"vf:listed:emlakci"` button ID, emlak-only flow.
- `src/app/d/[slug]/page.tsx:118,121,153,156` — "Emlak Danismani" public portfolio sayfaları (emlak'a özel route, bayi tetiklemez).

---

## Tavsiye — Sprint Sırası

Sprint kavramı: ~4-6 saat AI ile, bağımsız test edilebilir, izole risk.

### Sprint A — Yasal/Uyum (KRİTİK — ~4 saat)
**Hedef:** KVKK uyum boşluğunu kapat, bayi user'a yasal hakları erişilebilir kıl.

1. `KvkkConsentModal`'a `tenantKey?: "emlak" | "bayi"` prop ekle, metin switch case.
2. `(bayipanel)/bayi-panel/page.tsx`'e `KvkkConsentModal` mount et (emlak `(panel)/panel/page.tsx:442` pattern'i kopyala). Veya tek seferlik `[locale]/layout.tsx`'e app-wide al + tenant-aware text.
3. `aydinlatma-metni/page.tsx`'i tenant-aware yap (tenant_key header okuyarak).
4. `hizmet-sartlari/page.tsx` ve `iade-iptal/page.tsx` aynı tenant-aware refactor (en azından "UPU Emlak" → tenant.name).
5. Yeni `(bayipanel)/bayi-panel-ayarlari/page.tsx` iskelet — sadece "Gizlilik ve Veriler" bölümü (Madde 6 boşluğunun kritik kısmı). Diğer bölümler (abonelik, bildirim) Sprint B'ye.

**Test PASS:** Bayi user `/tr/bayi-panel`'e ilk girişte KVKK modal pop-up + onay → DB'ye yazıldığını gör. `bayi-panel-ayarlari` 2 buton aktif (data export bayi tablolarını dönüyor, delete request mail'i info@upudev.nl'ye gidiyor).

### Sprint B — UX Parity (~5-6 saat)
**Hedef:** Bayi panel sayfalarını banking design depth'ine çıkar.

1. `(bayipanel)/bayi-panel/page.tsx` → HeroBanner + StatCard + ActionCircle primitives ile refactor (emlak `(panel)/panel/page.tsx` pattern'i).
2. `bayi-siparislerim`, `bayi-tahsilatlarim`, `bayi-raporlar` → ListCard + StatCard.
3. `bayi-panel-ayarlari` tam (12 bölüm değil, bayi için ~6-7 bölüm: profil, gizlilik, abonelik, bildirim, hızlı işlemler, KVKK durumu, yasal).
4. Sidebar item'a "Panel Ayarları" ekle (`separatorBefore` öncesi).

**Test PASS:** Bayi panel sayfaları emlak'la görsel parity (slate palette + dark mode + density-aware kartlar). 4 viewport (375/800/1280/1920) kontrol.

### Sprint C — Brand & i18n (~4 saat)
**Hedef:** Bayi user'a doğru brand göster, public signup kararı al.

1. `uye-ol/page.tsx`, `giris/page.tsx`, `aydinlatma-metni`, `hizmet-sartlari`, `iade-iptal` → tenant-aware (`x-tenant-key` header → brand + CTA + WA bot phone).
2. `pwa-install-card.tsx` → tenant-aware metin.
3. `data-export/route.ts` schema name + filename tenant-aware.
4. Bayi acquisition kararı:
   - **Opsiyon 1 (önerilen):** Invite-only kal, `/tr/uye-ol` bayi tenant'ında "Davet kodun varsa WhatsApp'a yaz BAYI:KOD" ekranına dönüşsün.
   - **Opsiyon 2:** Organik signup aç — `src/app/api/whatsapp/route.ts:575-599`'e bayi organik onboarding handler ekle.

**Test PASS:** `retailai.upudev.nl/tr/uye-ol` → "UPU Bayi" başlığı + bayi WA bot numarası. `/tr/giris` aynı. `data-export` JSON dosyası `upu-bayi-veri-export-{tarih}.json` adıyla iniyor.

### Sprint D — Billing Netleştirme (~2-3 saat, opsiyonel)
**Hedef:** Bayi billing akışını dökümante et + Mollie tenant-aware test.

1. Karar dökümanı: bayi Mollie ile mi ödüyor, manuel mi? Plan dosyası `.planning/bayi-billing-2026-05.md`.
2. Mollie üzerindense: Mollie payment init bayi-spesifik endpoint (`/api/bayi-billing/start`) veya emlak'ın `/api/billing/start` tenant-aware mi?
3. `mollie-webhook/route.ts` tenant-aware log (`payment.metadata.tenant_key`).

**Test PASS:** Bayi sahip Mollie ile ödeme → webhook geliyor → `profiles.billing_address` doluyor → admin panel'de görünüyor.

---

## Notlar

- **Risk:** Sprint A öncesi production'da bayi user'ları KVKK onayı olmadan giriyor. Yasal değerlendirme yapılması faydalı (UPU Dev tüzel kişiliği KVKK Veri Sorumlusu olarak kayıtlı mı, bayi data export hangi tablolardan toplanır vb.).
- **Migration durumu:** `.planning/migrations/2026-05-04-bayi-dealers-extend.sql` henüz uygulanmadı (bilinen issue). `supabase/migrations/20260513160000_kvkk_consent_version.sql` muhtemelen uygulandı (emlak Faz 7.0 deploy edildi) ama bayi profile için ayrı bir şey gerekmiyor (kolon global).
- **Banking primitives kullanım eksikliği** Dalga 1+2 implementation hızı için kabul edilmişti — refactor borç olarak duruyor. Sprint B bu borcu kapatır.
- **Hardcoded "UPU Emlak" listesi** Sprint A + C'de büyük ölçüde temizlenir; tam temizlik için bir grep-and-replace pass + manuel kontrol gerekir (10+ dosya).
