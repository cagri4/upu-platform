# Cybersec Denetimi — Faz 6 (Saha Satış) + Faz 7 (Satın Alma)

**Tarih:** 2026-06-13
**Kapsam:** Faz 6 saha satış + Faz 7 satın alma için eklenen tüm yeni API route'ları, data erişim katmanı, DB tabloları + RLS. Faz 5 audit disiplini (H-12..H-18) devamı → bulgular **H-19'dan** numaralandı.
**Yöntem:** İki bağımsız adversarial statik tarama (Opus subagent) + her bulgunun elle doğrulanması (false-positive eleme) + canlı dinamik istismar testi.

---

## Özet

| | |
|---|---|
| Toplam bulgu | **5** (1 High, 1 Medium, 3 Low/Info) |
| Düzeltilen | **4** (H-19, H-20, H-21, H-22) |
| Raporlanan (fix yok) | **1** (H-23 — risk constraint'lerle sınırlı) |
| Build / lint | ✅ TSC 0, lint temiz |
| Dinamik güvenlik testi | ✅ **7/7** (`sec-faz67-dynamic.mjs`) |
| Regresyon | ✅ Faz 6 E2E 14/14, Faz 7 E2E 13/13 |

**AI Eleman ekseni (BFLA via AI):** Faz 6/7 yeni agent tool'u EKLEMEDİ (grep doğrulandı) → bu eksen N/A.

---

## Bulgular

### H-19 — Mal kabulde over-receive / stok şişirme yarışı (HIGH) ✅ FIXED
**Dosya:** `src/app/api/dagitici/satinalma/[id]/mal-kabul/route.ts` (eski :93-117)

**Kök neden:** `received_qty` JS read-modify-write ile güncelleniyordu — satır snapshot'tan okunup `received_qty = line.received_qty + toReceive` yazılıyordu. `applyStockChange` (Faz 5 atomik RPC) stok artışını atomik yapsa da, üst-sınır (remaining) **bayat snapshot'a** göre hesaplanıyordu.

**İstismar:** Saldırgan kendi tenant'ında `sent`/`partial` bir PO için aynı satıra **eşzamanlı N istek** atar (basit `Promise.all` yeterli). Her istek `received_qty=0` okur, `toReceive=100` hesaplar, her biri atomik `applyStockChange(+100)` çağırır → **stok PO miktarının N katı şişer** (bedava envanter + unit_cost ile maliyet muhasebesi bozulur). `received_qty` absolute-write olduğu için 100'de kalır, şişme gizlenir.

**Kanıt (dinamik test, düzeltme öncesi davranış):** 10× eşzamanlı mal kabul × 100 → stok +1000 olurdu.

**Fix:** `bayi_receive_po_line` atomik RPC (`migrations/20260613083500` + ambiguity düzeltmesi `20260613085600`):
- Satırı `FOR UPDATE` ile kilitler (eşzamanlı mal kabulleri serileştirir).
- `received_qty = LEAST(quantity, received_qty + recv)` → asla quantity'yi aşmaz.
- **Gerçekten uygulanan delta**'yı döner; route yalnız o delta kadar `applyStockChange` çağırır.
- **İdempotent:** tekrar gelen istek `received_qty` zaten quantity'de → applied=0 → stok değişmez.

**Doğrulama:** 10× eşzamanlı → stok tam **+100** (over-receive yok), `received_qty=100` (≤quantity), PO `received`, tekrar mal kabul → stok değişmez. ✅

---

### H-20 — PO durumu bayat snapshot'tan hesaplanıyor (LOW) ✅ FIXED
**Dosya:** aynı route (eski :126-129)

`fullyReceived`/`anyReceived` lokal `lineMap` snapshot'ından hesaplanıyordu; eşzamanlı kısmi mal kabullerde DB gerçeğiyle çelişebilirdi. **Fix:** durum artık tüm satırlar **DB'den taze okunarak** hesaplanıyor → tutarlı. (H-19 fix'inin parçası.)

---

### H-21 — Atama kaldırıldıktan sonra eski ziyaret üzerinden sipariş (MEDIUM) ✅ FIXED
**Dosya:** `src/app/api/saha/visits/[id]/order/route.ts` (:37-46)

**Kök neden:** Sipariş endpoint'i yalnız ziyaret sahipliğini (tenant + sales_rep) doğruluyor, bayinin **hâlâ** bu elemana atanmış olduğunu kontrol etmiyordu. Check-in atamayı doğruluyor ama ziyaret kaydı kalıcı.

**İstismar:** Eleman bayi X'e check-in yapar (atama geçerli). Dağıtıcı sonradan X'i bu elemandan kaldırır (eleman ayrıldı vb.). Eski `bayi_visits` satırı durur → eleman o ziyaret üzerinden hâlâ gerçek sipariş (`bayi_orders`, bildirim eventi) oluşturabilir. Tenant-içi ama bayat yetki.

**Fix:** Sipariş öncesi `bayi_sales_rep_dealers` taze kontrolü → atama yoksa **403**.

**Doğrulama:** check-in → admin de-assign → sipariş denemesi → **403**. ✅

---

### H-22 — Check-in client_uuid TOCTOU: graceful dedup yerine 400 (LOW) ✅ FIXED
**Dosya:** `src/app/api/saha/visits/route.ts` (:142-175)

`client_uuid` dedupe SELECT-then-INSERT idi. `UNIQUE(tenant_id, client_uuid)` çift satırı **zaten engelliyordu** (veri bütünlüğü riski YOK), ama eşzamanlı offline senkronda ikinci istek `23505` → generic `400` dönüyordu (modülün asıl amacı olan offline-retry senaryosunda işlevsel kusur). **Fix:** insert `23505` hatasında mevcut satır re-select edilip `{deduped:true}` dönülür. Düşük risk + ucuz + offline çekirdek özelliğini düzeltir.

---

### H-23 — provision-rep telefon TOCTOU (INFO) — RAPOR ONLY
**Dosya:** `src/platform/bayi/saha/provision-rep.ts` (:39-52)

Global telefon SELECT → create yarışı. **Cross-tenant hesap ele geçirme YOK:** başka tenant'ın telefonu SELECT'te yakalanıp `phone_taken` reddediliyor; `tenantId` saldırgan kontrolünde değil (getDagiticiAuth'tan). `bayi_sales_reps` `UNIQUE(tenant_id, phone)` rep satırını koruyor. En kötü ihtimal: yeni telefonda yarışan iki provision → mükerrer placeholder profil (takeover değil).
**Öneri (uygulanmadı — prod veri riski):** `profiles.whatsapp_phone` üzerinde partial unique index doğrula/ekle. Mevcut veride duplicate olabileceği için körlemesine eklenmedi; ayrı doğrulama gerektirir.

---

## Temiz Bulunan Eksenler (kanıtla)

- **IDOR/BOLA:** Tüm `[id]` erişimleri `.eq("tenant_id", tenantId)` (+ saha portalında `.eq("sales_rep_id", salesRepId)`) ile zincirli. Cross-tenant `[id]` probu 404. PO list `supplier_id` filtresi zorunlu tenant filtresinin ÜSTÜNE eklenir (sızma yok).
- **BFLA:** Her route/metot ilk satır `getDagiticiAuth`/`getSahaAuth` + `if ("error" in auth) return`. `getSahaAuth` portalı çift yönlü sınırlıyor (dağıtıcı admin → 403 saha; saha eleman role='employee' → dağıtıcı allowlist'inde değil).
- **Multi-tenant izolasyon:** Faz 6/7 tüm yeni tablolar `tenant_id NOT NULL` + FK CASCADE + RLS `tenant_isolation` (Faz 5 paterni).
- **Input validation:** miktar `floor`+`isFinite`+`≥1`+`≤MAX_STOCK_QTY`; fiyat `≥0`+`≤MAX_UNIT_COST`; ödeme `>0`+`≤MAX`; GPS enlem/boylam sınırı; tarih/saat regex; `payment_term_days` 0..3650 clamp.
- **Mass assignment:** Tüm insert/update açık alan whitelist'i. `tenant_id`/`status`/`received_qty`/`price`/`created_by`/`sales_rep_id` server-derived — body'den enjekte edilemez. PATCH gövdeleri sıkı whitelist.
- **Fiyat manipülasyonu:** saha siparişinde `unit_price` daima `resolveDealerPrice` (server, tenant+dealer scoped) — body'den fiyat gelmez.

---

## Commit'ler
- `b263edc` — H-19/20/21/22 kod fix + atomik RPC v1 + güvenlik testi
- `128c19b` — H-19 RPC ambiguity düzeltmesi (unit_price)

## Doğrulama
- `scripts/sec-faz67-dynamic.mjs`: **7/7** (H-19 race + idempotent, H-21 403).
- Regresyon: Faz 6 E2E **14/14**, Faz 7 E2E **13/13**.
- TSC 0, lint temiz.
