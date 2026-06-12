# CYBERSEC AUDIT — Faz 5 Depo Modülü

> **Tarih:** 2026-06-12
> **Kapsam:** Faz 5'te eklenen 21 dosya (5 tablo migration, warehouse.ts choke-point, dispatcher event, AI tool, IndexedDB, 9 dağıtıcı + 2 bayi API route, 7 sayfa, nav)
> **Yöntem:** statik (grep/ast + 1 Explore sweep ajanı, bulguları spot-doğrulandı) + dinamik (canlı `retailai.upudev.nl`, test identity 31600000001 vs tenant 32f5feda, tek-login rate-limit'ten kaçınarak) + DB introspection (migration kaynağı + canlı insert/update probe).
> **Karar kuralı (brief):** Critical/High → SADECE raporla, otomatik fix YOK (onay sonrası). Medium/Low → fix önerisi yaz, Çağrı seçer. **Bu denetimde hiç kod değiştirilmedi.**

---

## Yönetici Özeti

**Multi-tenant izolasyon SAĞLAM** — denetimin en kritik ekseni. 4/4 cross-tenant saldırı denemesi canlıda reddedildi (404). 13/13 route auth-guard'lı, mass-assignment bloklu, 5 tabloda tenant_id NOT NULL + FK + RLS. Faz 1-4 hardening (H-01 BFLA, H-02 header, H-10 session revocation) depo'ya da miras geçiyor.

**Açık bulgular: 0 Critical · 1 High · 1 Medium · 5 Low/Info.**

En kritik bulgu güvenlik-izolasyon değil **veri bütünlüğü**: `applyStockChange` read-modify-write'ı atomik değil → eşzamanlı stok işlemlerinde **kayıp güncelleme**. Canlıda kanıtlandı: 10 paralel +10 mal kabul → stok 100 yerine **60** (40 kayıp). Cross-tenant değil ama envanter sayıları bozulabilir.

> **Not:** Static-sweep ajanı `warehouse.ts:72`'yi "CRITICAL tenant bypass" işaretledi — **yanlış**. Kanıt: `existing.id` satır 59'da `.eq("tenant_id", tenantId)` ile filtrelenmiş read'den geliyor, client-kontrollü değil; UPDATE yalnız kendi tenant satırını vurur. Cross-tenant yazma imkânsız. Aşağıda H-14 olarak Low/defense-in-depth'e indirildi.

---

## Bulgu Tablosu

| ID | Başlık | Severity | Lokasyon | Durum |
|----|--------|----------|----------|-------|
| **H-12** | applyStockChange race / kayıp güncelleme | **High** | `src/platform/bayi/warehouse.ts:56-80` | Kanıtlı (canlı) — onay bekler |
| **H-13** | Stok miktarı üst sınırı yok (NUMERIC overflow) | **Medium** | `mal-kabul:82`, `transfer:86`, `sayim/[id]:104`, `bayi/sayim/[id]:95` | Kanıtlı (canlı) |
| **H-14** | applyStockChange UPDATE'te explicit tenant_id yok | Low | `warehouse.ts:72` | Exploit YOK (defense-in-depth) |
| **H-15** | transfer'de product_id explicit tenant doğrulaması yok | Low | `transfer/route.ts:88-122` | Implicit korumalı |
| **H-16** | AI tool warehouse_id arg tenant'a doğrulanmıyor | Low | `warehouse-critical-stock.ts:53` | Sızıntı YOK (tenant filter) |
| **H-17** | Sayım kapatma status-check atomik değil (TOCTOU) | Low/Info | `sayim/[id]/kapat/route.ts:27-80` | İdempotent (kanıtlı) |
| **H-18** | IndexedDB sayım taslağı şifresiz | Low/Info | `src/lib/sayim-store.ts` | Düşük hassasiyet |

---

## Detaylı Bulgular

### H-12 — applyStockChange race condition / kayıp güncelleme — **High**

**Dosya:** `src/platform/bayi/warehouse.ts:56-80`
**Eksen:** 4 (race/concurrency) · OWASP A04 Insecure Design · CWE-362 (TOCTOU race) / CWE-667 (locking eksik)

`applyStockChange` klasik read-modify-write:
```
56  const { data: existing } = await sb.from("bayi_warehouse_stock").select("id, quantity")... // OKU
64  const current = existing ? Number(existing.quantity) : 0;
65  const warehouseQty = Math.max(0, current + delta);                                          // HESAPLA
69  await sb.from("bayi_warehouse_stock").update({ quantity: warehouseQty })...                 // YAZ
```
Transaction yok, satır kilidi (SELECT FOR UPDATE) yok, atomik increment yok. İki eşzamanlı çağrı aynı `current`'ı okur, biri diğerini ezer.

**Repro (canlı, kanıtlandı):** Aynı (depo, ürün) için **10 paralel** `POST /api/dagitici/depo/mal-kabul` (her biri +10) → beklenen 100, **gerçekleşen 60**. 40 birim kayıp güncelleme. (`scripts/sec-faz5-dynamic.mjs`)

**Etki:** Cross-tenant DEĞİL — yalnız çağıranın kendi tenant stoğu. Ama envanter bütünlüğü bozulur: eşzamanlı mal kabul/transfer/sayım-kapatma altında stok yanlış sayılır; B2B'de sipariş karşılama, fazla satış, finansal mutabakat etkilenir. Tüm mutasyon yolları (transfer iki bacağı, mal kabul, sayım düzeltme) bu choke-point'ten geçtiği için yüzey geniş.

**Fix önerisi (onay sonrası — High, otomatik fix yapılmadı):** Stok değişimini atomik tek SQL'e taşı. Postgres RPC fonksiyonu:
```sql
CREATE FUNCTION bayi_apply_stock(p_tenant uuid, p_wh uuid, p_prod uuid, p_delta numeric)
RETURNS numeric AS $$
  INSERT INTO bayi_warehouse_stock(tenant_id,warehouse_id,product_id,quantity)
  VALUES(p_tenant,p_wh,p_prod,GREATEST(0,p_delta))
  ON CONFLICT (warehouse_id,product_id)
  DO UPDATE SET quantity = GREATEST(0, bayi_warehouse_stock.quantity + p_delta),
                updated_at = now()
  RETURNING quantity;
$$ LANGUAGE sql;
```
`applyStockChange` bunu `sb.rpc(...)` ile çağırır (tek atomik UPSERT, kayıp güncelleme imkânsız). Ürün toplamı da `UPDATE ... SET stock_quantity = (SELECT SUM ...)` ile tek statement. Alternatif: pg advisory lock (`pg_advisory_xact_lock(hashtext(wh||prod))`).

---

### H-13 — Stok miktarı üst sınırı yok — **Medium**

**Dosya:** `mal-kabul/route.ts:82`, `transfer/route.ts:86`, `sayim/[id]/route.ts:104`, `bayi/sayim/[id]/route.ts:95`
**Eksen:** 3 (input validation) · OWASP A03/A04 · CWE-20 / CWE-1284

Tüm miktar girdileri `Math.floor(Number(...))` + alt sınır (≥1 veya ≥0) var ama **üst sınır yok**. NaN/Infinity `Math.floor` ile zararsızlaşıyor ancak devasa değerler geçiyor.

**Repro (canlı, kanıtlandı):** `POST /api/dagitici/depo/mal-kabul {quantity: 9999999999999}` → **200**, `warehouseQty=10000000000059`. NUMERIC(12,3) sınırını aşan / absürt stok. (Sipariş #H-03'teki aynı sınıf — orada düzeltildi, burada tekrar.)

**Etki:** Stok ekranları/raporları bozulur, toplam hesapları taşar, ileride NUMERIC overflow 500 üretebilir. Cross-tenant değil; DoS/veri-kalitesi.

**Fix önerisi (Medium):** Faz 4 H-03 ile simetrik: satır başına `MAX_QTY` (örn. 10_000_000) üstünü 400 reddet; `counted_qty`/`unit_cost` için de sınır. Tek satırlık guard her 4 endpoint'e.

---

### H-14 — applyStockChange UPDATE'te explicit tenant_id yok — **Low (exploit yok)**

**Dosya:** `src/platform/bayi/warehouse.ts:72`

`.update({...}).eq("id", existing.id)` — tenant_id filtresi yok. **Exploit edilemez:** `existing.id` satır 56-62'deki `.eq("tenant_id", tenantId)` filtreli read'den türetiliyor; client'ın id'yi seçme imkânı yok, UPDATE yalnız kendi tenant satırını vurur. Service-role RLS'i bypass ettiği için tek koruma kod filtresidir; id server-türevli olduğundan güvenli.

**Fix önerisi (Low, defense-in-depth):** `.eq("id", existing.id).eq("tenant_id", tenantId)` ekle — gelecekteki refactor'a karşı bariyer.

---

### H-15 — transfer product_id explicit tenant doğrulaması yok — **Low**

**Dosya:** `src/app/api/dagitici/depo/transfer/route.ts:88-122`

İki depo `.in([from,to]).eq("tenant_id")` ile doğrulanıyor; product_id explicit değil. **Implicit korumalı:** kaynak stok kontrolü `bayi_warehouse_stock ... eq(tenant_id) eq(product_id)` → foreign ürün çağıranın deposunda 0 stok → `available(0) < qty(≥1)` → 400. **Canlı kanıt:** `mal-kabul foreign product → 404` (mal-kabul explicit doğruluyor); transfer foreign ürünü stok-kontrolünde eler.

**Fix önerisi (Low):** transfer'e mal-kabul'deki gibi explicit `bayi_products eq(tenant_id) eq(id)` 404 kontrolü ekle — netlik + stok-kontrolü kaldırılırsa diye bariyer.

---

### H-16 — AI tool warehouse_id arg tenant'a doğrulanmıyor — **Low**

**Dosya:** `src/platform/agent/tools/bayi/warehouse-critical-stock.ts:53`

Opsiyonel `warehouse_id` arg'ı `.eq("warehouse_id", warehouseId)` ile filtreye giriyor ama tenant'a ait mi kontrol edilmiyor. **Sızıntı YOK:** sorgu ayrıca `.eq("tenant_id", ctx.tenantId)` (satır 51) içeriyor → başka tenant'ın warehouse_id'si verilse de o tenant'ın stok satırı dönmez (tenant filtresi keser). Tool salt-oku (insert/update/delete yok), `assertTenant` ile korunuyor, H-01 BFLA rol-clamp'i (yönetici read-only persona) miras.

**Fix önerisi (Low):** warehouse_id verilmişse `bayi_warehouses eq(tenant_id) eq(id)` doğrula, yoksa boş dön — kullanıcıya net + defense-in-depth.

---

### H-17 — Sayım kapatma status-check atomik değil — **Low/Info**

**Dosya:** `src/app/api/dagitici/depo/sayim/[id]/kapat/route.ts:27-80`

`status==='open'` kontrolü (satır 31) ile `status='closed'` yazımı (satır 76) arası atomik değil — TOCTOU penceresi. **Ama pratikte idempotent:** düzeltme `delta = sayılan − mevcut(taze oku)`; ikinci kapatma çalışırsa mevcut zaten sayılana eşit → delta=0 → hareket üretilmez. **Canlı kanıt:** 2 paralel `kapat` → her ikisi 200 ama yalnız **1** stocktake movement. Çift düzeltme oluşmadı.

**Fix önerisi (Low):** Atomik durum geçişi — `UPDATE bayi_stocktake_sessions SET status='closed' WHERE id=? AND tenant_id=? AND status='open' RETURNING id`; 0 satır dönerse "zaten kapalı" 409. Düzeltmeleri bu kazandıktan sonra uygula. (Mevcut delta-recompute zaten güvenli; bu tam-kuşatma.)

---

### H-18 — IndexedDB sayım taslağı şifresiz — **Low/Info**

**Dosya:** `src/lib/sayim-store.ts`

Sayılan adetler cihazda IndexedDB'de düz (şifresiz) duruyor. Hassasiyet düşük (tenant-lokal stok adetleri, PII/kimlik bilgisi yok), cihaz-lokal. Brief'in istediği "not düş" kapsamında. Aksiyon gerekmiyor; paylaşılan cihazda başka kullanıcı taslağı görebilir (operasyonel, güvenlik değil).

---

## Güvenli Çıkan Eksenler (kanıtlı PASS)

| Eksen | Sonuç | Kanıt |
|-------|-------|-------|
| **Multi-tenant izolasyon** | ✅ 4/4 reddedildi | Canlı: B-depo GET→404, transfer to_warehouse=B→404, sayım warehouse=B→404, mal-kabul foreign product→404 |
| **Auth (9 route, 13 handler)** | ✅ Tam | Her handler ilk satırda getDagiticiAuth/getBayiAuth; auth'suz→401 (canlı) |
| **Mass assignment** | ✅ Bloklu | Explicit whitelist; canlı: tenant_id/is_active/created_by enjekte→sunucu kendi tenantId'sini kullandı |
| **Şema** | ✅ | 5 tablo tenant_id NOT NULL + FK tenants ON DELETE CASCADE + RLS ENABLE + tenant_isolation policy (migration `20260612011857`) |
| **Veri sızıntısı (event)** | ✅ | Kritik stok eventi `resolveDistributorProfileId` ile yalnız kendi tenant dağıtıcısına; sendNotification tenant-scoped (H-09) |
| **AI tool** | ✅ Salt-oku + tenant-scoped | İki sorgu da `.eq("tenant_id", ctx.tenantId)`; insert/update/delete yok |
| **SQLi / XSS** | ✅ Yok | Barkod client-side string compare; product_id UUID; React auto-escape; depo route'larında string-interpolated filtre yok (tek `${}` hata mesajında) |
| **Service worker / manifest** | ✅ Yok | `find` → 0 sonuç; sayım sayfasında SW referansı yok (CLAUDE.md "PWA YOK" uyumlu) |
| **Hardening mirası (H-01/02/10)** | ✅ | Depo sayfasında X-Frame-Options+CSP (canlı); getDagiticiAuth/getBayiAuth H-10 sessions_revoked_at kontrolü taşıyor; AI tool H-01 rol-clamp'i (yönetici read-only) |

---

## Hardening Referans Kontrolü (H-01..H-11 → Faz 5)

| Fix | Faz 5'te durum |
|-----|----------------|
| H-01 (AI BFLA rol-clamp) | ✅ warehouse-critical-stock yönetici read-only persona'da; clamp uygulanır + tool zaten salt-oku |
| H-02 (güvenlik header'ları) | ✅ Global `next.config headers()` → depo sayfaları dahil (canlı doğrulandı) |
| H-03 (miktar validation) | ⚠️ **Faz 5'te tekrarladı** → H-13 (depo endpoint'lerinde üst sınır yine yok) |
| H-08/H-09 (tenant_id filter, notifications) | ✅ Tüm depo query'leri tenant-scoped; kritik stok bildirimi sendNotification (H-09 tenant_id) üzerinden |
| H-10 (session revocation) | ✅ getDagiticiAuth + getBayiAuth zaten sessions_revoked_at kontrol ediyor → depo route'ları miras |

---

## Test Artefaktları

`scripts/sec-faz5-dynamic.mjs` — cross-tenant (4), race (10× paralel), upper-bound, double-close probe'ları. Test verisi (B-depo sec-test, race ürünü) script sonunda temizlendi; race/bound testleri test tenant'ında (f5a92742) throwaway ürün üzerinde koştu, gerçek müşteri verisine dokunulmadı.

---

## Öneri Sırası

**Onay bekleyen (High):**
1. **H-12** — applyStockChange'i atomik RPC'ye taşı. Envanter bütünlüğü için en kritik; eşzamanlı kullanım arttıkça stok sapması büyür.

**Çağrı seçer (Medium/Low):**
2. **H-13** — 4 endpoint'e miktar üst sınırı (H-03 paterni). Hızlı, düşük risk.
3. **H-14/H-15/H-16** — defense-in-depth explicit tenant doğrulamaları (exploit yok, refactor bariyeri).
4. **H-17** — atomik sayım-kapatma durum geçişi (mevcut idempotent, tam-kuşatma).
5. **H-18** — bilgilendirme; aksiyon opsiyonel.
