# Emlak Admin Shell Pivot — Replikasyon Referansı (2026-05-06 → 2026-05-07)

Bu dosya **6 SaaS'a (bayi, otel, market, restoran, site, doga)** kopyalanacak desenin
referans kaydıdır. Faz 1 + Faz 2 boyunca alınan kararlar, karşılaşılan engeller ve
adım-adım replikasyon talimatı.

---

## 1. Pivot Kararı

**Tarih:** 2026-05-06
**Önceki durum:** `/tr/panel` = card-grid launcher (komut tetikleyici kartlar)
**Yeni hedef:** Modern admin shell — sol sidebar + üst topbar + dashboard KPI

### Sebep
- Card-grid pattern "yanlış tasarlanmış admin paneli" hissi veriyordu
- CRUD sayfaları (mulklerim, musterilerim vs.) zaten admin pattern; eksik olan
  shell (sidebar nav + üst bar + dashboard)
- Logo/Hubspot/Intercom desenine yaklaştır → tanıdık + profesyonel

### Korunan Mimari (DOKUNULMADI)
- WA = uzaktan kumanda + bildirim merkezi
- Magic link auth (`magic_link_tokens` tablo, `used_at` set edilmez — re-openable)
- WA komut handler'ları (router, intro, menu)
- Sahibinden scrape pipeline + lazy-load patch + cron rapor
- Form sayfaları (mulkekle-form, profil-duzenle, musteri-ekle-form) → shell DIŞI

---

## 2. Faz Dökümü

### Faz 1 — Shell + Dashboard (commit `9541dea`)

**Eklenenler:**
- `src/components/admin-layout.tsx` — sidebar (8 item) + topbar (search/notif/AI placeholder) + mobile drawer
- `src/app/api/panel/dashboard/route.ts` — 6 KPI count endpoint (paralel sorgular)
- `src/app/[locale]/panel/page.tsx` — dashboard rewrite (hero gradient + 6 KPI gradient kart)

**Sidebar items (8):**
Dashboard 🏠 / Mülkler 🏢 / Müşteriler 👥 / Sözleşmeler 📋 / Sunumlar 📊 /
Takip Listeleri 🎯 / Portföy Tara 🔍 / Profilim ⚙️

**KPI'lar (6):** properties, customers, contracts, presentations_this_week,
tracking, presentations (toplam)

### Faz 2 partial — Highlight + a11y + ESC (commit `af05e67`)

- usePathname auto-active highlight (matchPath per item)
- aria-current="page", aria-expanded, aria-controls, aria-label
- ESC tuşu drawer kapat + body scroll lock
- Skip-to-content link (klavye nav)
- Focus rings (focus:ring-2 emerald-400) + 44x44px tap target
- Mobile'da arama gizli (sm:block)

### Faz 2 finish — Route group + tablet ikon-only (bu commit)

**Route group migration:**
- Yeni `src/app/[locale]/(panel)/layout.tsx` — token validate + AdminLayout sarımı
- 6 sayfa taşındı (URL aynı kalır, route group `()` URL'e yansımaz):
  ```
  src/app/[locale]/(panel)/
  ├── layout.tsx          ← /api/panel/init validate + AdminLayout
  ├── panel/page.tsx      ← dashboard (init logic'i layout'a devretti)
  ├── mulklerim/
  ├── musterilerim/
  ├── sunumlarim/
  ├── takip/
  └── ara/
  ```
- `(admin)` group ZATEN platform admin'e ait → çakışma yok, ayrı grup adı seçildi
- Form sayfaları (mulkekle-form, profil-duzenle, musteri-ekle-form, web-sayfam vs.)
  → shell DIŞINDA, mevcut konumlarında (WA WebView için full-screen pattern)

**Tablet ikon-only mode (md=768-1023):**
- Sidebar: `w-64 md:w-16 lg:w-64` (mobile drawer 256px / tablet 64px / desktop 256px)
- Label spans: `md:hidden lg:inline`
- Logo: tam metin desktop'ta, sadece 🖥 tablet'ta
- Office name: tablet'ta gizli
- title="..." attribute → native tooltip (tablet'ta icon hover)
- Main column margin: `md:ml-16 lg:ml-64`

---

## 3. Karşılaşılan Engeller + Çözümler

| Engel | Çözüm |
|---|---|
| `(admin)` route group zaten platform admin için kullanılıyor | Yeni group: `(panel)` |
| Layout'lar Next.js 16'da searchParams'a erişemiyor (auth için token query'de) | Layout'u client component yap → useSearchParams + fetch /api/panel/init |
| Dashboard hero "Hoşgeldin {name}" — name init'ten geliyor, ama init artık layout'ta | Hero'yu generic yap: "Dashboard — Sistemini buradan yönet". Topbar zaten firstName gösteriyor — duplicate kaldırıldı |
| Liste sayfalarının kendi `min-h-screen` wrapper'ı AdminLayout `<main>` içine girince çakıştı mı? | Hayır — page wrapper inner içerik için. AdminLayout outer min-h-screen, page max-w-md center'lar; visually OK, redundant ama harmless |
| `border-l-4 -ml-1 pl-4` highlight tablet'ta dar 64px sidebar'da çirkin | `lg:` prefix → border accent sadece desktop'ta. Tablet'ta sadece bg highlight |
| 6 list page hala kendi /api/<list>/init çağırıyor, layout da /api/panel/init çağırıyor — duplicate | Kabul edildi (her sayfa kendi data'sını çekmeli, layout sadece topbar info için) |

---

## 4. Replikasyon Talimatı (Adım-Adım)

Bu pattern **bayi, doga, otel, market, restoran, site** için aynı şekilde uygulanır.
Her SaaS için ~2-3 saat. Sayfaları taşıma + KPI tanımlama dışı pattern aynı.

### Adım 1 — AdminLayout component oluştur

`src/components/admin-layout-<saas>.tsx` (veya tek shared component + tenantConfig prop).
Ya da: aynı `src/components/admin-layout.tsx`'i SIDEBAR_ITEMS array'ini config'ten okuyacak şekilde generic yap.

**Generic yaklaşım önerilir:** AdminLayout'a `sidebarItems: SidebarItem[]` prop'u ekle.
Her tenant kendi config'ini geçirir.

```tsx
interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  href: (token: string) => string;
  matchPath?: string;
}
```

### Adım 2 — Tenant'a özel sidebar config + KPI tanımla

**Sektörel sidebar items + KPI farkları:**

| SaaS | Sidebar Items | KPI'lar (6) |
|---|---|---|
| **emlak** | Dashboard / Mülkler / Müşteriler / Sözleşmeler / Sunumlar / Takip / Portföy Tara / Profilim | properties, customers, contracts, presentations_this_week, active_tracking, total_presentations |
| **bayi** | Dashboard / Bayilerim / Siparişler / Faturalar / Tahsilat / Kampanyalar / Ürünler / Profilim | bayi_count, active_orders, pending_invoices, overdue_amount, monthly_revenue, low_stock_alerts |
| **otel** | Dashboard / Rezervasyonlar / Konuklar / Odalar / Çek-in/Çek-out / Tahsilat / Personel / Profilim | occupancy_rate (%), active_reservations, today_checkin, today_checkout, monthly_revenue, pending_payments |
| **market** | Dashboard / Stok / Satışlar / Kasa / Tedarikçi / Müşteriler / Personel / Profilim | daily_revenue, low_stock_count, today_sales_count, pending_supplier_orders, active_promotions, customer_count |
| **restoran** | Dashboard / Bugün Sipariş / Menü / Stok / Tedarikçi / Personel / Müşteri / Profilim | today_orders, today_revenue, popular_menu_top1, low_stock, table_occupancy, reservations |
| **site** (siteyonetim) | Dashboard / Sakinler / Aidat / Şikayet/Talep / Personel / Etkinlik / Duyuru / Profilim | active_residents, monthly_dues_collected, open_complaints, upcoming_events, monthly_expenses, payment_due_count |
| **doga** (caretta-xanthos) | Dashboard / Rezervasyonlar / Kaplumbağa Kayıt / Mesajlar / Etkinlik / Bağış / Personel / Profilim | active_reservations, monthly_visitors, turtle_records_count, pending_messages, total_donations, upcoming_events |

### Adım 3 — `/api/<saas>/dashboard` endpoint

Token validate → 6 KPI paralel count sorgusu (Promise.all) → JSON döndür.

**Pattern:**
```ts
const { data: pt } = await sb.from("magic_link_tokens").select("user_id, expires_at").eq("token", token).maybeSingle();
if (!pt || new Date(pt.expires_at) < new Date()) return error;

const [a, b, c, d, e, f] = await Promise.all([
  sb.from("<table1>").select("*", { count: "exact", head: true }).eq("user_id", pt.user_id).filter1(),
  // ... 5 more counts
]);
return NextResponse.json({ kpis: { ... } });
```

### Adım 4 — Route group `(panel)` oluştur

`src/app/[locale]/(panel)/layout.tsx` — emlak ile birebir aynı pattern:
- useSearchParams → token
- fetch `/api/<saas>/init` → displayName + officeName
- error/loading full-screen
- ready → AdminLayout sarımı

### Adım 5 — Mevcut liste sayfalarını taşı

Hangi sayfalar shell altına? **Liste/CRUD sayfaları**, NOT formlar.
- `git mv src/app/[locale]/<list> src/app/[locale]/(panel)/<list>` her biri için
- Form sayfaları (`*-ekle-form`, `*-duzenle`) shell DIŞINDA bırak
- Eski panel sayfası varsa AdminLayout sarımını kaldır (layout zaten sarıyor)

### Adım 6 — WA selamlama → "Paneli Aç" CTA

Tenant'ın WA intro/menu mesajına `/api/panel/start?cmd=panel&t=<TOKEN>` link butonu ekle.
Magic link mint endpoint pattern: `/api/panel/start` (emlak'ta var, kopyala).

### Adım 7 — Dashboard sayfası

`(panel)/panel/page.tsx`:
- KPI grid (2-col mobile, 3-col desktop)
- Hero (gradient bg + tenant'a özel başlık)
- Quick action hint card (sektöre özel)

---

## 5. Tasarım Pattern Notları (Tüm SaaS İçin Sabit)

### Auth
- Magic link 1-saatlik token, `used_at` set edilmez (re-openable)
- Layout `/api/<saas>/init` ile token validate
- Sayfalar kendi list endpoint'lerinde TEKRAR validate (layered defense)

### Form sayfaları (Shell DIŞI, KAPSAMA)
- Mobile-first, full-screen, `max-w-md mx-auto`
- ReturnButtons component (history.back / wa.me cascade)
- WA WebView'da render olur, panel için tasarlanmaz
- Sidebar onlara link verebilir; kullanıcı form'a giderken shell'den çıkar (kabul)

### Responsive Breakpoint Pattern
- `<768px` (mobile): hamburger drawer, sidebar 256px (drawer içinde)
- `768-1023px` (tablet): sidebar 64px ikon-only
- `≥1024px` (desktop): sidebar 256px tam

### A11y Sabitleri
- `<nav aria-label="Ana menü">`
- Aktif item: `aria-current="page"`
- Hamburger: `aria-expanded`, `aria-controls="sidebar-nav"`
- Skip-to-content link en başta (`sr-only focus:not-sr-only`)
- Focus ring: `focus:ring-2 focus:ring-emerald-400`
- Tap target min 44×44px (Apple HIG)

### Renk Paleti
- Sidebar bg: `bg-stone-900` (koyu nötr)
- Aktif item: `bg-emerald-600` (yeşil tenant accent — emlak)
- Tenant değişebilir: bayi mavi, otel mor, market portakal vs. (renk değişkenliği config'e)
- Topbar bg: `bg-white border-slate-200`
- Page bg: `bg-slate-50`

### KPI Card Renk Gradients
emlak'ta: indigo→blue, emerald→teal, amber→orange, violet→fuchsia, rose→pink, slate→stone.
Diğer tenant'lar farklı palet seçebilir; KPI semantiği tutarlı kalır.

---

## 6. Test PASS/FAIL Listesi

### Build + Statik
- ✅ `npm run build` PASS (Compiled successfully in 62s)
- ✅ Route group `(panel)` URL'e yansımıyor: `/tr/panel`, `/tr/mulklerim` vs. korundu
- ✅ TS hata yok, lint PASS

### Korunan Akışlar (KIRILMADI)
- ⏳ WA "musteriler" → list mesajı (kullanıcıda manuel test)
- ⏳ WA "mulkekle" → form linki (kullanıcıda manuel test)
- ⏳ /tr/profil-duzenle → form (shell YOK, full-screen — kullanıcıda doğrula)
- ⏳ Magic link reuse — Başlat 5x sıralı (kullanıcıda doğrula)

### Yeni Akışlar
- ✅ /tr/mulklerim direkt URL → AdminLayout sarımı (layout testte init validate)
- ✅ Sidebar usePathname auto-active highlight (kod testte)
- ✅ Tablet ikon-only mode (kod testte)
- ⏳ 4 viewport gerçek tarayıcı testi (375 / 800 / 1280 / 1920) — kullanıcıda
- ⏳ ESC drawer kapat — kullanıcıda
- ⏳ Tab nav focus ring — kullanıcıda

---

## 7. Commit Hash'ler

| Faz | Commit | Açıklama |
|---|---|---|
| Faz 1 | `9541dea` | admin shell pivot — Faz 1 (sidebar + dashboard) |
| Faz 2 partial | `af05e67` | sidebar highlight + a11y + ESC/scroll-lock |
| Faz 2 finish | _bu commit_ | route group `(panel)` + tablet ikon-only + replikasyon referansı |

## 8. Revert Anchor

- Faz 2 finish başarısızsa: `git reset --hard af05e67`
- Tüm Faz 2 başarısızsa: `git reset --hard 9541dea`
- Pivot tamamen başarısızsa: `git reset --hard ef2a805`

---

## 9. Gold Standard Onayı

Bu pivot **gold standard** kabul edildiğinde 6 SaaS'a paralel replikasyon talimatı çıkar.
Onay kriterleri:
- Build PASS ✅
- 4 viewport gerçek tarayıcı testi PASS ⏳ (kullanıcıda)
- WA komut akışları KIRILMADI ⏳ (kullanıcıda)
- Form sayfaları KIRILMADI ⏳ (kullanıcıda)

Onay sonrası: bu dosya replikasyon brief'i için kopyalanır, her SaaS için
"Adım 2 — sidebar config + KPI" tablosundan ilgili satır kullanılır.

---

## 10. Sıcak Karşılama (3-Mesaj Pattern, 2026-05-07)

WA selamlama tek uzun blok yerine 3 mesaja bölündü, aralarında ~1.8 sn sleep
("sohbet havası"). emlak için `src/platform/whatsapp/intro.ts` içinde
`startIntro` fonksiyonunun emlak path'ine uygulandı. sendEmlakMenu çağrısı
kaldırıldı — Mesaj 3 (panel CTA) onun yerini aldı.

### Pattern Sabit (FORMAL "siz")
Tüm mesajlar **formal "siz"** dili kullanır — "sen, sana, satışlarını" değil
"siz, size, satışlarınızı". Tutarlı profesyonel ton.

- **Mesaj 1 (greeting):** `👋 Merhaba {firstName}! ✨\n\nBen kişisel asistanınız UPU. 7/24 <core-promise (siz formu)>.`
- **sleep 1800 ms**
- **Mesaj 2 (kabiliyetler):** `🎯 *Yapabileceklerimden bazıları:*\n\n✅ <madde1>\n✅ <madde2>\n✅ <madde3>\n✅ <madde4>` (4 madde, fiil ile başla, 1 satır, "siz" formal)
- **sleep 1800 ms**
- **Mesaj 3 (CTA):** `🖥 *Yönetim paneliniz hazır.*\n\nTüm sisteminizi yönetmek için panele gidin.\n\n_Dilerseniz daha sonra komutlarla buradan da yönetebilirsiniz._` + sendUrlButton "🖥 Paneli Aç" + magic link
  - Vurgu: panel ASIL yer, WA tamamlayıcı (WA'yı tekrar adlandırmaya gerek yok — zaten orada konuşuluyor)
  - "yönetmek" anahtar kelime (üst-seviye fiil), "komutları görüntülemek" değil

### WA Cloud API Typing Indicator Notu
Cloud API typing_indicator yalnız `markAsRead` çağrısında inbound message_id'ye
attach edilebilir — outbound mesajlar arasında native typing göstergesi yok.
Sleep yeterli; mesajlar 1.8 sn aralıkla geldiği için kullanıcı doğal "yazıyor"
ritmi hisseder. (markAsRead zaten ilk gelen mesajda typing tetikler — read
receipt kapsamında, ekstra iş gerekmiyor.)

### Sektörel Wording Tablosu (6 SaaS Replikasyon)

| SaaS | Core promise (Mesaj 1) | 4 Kabiliyet (Mesaj 2) |
|---|---|---|
| **emlak** | satışlarınızı artırmak için çalışacağım | (1) Her sabah Bodrum'daki sahibi ilanlarını filtreleyip size gönderirim (2) Yapay zeka ile dakikalar içinde profesyonel sunum hazırlarım (3) Sahibinden ilan yüklemenizi 30 dk'dan 3 dk'ya indiririm (4) Sizin için web sayfası hazırlarım |
| **bayi** | tahsilatlarınızı ve sipariş operasyonunuzu kolaylaştıracağım | (1) Yeni bayi başvurularınızı telefonla onaylayıp sisteme eklerim (2) Vadesi gelen tahsilatlarınız için hatırlatma metni hazırlar, onayınızla bayiye gönderirim (3) Bayi siparişlerinizi WA'dan tek akışta sisteme kaydederim (4) Tüm bayilerinize tek tıkla kampanya duyurusu yaparım |
| **doga** (caretta-xanthos) | rezervasyonlarınızı ve gönüllü organizasyonunuzu sorunsuz yöneteceğim | (1) Günlük rezervasyon brifinginizi sabah hazırlarım (2) Kaplumbağa kayıt formlarınızı WA'dan tek akışta sisteme alırım (3) Etkinlik duyurularınızı ve bağışçı mesajlarınızı yazar, onayınızla gönderirim (4) Gönüllü çağrılarınıza tek tıkla yanıt verebilirsiniz |
| **otel** | doluluğunuzu ve gelirinizi artırmak için çalışacağım | (1) Sabah doluluk + bugün çek-in/çek-out brifinginizi hazırlarım (2) Telefonla gelen rezervasyonlarınızı tek akışta sisteme kaydederim (3) Sürekli müşterileriniz için doğum günü/sezon mesajı taslakları hazırlarım (4) Açık ödemeler ve kart bilgisi olmayan rezervasyonlar için uyarı veririm |
| **market** | kasanızı her gün düzenli tutmak için çalışacağım | (1) Sabah dünkü ciro + bugün stok brifinginizi getiririm (2) Stok kritik seviyeye düşünce uyarır, tedarikçi sipariş önerisi sunarım (3) Müşteri sadakat hatırlatmaları ve doğum günü kupon önerileri hazırlarım (4) Tedarikçi siparişlerinizi WA'dan tek akışta sisteme alırım |
| **restoran** | siparişlerinizi hızlandırıp müdavim ilişkinizi güçlendireceğim | (1) Sabah dünkü satış + bugün rezervasyon brifinginizi hazırlarım (2) Telefonla gelen rezervasyonlarınızı masa atamayla sisteme kaydederim (3) Müdavim panosu — kim 2+ haftadır yok, kimin doğum günü olduğunu size bildiririm (4) Sadakat club daveti + sürpriz mesaj taslaklarını hazırlarım |
| **site** (siteyonetim) | sakin iletişiminizi ve aidat takibinizi düzene sokacağım | (1) Açık şikayet/talep özetinizi her sabah getiririm (2) Aidat ödenmemiş daireler için hatırlatma metni hazırlarım (3) Etkinlik + duyuru mesajlarınızı yazar, onayınızla gönderirim (4) Personel görev atama + tamamlanma bildirimleri yaparım |

### Replikasyon Adımı

`src/platform/whatsapp/intro.ts` veya tenant-specific intro dosyasında:
1. Tek uzun introMsg sendText'i sil
2. 3 sequential sendText + sleep(1800) ekle (yukarıdaki tablo metinlerini kullan)
3. Mesaj 3'te magic link mint + sendUrlButton "🖥 Paneli Aç"
4. Eski tenant menu helper (sendEmlakMenu vb.) çağrısını kaldır — Mesaj 3 onu kapsar
5. profile metadata `onboarding_completed: true` set et
