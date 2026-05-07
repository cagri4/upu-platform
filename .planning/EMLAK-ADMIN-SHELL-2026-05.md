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

### Marka Adı + Auto-Link Önleme
WA client'ları `marka.com` veya `marka.tr` pattern'ini otomatik link yapar.
Mesaj metninde 3. parti markaları **camelCase** yaz (nokta YOK):
- ❌ "sahibinden.com" → tıklanabilir link olur
- ✅ "sahibindenCom" → düz metin, marka referansı korunur

Diğer örnekler: `hepsiburadaCom`, `trendyolCom`, `yemeksepetiCom`, `bookingCom`,
`googleCom`. Replikasyon brief'lerinde bu kural sabittir.

### WA Cloud API Typing Indicator Notu
Cloud API typing_indicator yalnız `markAsRead` çağrısında inbound message_id'ye
attach edilebilir — outbound mesajlar arasında native typing göstergesi yok.
Sleep yeterli; mesajlar 1.8 sn aralıkla geldiği için kullanıcı doğal "yazıyor"
ritmi hisseder. (markAsRead zaten ilk gelen mesajda typing tetikler — read
receipt kapsamında, ekstra iş gerekmiyor.)

### Sektörel Wording Tablosu (6 SaaS Replikasyon)

| SaaS | Core promise (Mesaj 1) | 4 Kabiliyet (Mesaj 2) |
|---|---|---|
| **emlak** | satışlarınızı artırmak için çalışacağım | (1) Her sabah yeni sahibi ilanları ile portföyünüzü büyütmenize yardım ederim (2) Yapay zeka ile dakikalar içinde profesyonel sunum hazırlarım (3) sahibindenCom ilan yüklemenizi 30 dk'dan 3 dk'ya indiririm (4) Sizin için web sayfası hazırlarım |
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

---

## 11. Panelim Yeniden Tasarım (2026-05-07)

Kullanıcı testi sonucu /tr/panel sayfası + sidebar baştan elden geçirildi.

### KRİTİK BUG FIX
- **Sorun:** Sidebar "Sözleşmeler" item'ı `/api/panel/start?cmd=sozlesme&...` URL'ine gidiyordu; o endpoint `yardim-content` startAction'a göre `wa.me/<bot>?text=sozlesme`'ye 302'liyordu. Kullanıcı sidebar'da bir item'a tıklayınca WhatsApp'a fırlatılmış oluyordu.
- **Fix:** Sözleşmeler href'i `/tr/sozlesmelerim?t=<TOKEN>` (yeni placeholder sayfa) ile değiştirildi. **Replikasyon kuralı:** sidebar item href'leri ASLA `/api/panel/start` veya `wa.me`'ye gitmemeli — yalnız panel-içi `/tr/<page>` URL'leri (Web Sitem hariç, o `/api/panel/web-sitem` redirect endpoint'ine gider — slug → /u/<slug> çevirisi server-side).

### Hero + KPI değişiklikleri
- "Dashboard" → **"Panelim"**
- Hero metni: "Sisteminizi buradan yönetin" + italic alt satır "_Paneldeki kartlara sol menüden de ulaşabilirsiniz._"
- KPI rename: "Aktif Takip" → **Takiplerim**, "Toplam Sunum" → **Sunumlarım**
- Kaldırıldı: "Bu Hafta Sunum" (presentations_this_week count endpoint'ten silindi)
- Eklenenler (8 kart toplam): **Takvim** (Yakında badge), **Profilim** ("Düzenle"), **Web Sitem** ("Aktif"/"Kur" — slug varlığına göre)

### Yeni Sidebar (13 item + 1 logout)

```
1.  🏠 Panelim          → /tr/panel
2.  🏢 Mülklerim        → /tr/mulklerim
3.  👥 Müşterilerim     → /tr/musterilerim
4.  📋 Sözleşmelerim    → /tr/sozlesmelerim       (placeholder)
5.  📊 Sunumlarım       → /tr/sunumlarim
6.  🎯 Takiplerim       → /tr/takip
7.  🔍 Portföy Tara     → /tr/ara
8.  📅 Takvim           → /tr/takvim              (placeholder, "Yakında")
9.  👤 Profilim         → /tr/profil-duzenle      (form, shell DIŞI)
10. 🌐 Web Sitem        → /api/panel/web-sitem    (server-side redirect)
─────────────────────── separatorBefore: true
11. ℹ️  UPUDev Hakkında → /tr/hakkinda
12. 💬 Öneri / Şikayet  → /tr/oneri               (placeholder)
13. 🛟 Destek Talebi    → /tr/destek              (placeholder)
─────────────────────── (logout button — separate section)
14. 💬 WhatsApp'a Dön   → handleLogout (history.back / wa.me)
```

`SidebarItem.separatorBefore?: boolean` flag'i eklendi — true olan item'dan
önce `<hr>` render edilir.

### Topbar Değişiklikleri
- Search input **kaldırıldı** (kullanıcı istemiyor; Faz 3'te wire-up'lı arama planlanmıyor şu an)
- 🔔 bildirim + 🤖 AI placeholder ikonlar **kaldı** (Faz 3 backlog)

### Sidebar Layout Refactor
- `<aside>` → `flex flex-col` yapıldı
- Header `flex-shrink-0`, nav `flex-1 overflow-y-auto`, footer `flex-shrink-0`
- 13 item + logout footer küçük ekranda taşmaz, scroll devreye girer
- Eski `absolute bottom-0` footer kaldırıldı (taşma + overlap riski vardı)

### Yeni Placeholder Sayfalar (Tümü `(panel)` route group içinde)
- `/tr/takvim` — TODO + randevu, "Yakında"
- `/tr/sozlesmelerim` — Aktif sözleşmeler, "Yakında" + WA komut hatırlatması
- `/tr/hakkinda` — UPUDev firma metni + iletişim
- `/tr/oneri` — Öneri/şikayet, "Yakında"
- `/tr/destek` — Destek talebi, "Yakında"

### Yeni API Endpoint
- `/api/panel/web-sitem?t=<TOKEN>` — token validate → profile.metadata.agent_profile.web_slug bak → varsa /u/<slug> 302, yoksa /tr/profil-duzenle?t=<freshToken> 302

### Faz 3 Backlog (bu turda yapılmayan)
- Takvim kart İÇERİĞİ — TODO listesi, tarih+saat, WA bildirim entegrasyonu
- Bildirim zili wire-up
- AI robot drawer
- /tr/oneri /tr/destek formları (gerçek submit)
- CRUD pattern: Mülklerim/Müşterilerim sayfalarına "+ Yeni Ekle" + tablo aksiyon (Düzenle/Sil/Sunum yap) — şu an sayfalar liste-only

### Replikasyon Notu
Bu sidebar yapısı 6 SaaS'a kopyalanırken:
- Item 1-7 sektörel (her tenant kendi listesi — Bölüm 4 tablosu)
- Item 8-13 ortak (Takvim, Profilim, Web Sitem, Hakkında, Öneri, Destek)
- Item 14 logout (tüm tenant'larda aynı handleLogout fonksiyonu)
- Web Sitem her tenant için /api/<saas>/web-sitem redirect endpoint'i gerekir (otel için /u/<otel-slug>, market için /u/<market-slug> vb.)

---

## 12. Kart Detay Sayfası — Primary Aksiyon Butonu (2026-05-07)

Liste sayfaları (Mülklerim, Müşterilerim vs.) açıldığında kullanıcı **ne yapmak istiyorsa** onu yapacak primary CTA butonu üst kısımda görmeli — empty state olsun olmasın.

### Yerleşim

```
[Hero gradient banner: ikon + başlık + count]
─────────────────────────────────────────────
[➕ Aksiyon Butonu] (full-width primary, gradient)
─────────────────────────────────────────────
[Liste tablosu]                ← varsa
veya
[Empty state: ikon + başlık + "yukarıdaki butonu kullanın"]
─────────────────────────────────────────────
[Panele Dön] [WhatsApp'a Dön]  ← ReturnButtons (mevcut)
```

### Sayfa-Aksiyon Eşleşmesi (emlak)

| Sayfa | Buton | Hedef |
|---|---|---|
| /tr/mulklerim | ➕ Mülk Ekle | `/api/panel/start?cmd=mulkekle&t=<TOKEN>` → fresh-mint → /tr/mulkekle-form |
| /tr/musterilerim | ➕ Müşteri Ekle | `/api/panel/start?cmd=musteriEkle&t=<TOKEN>` → /tr/musteri-ekle-form (camelCase önemli) |
| /tr/sozlesmelerim | ➕ Sözleşme Yap | `/api/panel/start?cmd=sozlesme&t=<TOKEN>` → wa.me redirect (WA akışı) |
| /tr/takvim | ➕ Görev Ekle (Yakında) | disabled, Faz 3 wire-up |
| /tr/sunumlarim | _yok_ | Sunumlar AI'la mülklerim'den otomatik üretilir, manuel ekleme yok |
| /tr/ara | _yok_ | Sayfa zaten arama formu — buton anlamsız |
| /tr/takip | _yok_ | Sayfa zaten takip kriteri formu (form-only page, list değil) |

### Buton Stili
- **Full-width, gradient primary** (sayfa hero'su ile uyumlu palette: indigo-blue, emerald-teal, amber-orange, sky-cyan)
- Icon (➕) + metin
- `shadow-md hover:shadow-lg active:scale-95 transition`
- Disabled (placeholder): `bg-slate-300 text-slate-500 cursor-not-allowed`

### `/api/panel/start` Doğru Kullanımı
- **Sidebar item href'lerinde KULLANMA** — sidebar item'ı bu endpoint'e gitmemeli (Bölüm 11 bug fix)
- **Liste sayfası action butonlarında DOĞRU** — burada fresh-mint magic-link tam istediğimiz davranış (token reuse fix korunur)
- yardim-content `command` adı **case-sensitive** — `musteriEkle` (camelCase) doğru, `musteriekle` çalışmaz

### Empty State Polish
Eski: tek satır metin, `WhatsApp'tan ... komutunu kullanın`
Yeni:
```
🏢 (büyük ikon)
Henüz mülk yok
İlk mülkünüzü eklemek için yukarıdaki butonu kullanın.
```
Buton üst kısımda primary CTA olduğu için empty state metni "yukarıdaki butonu kullanın" diye yönlendirir, WA komutunu zorlamaz.

### Sektörel Replikasyon Tablosu

| SaaS | Liste Sayfası → Aksiyon Butonu |
|---|---|
| **emlak** | Mülklerim → ➕ Mülk Ekle / Müşterilerim → ➕ Müşteri Ekle / Sözleşmelerim → ➕ Sözleşme Yap |
| **bayi** | Bayilerim → ➕ Bayi Ekle / Siparişler → ➕ Sipariş Kaydet / Tahsilat → ➕ Tahsilat Hatırlat / Kampanyalar → ➕ Kampanya Oluştur / Ürünler → ➕ Ürün Ekle |
| **otel** | Rezervasyonlar → ➕ Rezervasyon Al / Konuklar → ➕ Konuk Kaydet / Çek-in → ➕ Çek-in Yap / Tahsilat → ➕ Ödeme Al |
| **market** | Stok → ➕ Ürün Ekle / Satışlar → ➕ Satış Kaydet / Tedarikçi → ➕ Tedarikçi Ekle / Müşteriler → ➕ Müşteri Ekle |
| **restoran** | Bugün Sipariş → ➕ Sipariş Al / Menü → ➕ Menü Ekle / Stok → ➕ Stok Girişi / Tedarikçi → ➕ Tedarikçi Ekle |
| **site** (siteyonetim) | Sakinler → ➕ Sakin Ekle / Aidat → ➕ Tahakkuk Aç / Şikayet → ➕ Talep Ekle / Etkinlik → ➕ Etkinlik Oluştur |
| **doga** (caretta-xanthos) | Rezervasyonlar → ➕ Rezervasyon Al / Kaplumbağa → ➕ Kayıt Aç / Mesajlar → ➕ Mesaj Gönder / Bağış → ➕ Bağışçı Ekle |

Replikasyon: her tenant için liste sayfasına aynı pattern (full-width gradient button + empty state polish + /api/panel/start fresh-mint) uygulanır.

---

## 13. Form 2-Buton + Done State Pattern (2026-05-07)

Form sayfaları artık tek "Kaydet ve WA'a Dön" buton yerine **2 buton + sade done state** kullanır.

### Submit Row (form altı)
```
[✅ Kaydet] (primary, full flex-1) [🖥 Panele] (secondary, küçük link)
```
- Primary: tenant accent (yeşil emerald, mavi blue, mor violet…)
- Secondary: `bg-white border-slate-300 text-slate-700` küçük link
- Kaydet WA'a OTOMATIK dönmez — kullanıcı tercih eder

### Done State (status === "done")
```
✨ Profil/Mülk/Müşteri kaydedildi!
"Kısa sonuç metni"

[🖥 Panele Dön] (primary CTA, tenant accent)
[ReturnButtons] (Panele Dön + WA'a Dön ikilisi — fallback)
```
- Done state metni "WhatsApp'a dönerek devam edin" YERİNE pozitif "X panelde listelenir" / "hazır"
- Eski tek-buton "Kaydet ve WA'a Dön" davranışı tamamen silindi

### Hint Headers — "💡 İpucu:" Prefix
Tüm form heroları altında ipucu metni varsa "💡 İpucu:" prefix kullanır:
- "Ne kadar bilgi girerseniz AI o kadar iyi sunum yazar" → "💡 İpucu: Ne kadar bilgi girerseniz AI o kadar iyi sunum yazar"

### Replikasyon
6 SaaS form sayfaları: aynı 2-buton + done state + 💡 İpucu pattern'i. Tenant accent renk değişir.

---

## 14. /u/[slug] + Sunum + Mülk Tek-Sayfa Sadeleştirme (2026-05-07)

3 sayfada gereksiz öğeler temizlendi:

| Sayfa | Silinen |
|---|---|
| `/u/[slug]` (agent landing) | Footer "UPU Dev ile oluşturuldu" — sahip-only `🖥 Panele Git` butonu KORUNUR |
| `/d/p/[token]` (sunum) | `<FinishCTA />` ("✅ Devam Et" + "Sunumu bitirdiğinizde tıklayın..." metni) + footer "UPU Dev ile oluşturuldu" |
| `/d/[slug]` (mülk single page) | Footer "UPU Dev ile olusturuldu" (© 2026 + ad korundu) |

**Replikasyon kuralı:** Müşteriye/ziyaretçiye gösterilen public sayfalarda "UPU Dev" markası **footer'da yok** — temiz kullanıcı deneyimi. Sahip-only "Panele Git" butonu auth token query parametresi varsa görünür.

`finish-cta.tsx` dosyası diskte kaldı (yetim component) — silinmedi, sadece çağrı kaldırıldı.

---

## 15. Liste Sayfaları Arama Kutusu (2026-05-07)

Müşterilerim ve Mülklerim listelerine canlı filtre eklendi.

### Pattern
```tsx
const [searchQuery, setSearchQuery] = useState("");
const filtered = useMemo(() => {
  const q = searchQuery.trim().toLocaleLowerCase("tr");
  if (!q) return items;
  return items.filter((x) =>
    (x.field1 || "").toLocaleLowerCase("tr").includes(q) ||
    (x.field2 || "").toLocaleLowerCase("tr").includes(q),
  );
}, [items, searchQuery]);
```

### Yerleşim
```
[Hero gradient]
[➕ Aksiyon Butonu]
[🔍 Arama kutusu]   ← items.length > 0 ise göster
[Liste / Empty / "Eşleşen X bulunamadı"]
```

### Sektörel Replikasyon Tablosu

| SaaS | Liste | Filtre alanları |
|---|---|---|
| **emlak** | Müşterilerim | isim, telefon, bölge |
| **emlak** | Mülklerim | başlık, bölge, listing_type, type |
| **bayi** | Bayilerim | firma adı, ilçe, yetkili |
| **otel** | Konuklar | isim, oda no, tarih |
| **market** | Müşteriler | isim, telefon, sadakat seviyesi |
| **restoran** | Müdavimler | isim, sıklık, doğum günü ayı |

`toLocaleLowerCase("tr")` kullanılır — Türkçe i/I ayrımı için kritik.

---

## 16. Evergreen Panel Link Pattern (2026-05-07, Bug B fix)

### Problem
WA mesajlarındaki "🖥 Panele Git" link'leri pre-mint magic_link_token kullanıyordu. Token TTL geçince (1 saat / 7 gün) eski mesajlardan tıklanan link'ler "süresi dolmuş" hatası veriyordu.

### Çözüm
Yeni `/api/panel/evergreen?phone=<phone>` endpoint:
1. Phone parametresinden `profiles.whatsapp_phone` üzerinden user_id bul
2. Fresh `magic_link_tokens` mint (1 saat TTL — kullanıcı şimdi tıkladı)
3. 302 redirect → `/tr/panel?t=<fresh_token>`

### Tüm Panel CTA'ları Güncellendi
- `sendBackToPanel` (save endpoint'leri sonrası): pre-mint silindi → evergreen URL
- `sendEmlakMenu`: pre-mint silindi → evergreen URL
- `intro.ts` Mesaj 3 (Paneli Aç): pre-mint silindi → evergreen URL

### Güvenlik Profili
Phone parametresi WA'da bot'la konuşan numaraya eşit; URL üçüncü tarafa sızmadıkça risk düşük. Pre-mint token leak riskiyle aynı kategoride; kazançlı taraf: eski mesajlardan tıklamada UX kırılmıyor.

### Replikasyon
6 SaaS için aynı endpoint pattern'i:
- `/api/panel/evergreen?phone=<phone>` her tenant için tek endpoint (whatsapp_phone tüm tenant'larda profiles tablosunda standart alan)
- Tüm tenant menu helper'ları (sendBayiMenu, sendOtelMenu vs.) bu URL'i kullanır
- Tenant intro Mesaj 3'leri (warm welcome) bu URL'i kullanır

---

## 17. Bildirim + Panel CTA Standardı (2026-05-07)

### Kural
Bot'un gönderdiği **bildirim mesajları** (haber/sonuç/uyarı) sonrasında "🖥 Panele Git" CTA URL butonu eklenir — kullanıcı her an panele tek tıkla geçebilsin.

### sendBackToPanel(userId, phone) Helper
- Save endpoint'lerinden sonra çağrılır: mulkekle/save, musteri/save, profilduzenle/save, sozlesme/save vb.
- 2-mesaj pattern: önce ana CTA mesajı (örn "Web Sayfamı Aç", "Sunumu Gör"), ardından kısa "Panele Git" URL button
- WA Cloud API reply + URL button mix yasak olduğu için 2 ayrı mesaj zorunlu

### İstisnalar (Panel CTA EKLEME)
- Greeting/intro mesajları (Mesaj 3 zaten Panel Git içeriyor)
- Tek-satır acknowledgement ("Kaydedildi" gibi mini mesajlar — kullanıcı 2 mesaj görmek istemez)
- Form-link mesajları (kullanıcı zaten formdan dön akışında olacak)
- Read-receipt + typing indicator

### Replikasyon
6 SaaS save endpoint'leri için kendi `sendBackToPanel` analogları (ya da shared helper) kullanılır. URL evergreen pattern'i ile.

---

## 18. Panel-İçi Sözleşme Akışı (FAZ A, 2026-05-07)

Sözleşme oluşturma artık WhatsApp'a redirect ETMİYOR — tamamen panel-içi.

### Eski Akış (Silindi)
- /tr/sozlesmelerim → "+ Sözleşme Yap" → /api/panel/start?cmd=sozlesme → wa.me/...?text=sozlesme → WA'da multi-step session

### Yeni Akış
1. /tr/sozlesmelerim → "+ Sözleşme Yap" → `/tr/sozlesme-yap` (panel-içi)
2. Sayfa 3-aşamalı:
   - **Select**: Mülk seç (dropdown, kullanıcının mülklerinden) + Müşteri seç (dropdown)
   - **Form**: Komisyon (%), Süre (ay), Münhasır (checkbox)
   - **Save**: contracts tablosuna insert + sign_token mint + WA bildirim
3. **Done state**: İmza linki preview + 📋 Linki Kopyala + 💬 WA ile Paylaş + 📋 Sözleşmelerime Git

### API Endpoints
- `/api/sozlesme/init?t=<TOKEN>` — kullanıcının mülk + müşteri listesi
- `/api/sozlesme/save` — contracts insert + sign_token + WA bildirim (sendBackToPanel ile)
- `/api/sozlesmelerim/list?t=<TOKEN>` — kullanıcının sözleşmeleri (status badge'lerle)

### Mevcut Schema Korundu
contracts tablosu (id, tenant_id, user_id, property_id, type, status, sign_token, contract_data JSONB) DEĞİŞMEDİ. WA tarafındaki sozlesme.ts insert pattern'i ile uyumlu. type="yetkilendirme", status="pending_signature".

### AI Generation — Bu Sürümde Yok
Brief'te Claude API ile sözleşme metni üretme istenmişti; bu sürümde **preview = form özeti**. Mevcut akış değer üretiyor (panel-içi + paylaş + listele); AI generation follow-up'ta eklenir (yeni endpoint /api/sozlesme/generate, Anthropic SDK ile sözleşme metni üretip contract_data.generated_text'e kaydet).

### /tr/sozlesmelerim Liste Görünümü
- Her sözleşme kart: status badge (✅ İmzalı / ⏳ İmza bekliyor / 📝 Taslak), mülk + müşteri ad, komisyon + süre, tarih, imza linki (pending durumda görünür)
- Empty state: "Henüz sözleşme eklemediniz"

### Replikasyon
Her SaaS'ın "yetkilendirme" sözleşmesi farklı (otel: rezervasyon onay, market: tedarikçi anlaşma, bayi: dağıtım sözleşmesi) — generic pattern aynı kalır:
- /tr/<doc>-yap (yeni sayfa, panel-içi)
- /api/<doc>/init (mülk+müşteri analogu — örn. otel: oda+konuk)
- /api/<doc>/save (insert + sign_token + WA bildirim)
- /tr/<doclar>im (liste sayfası)

---

## 19. FAZ B — Takiplerim Multi-Row + Yönet (2026-05-08)

Onay (a): schema migration ile çok-takip yönetimi açıldı.

### Migration SQL
`supabase/migrations/20260508120000_tracking_multirow.sql`:
```sql
ALTER TABLE emlak_tracking_criteria DROP CONSTRAINT IF EXISTS uq_tracking_user;
ALTER TABLE emlak_tracking_criteria ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'İlk takibim';
UPDATE emlak_tracking_criteria SET name = ... (lokasyon+listing_type'tan üret);
CREATE INDEX idx_tracking_user_created ON emlak_tracking_criteria(user_id, created_at DESC);
```
- `uq_tracking_user` UNIQUE constraint kaldırıldı → multiple rows per user
- `name` kolonu eklendi (kullanıcı etiketi: "Yalıkavak villa kiralık")
- Mevcut `active` boolean Durdur/Aktif toggle için kullanılır
- Per-user 5 takip max — uygulama-seviyesi limit

### API Endpoints (multi-row)
- `/api/takip/init` — `.maybeSingle()` → list array
- `/api/takip/save` — `id` varsa UPDATE, yoksa INSERT (5 limit kontrolü)
- `/api/takip/delete` — DB'den row siler
- `/api/takip/toggle` — active boolean flip

### UI — /tr/takip Sayfası Yeniden
İki view mode:
- **List view (default)**: hero "Takiplerim" + "+ Takip Ekle" butonu + her takip kart (name + summary + status badge + 3-buton aksiyon: ⏸ Durdur / ▶️ Aktif, ✏️ Düzenle, 🗑 Sil) + ReturnButtons
- **Form view**: "Takip Ekle" / "Takibi Düzenle" hero + `name *` zorunlu alan + bölge/tip/listing/fiyat seçimleri + ✅ Kaydet/Güncelle + ← Geri

Kart aksiyon UI:
```
[Header: name + status badge]
[Body: bölge · tip · listing summary + price range]
[Footer 3-col: ⏸ Durdur | ✏️ Düzenle | 🗑 Sil]
```

### Cron Refactor (`tenant-briefings.ts`)
Eski: tek `.maybeSingle()` criteria → tüm leads filtre
Yeni: tüm aktif criteria fetch → her takibe ayrı match → per-takip sections

Mesaj formatı (multi-takip):
```
🌅 Günaydın {ad}!

3 takipten toplam 12 yeni sahibi ilan var. ...

📍 Yalıkavak villa kiralık (5)
1. ...
2. ...

📍 Bitez daire satılık (4)
...

📍 Turgutreis 2+1 (3)
...
```
Tek takip için section header gösterilmez (önceki davranışla uyum).

`allMatchingIds` Set → "uyan ama hepsini gördün" mesajını koruyor.

### Replikasyon
Sektörel takip pattern her SaaS için aynı:
- bayi: tahsilat takibi (vade hatırlatma kriterleri)
- otel: doluluk takibi (uyarı eşik kriterleri)
- market: stok takibi (kritik seviye kriterleri)
- restoran: müdavim takibi (X+ haftadır gelmedi alarmı)

Pattern aynı: multi-row tablo + name + active toggle + per-criteria cron loop + per-section message.

---

## 20. AI Sözleşme Generation (FAZ A genişletme, 2026-05-08)

Sözleşme oluşturma akışına Claude Haiku ile metin üretimi eklendi.

### Endpoint: `/api/sozlesme/generate`
- POST: token, property_id, customer_id, commission, duration, exclusive
- Claude Haiku 4.5 model
- System prompt: TBK + KVKK uyumlu Türkçe sözleşme, 8-bölüm format
  (BAŞLIK, TARAFLAR, KONU, BEDEL, KOMİSYON/SÜRE/MÜNHASIRLIK, CAYMA, UYUŞMAZLIK, İMZA)
- User prompt: mülk + müşteri + ofis bilgileri + parametreler
- Output: 1-2 sayfa formal sözleşme + KVKK disclaimer

### Disclaimer (otomatik append)
```
*Bu sözleşme yapay zeka tarafından oluşturulmuş bir taslaktır.
Hukuki bağlayıcılık ve özel durumlarınız için bir avukatla görüşmeniz önerilir.
UPU Dev sözleşmenin hukuki uygunluğundan sorumlu değildir.*
```

### UI Flow Güncellendi
`/tr/sozlesme-yap` artık 5 state:
1. **loading** → init fetch
2. **select** → mülk + müşteri + parametre seç → "🤖 AI ile Sözleşme Üret"
3. **generating** → spinner (5-10s)
4. **preview** → metni göster + ✏️ Düzenle (textarea toggle) / 👁 Önizleme + ✅ Kaydet + ← Geri
5. **done** → imza linki + 📋 Kopyala + 💬 WA Paylaş

### contract_data JSONB Genişletildi
- `generated_text`: Claude'un ürettiği metin (+disclaimer)
- `edited`: kullanıcı manuel edit ettiyse true

### Hata Durumu
- ANTHROPIC_API_KEY yoksa → askClaude boş döner → 503 "AI üretim mevcut değil"
- Generic hata → 500 "lütfen tekrar deneyin"
- Kullanıcı state="select"e döner; parametreleri korur

### Maliyet
~2000 input + ~2000 output × Haiku rate ≈ cents-altı/sözleşme. Kullanıcı başına dakika başına 3 üretim limiti şu an UI tarafında implicit (state machine) — explicit rate limit gerekirse Redis sayaç eklenir.

### Replikasyon
6 SaaS doc-yap pattern'inde AI generation **standart**:
- Her SaaS'ın kendi system prompt'u (sektörel hukuki çerçeve)
- otel: rezervasyon onay sözleşmesi → KVKK + Tüketici Hakları
- market: tedarikçi sözleşmesi → TTK
- bayi: bayilik sözleşmesi → Rekabet Kurulu uyumlu
- restoran: catering anlaşması → Hijyen + KVKK
- doga: bağışçı/gönüllü sözleşmesi → Vakıf hukuku

Her tenant için aynı endpoint pattern (`/api/<saas>/sozlesme/generate`), aynı disclaimer pattern, aynı 5-state UI.
