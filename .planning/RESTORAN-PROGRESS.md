# UPU Restoran — 3 Sprint Progress

**Toplam:** 45-65h, ~4-6 hafta. **Onay tarihi:** 2026-05-27 (Çağrı).

## Sprint Durumları

| Sprint | Kapsam | Tahmin | Durum |
|---|---|---|---|
| 1 | Banking style port (8 sayfa) | 10-15h | ✅ **TAMAM** — commit `cbe7731` |
| 2 | B2C public sipariş sitesi | ~37h | ✅ **TAMAM** — 2026-05-27 (C1-C12 atomik commit) |
| 3 | QR menü + masa entegrasyonu | ~14-20h | ⏳ Sprint 2 sonrası başlanacak |

---

## Onaylanan Kararlar (Sprint 2 için)

1. **Mollie scope: Platform tek-hesap MVP**
   - UPU'nun Mollie hesabına ödemeler düşer
   - Restoran'a haftalık SEPA transfer (manuel)
   - Disclaimer ekran ve ToS şart
   - V2: Mollie Connect'e geçilebilir

2. **Order tablosu: Yeni `rst_b2c_orders`** (önerilen)
   - Internal POS (`rst_orders`, WA komutları) ile public web sipariş (`rst_b2c_orders`) net ayrılır
   - Brifing query'leri her ikisini UNION ile birleştirir
   - RLS politikaları temiz

3. **Real-time: Supabase Realtime** (önerilen)
   - Native WebSocket, mobile pil dostu, auto-reconnect
   - Ek maliyet yok (Supabase zaten var)

---

## Sprint 2 — Atomik Commit Sırası (✅ HEPSİ TAMAM)

- [x] **C1** `b05fe1d` — DB migration (5 yeni tablo + 2 ALTER, RLS, Realtime publication)
- [x] **C2** `3e56d29` — Mollie one-off payment helper (`src/platform/mollie/restoran-payments.ts`)
- [x] **C3** `ea7c92c` — Public `/r/{slug}` routing + slug resolver + opening hours parse
- [x] **C4** `812ba38` — `/r/{slug}` anasayfa (hero + status + CTA + featured + delivery zones)
- [x] **C5** `e99f067` — `/r/{slug}/menu` + item modal (varyant/addon/notes/quantity) + cart context (localStorage)
- [x] **C6** `10eda5b` — `/r/{slug}/sepet` (cart edit + delivery form + payment + submit)
- [x] **C7** `c835148` — `POST /api/r/[slug]/orders` (server-side fiyat doğrulama) + `mollie-webhook` (idempotent)
- [x] **C8** `ee1233f` — `/r/{slug}/siparis/{id}` tracking + Supabase Realtime canlı status
- [x] **C9** `64a3aa8` — profile save → rst_restaurants upsert (slug üretim + demo data link)
- [x] **C10** `9c1a87a` — Panel B2C realtime notification (hook + banner + sound + native Notification)
- [x] **C11** `ac066b0` — Panel /restoran-siparisler sayfası + status update API + WA "hazır" mesajı
- [x] **C12** TypeScript check PASS (tsc --noEmit 0 error), Vercel deploy LIVE

## Sprint 2 Doğrulama

- ✅ `npx tsc --noEmit` exit 0 (0 lines stdout)
- ✅ Vercel deploy: `https://restoranai.upudev.nl/api/r/lokanta-test/orders` → 404 "Restoran bulunamadı" (endpoint live)
- ✅ Public site: `/tr/r/test-slug-yok` → 404 with proper "Restoran bulunamadı — UPU" metadata
- ✅ Mevcut WA komutları + form akışları + auth DOKUNULMADI (intact)
- ✅ Internal rst_orders (POS) DOKUNULMADI — public rst_b2c_orders ayrı tablo
- ✅ Restoran tenant'ları için sadece restoran scope dışına çıkılmadı

## Sprint 2 Bilinen Sınırlar (V2 follow-up)

- ⚠️ `/sounds/new-order.mp3` placeholder yok — sessiz çalar (audio.play() catch'le yutulur)
- ⚠️ rst_menu_categories tablosu var ama demo seed kullanmıyor (V2: kategori objesi seed et)
- ⚠️ Restoran sahibi panelden brand_name/colors/logo/opening_hours düzenleyemez (V2 admin UI)
- ⚠️ Tek delivery zone destekleniyor (postal-code match yerine ilk zone fee)
- ⚠️ Platform-tek Mollie hesabı (V2: Mollie Connect split payment)
- ⚠️ Müşteri sipariş takip için cookie ile order ID kaydedilmiyor — link paylaşırlarsa görünür

---

## Sprint 3 — Referans: Butlaroo (Hollanda QR menü)

Çağrı 2026-05-27 Butlaroo (@butlaroo Instagram) örneğini referans olarak gönderdi.
Sprint 3'te (QR menü + masa) bu özellikleri entegre et:

### Eklenmesi gereken özellikler

1. **🌍 ÇOKLU DİL (kritik)**
   - QR menü sayfasında üstte bayrak seçici: NL/EN/TR/FR/DE/IT
   - Tenant ayarlarından hangi dillerin aktif olduğu seçilir (ör. sadece TR+NL+EN)
   - `rst_restaurants.enabled_languages text[]` + `rst_menu_items.translations jsonb` `{ "en": {name, desc}, "nl": {...} }`
   - Default dil: tenant'ın `default_locale` (restoran tipik tr-NL ya da nl-NL)
   - Müşteri seçimi localStorage'da hatırlanır

2. **🔌 POS ENTEGRASYON LOGO STRIP (UI ilham, V2 işlevsel)**
   - Butlaroo Lightspeed/unTill/MplusKASSA/Bork Horeca/Oracle Micros Simphony gösteriyor
   - **MVP: ASLA GERÇEK ENTEGRASYON YOK** (Çağrı: "POS gerçek değil, demo")
   - Mimari hazırlığı: `src/platform/pos/POSProvider.ts` interface — `pushOrder(orderId)`, `pullMenu()`, `syncTable(id, status)`
   - MVP'de tek implementation: `NoopPOSProvider` (DB'ye yazar, dış sistem çağırmaz)
   - V2: gerçek `LightspeedPOSProvider`, `UntillPOSProvider` vb. eklenir
   - Public satış sayfası logoları "yakında entegrasyon" olarak gösterilebilir (admin satış için)

3. **🛎 GARSON ÇAĞIR + 💳 HESAP İSTE (zaten planda)**
   - QR menü sayfasında üst-orta 2 büyük buton (Butlaroo'da öne çıkan UX)
   - Sprint 3 B.3 + B.4 planda mevcut, sadece UX'i bu pattern'e göre yerleştir
   - Floating bottom değil, **top-of-page sticky** 2 button (Butlaroo paterni)

4. **🎯 UPSELL (yeni ekleme — Sprint 3'e dahil)**
   - Sepete kalem eklenince modal: "Bunu da denemek ister misiniz?"
   - 2 yaklaşım:
     - **MVP**: Admin manuel — her menu_item için `recommended_items uuid[]` (`rst_menu_items.upsell_ids`)
     - **V2**: Algoritma — "sık birlikte alınan" (son N siparişe bakar, beraber sipariş edilenleri sayar)
   - Butlaroo "+20% upsell" gururla pazarlıyor — UPU restoran satış sayfasında benzer mesaj

5. **💬 SAMIMI MENÜ HEADER (yeni)**
   - Butlaroo "Hey you, have a beautiful day" tarzı marka kişiliği
   - `rst_restaurants.menu_greeting text` ("Hoş geldin sevgili müdavim!" / "Bugün iyi bir gün, deneyimi tatlandır!" vb.)
   - QR menü sayfası üstünde restaurant.menu_greeting göster (varsa)
   - Saate göre değişen versiyonu (sabah/öğle/akşam) V2

6. **🎬 "60 SANIYEDE DENE" CTA (UPU satış sayfası ilham)**
   - Butlaroo landing page satış mesajı
   - UPU restoran satış sayfası için (Sprint dışı ama referans)
   - "60 saniyede menünüzü QR'a dönüştürün" benzeri kısa demo

### Sprint 3 atomik commit planı (revize)

- [ ] **D1** — DB: `rst_menu_items.translations jsonb`, `rst_menu_items.upsell_ids uuid[]`, `rst_restaurants.enabled_languages text[]`, `rst_restaurants.menu_greeting text`
- [ ] **D2** — QR PNG endpoint + admin "QR İndir" buton
- [ ] **D3** — `/r/{slug}/m/{qr_token}` entry + localStorage table context
- [ ] **D4** — Menü sayfası masa-aware modifikasyon (üst 2 buton: garson çağır + hesap iste)
- [ ] **D5** — Çoklu dil bayrak seçici + translations resolver
- [ ] **D6** — Garson çağır + hesap iste API + panel realtime badge
- [ ] **D7** — Upsell modal (sepete ekleme sonrası "öneri" göster)
- [ ] **D8** — Menu greeting + samimi header
- [ ] **D9** — POSProvider interface (NoopPOSProvider implementation) — gelecek için iskelet
- [ ] **D10** — Final test + fiziksel QR print test

---

## Tahmin Güncellemesi

**Sprint 3 revize:** 14h → 18-22h (Butlaroo özellikleriyle)
- Çoklu dil: +3h
- Upsell modal + DB schema: +2h
- Samimi header + branding: +1h
- POSProvider interface (iskelet): +1h
- (Garson çağır + hesap iste zaten planda)

**Toplam (revize):** 1 (15h) + 2 (37h) + 3 (~20h) = **~72h**

---

## Notlar

- **Production data koruma**: Her migration `IF NOT EXISTS` + additive. Drop yok.
- **Magic link auth**: Sprint 2+3 admin panel akışları mevcut auth ile çalışır
- **Public bypass**: `/r/{slug}/*` middleware'de auth bypass — sadece `is_published=true` restoranlar 200, gerisi 404
- **WhatsApp gateway**: B2C'den gelen sipariş "siparişiniz hazır" mesajını WA Cloud API ile gönderir (mevcut altyapı)
