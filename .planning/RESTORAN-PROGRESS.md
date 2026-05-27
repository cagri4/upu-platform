# UPU Restoran — 3 Sprint Progress

**Toplam:** 45-65h, ~4-6 hafta. **Onay tarihi:** 2026-05-27 (Çağrı).

## Sprint Durumları

| Sprint | Kapsam | Tahmin | Durum |
|---|---|---|---|
| 1 | Banking style port (8 sayfa) | 10-15h | ✅ **TAMAM** — commit `cbe7731` |
| 2 | B2C public sipariş sitesi | ~37h | 🔄 **BAŞLADI** — 2026-05-27 |
| 3 | QR menü + masa entegrasyonu | ~14h | ⏳ Sprint 2 sonrası |

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

## Sprint 2 — Atomik Commit Sırası

- [ ] **C1** — DB migration (rst_restaurants, rst_menu_variants, rst_menu_addons, rst_b2c_orders, rst_table_calls + ALTER mevcut)
- [ ] **C2** — Mollie SDK + env + helpers (`src/platform/mollie/*`)
- [ ] **C3** — Public routing: middleware bypass `/r/*`, slug resolver
- [ ] **C4** — `/r/{slug}` anasayfa
- [ ] **C5** — `/r/{slug}/menu` + item modal (varyant/addon)
- [ ] **C6** — `/r/{slug}/sepet` + cart state + delivery form
- [ ] **C7** — `POST /api/r/[slug]/orders` + Mollie payment create + webhook
- [ ] **C8** — `/r/{slug}/siparis/{id}` + order tracking page
- [ ] **C9** — White-label CSS var + brand color/logo apply
- [ ] **C10** — Supabase Realtime panel order notification
- [ ] **C11** — WA "siparişiniz hazır" trigger
- [ ] **C12** — Final polish + bugfix + Lighthouse

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
