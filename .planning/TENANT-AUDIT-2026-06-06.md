# TENANT ORPHAN + DEMO AUDIT — 2026-06-06

**Sebep:** Çağrı admin panel'i kontrol etti, 3 tutarsızlık buldu (Toplam Kullanıcı 4 vs liste 3, 5 bayi müşteri vs 2 kullanıcı, 6 SaaS'ta 1'er "müşteri" görünüyor ama 5'i kullanıcısız DEMO).

**Yöntem:** Service role REST query üzerinden 7 tablo, DEMO UUID'leri config'den (`src/tenants/config.ts`) referansa alındı. Salt okuma — DB modifiye edilmedi.

---

## Özet

| Metrik | Değer |
|---|---|
| Toplam tenant | **11** |
| DEMO tenant (config) | 7 |
| DEMO tenant (DB'de mevcut) | 7 (eksiksiz) |
| Gerçek/signup tenant | **4** (hepsi bayi) |
| Orphan tenant (profile-suz) | **8** — 5 DEMO + **3 signup** |
| Toplam profile | 5 |
| Profile (tenant_id NULL) | **1** |
| Multi-profile tenant | 1 (emlak DEMO) |

**Anahtar bulgular:**

- 5 bayi tenant şikâyetinin sebebi: 1 DEMO + 1 gerçek signup (Ruhi can) + **3 orphan signup** (profile yok).
- 6 SaaS'ta "1 müşteri" görüntüsü: market/muhasebe/otel/restoran/siteyonetim için profile-suz DEMO tenant'lar admin UI'da "müşteri" gibi sayılıyor.
- "Toplam Kullanıcı: 4" vs liste 3 mismatch'i: System Scraper profile'ı (`role='system'`) header'da sayılıyor, listede filtreleniyor.

---

## Tablo 1 — Tüm tenant'lar (11)

| id | saas_type | slug | name | created_at |
|---|---|---|---|---|
| `d84d7d1f-eb8b-4e95-9806-114909b513e8` | bayi | retailai-be550e18 | 56855556555888 Bayisi | 2026-06-05 10:24 |
| `32f5feda-700f-44c6-a270-5bbb5a040994` ▶ DEMO | bayi | retailai | Bayi Yönetimi | 2026-03-23 |
| `d943c070-4855-448a-8262-84b5b8aba5f2` | bayi | retailai-f163c8e6 | 556558965555 Bayisi | 2026-06-05 17:44 |
| `9c064abe-9971-4976-896a-8cfe7ec197ca` | bayi | retailai-b9451cc6 | 455874556555 Bayisi | 2026-06-05 15:48 |
| `b8fcf358-526d-4253-ae44-cd066b0e4580` | bayi | retailai-196889b1 | 5646658656868 Bayisi | 2026-06-05 13:45 |
| `3f3598fc-a93e-4c73-bd33-7c4217f6c089` ▶ DEMO | emlak | estateai | Emlak Ofisi | 2026-03-23 |
| `af1f27b0-2ec1-4423-9b93-2aa29979b73a` ▶ DEMO | market | marketai | Market Yönetimi | 2026-03-26 |
| `31a22a5a-cf38-48b5-914d-a67bde4c1e16` ▶ DEMO | muhasebe | accountai | Muhasebe Asistanı | 2026-03-23 |
| `16871326-afef-4ba3-a079-2c5ede8fac4d` ▶ DEMO | otel | hotelai | Otel Yönetimi | 2026-03-23 |
| `03f58dcb-b931-4dcf-bd47-a0885f9286e8` ▶ DEMO | restoran | restoranai | Restoran Asistanı | 2026-04-27 |
| `c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e` ▶ DEMO | siteyonetim | residenceai | Site Yönetimi | 2026-03-23 |

## Tablo 2 — Tüm profile'lar (5)

| id | tenant_id | phone | display_name | role | tenant_id_null |
|---|---|---|---|---|---|
| `93671f0e-…eadb` | emlak DEMO | – | System Scraper V3 | system | – |
| `b7f98e11-…ca06` | emlak DEMO | 905556422636 | Doğuş Can | admin | – |
| **`846a103e-…3618`** | **NULL** | **905066806262** | **Çağrı** | **admin** | ⚠️ |
| `e010961e-…9dd1` | bayi DEMO | 9100221790 | Test Admin 221790 | admin | – |
| `ac2f89e4-…20e1` | bayi signup (d943c070) | 556558965555 | Ruhi can | user | – |

## Tablo 3 — Orphan tenant'lar (profile-suz, 8 satır)

| id | saas_type | slug | created_at | DEMO mu? | Silmeye aday? |
|---|---|---|---|---|---|
| `d84d7d1f-eb8b-4e95-9806-114909b513e8` | bayi | retailai-be550e18 | 2026-06-05 10:24 | hayır | **✅ EVET** (signup orphan) |
| `9c064abe-9971-4976-896a-8cfe7ec197ca` | bayi | retailai-b9451cc6 | 2026-06-05 15:48 | hayır | **✅ EVET** (signup orphan) |
| `b8fcf358-526d-4253-ae44-cd066b0e4580` | bayi | retailai-196889b1 | 2026-06-05 13:45 | hayır | **✅ EVET** (signup orphan) |
| `af1f27b0-2ec1-4423-9b93-2aa29979b73a` | market | marketai | 2026-03-26 | EVET | ❌ DEMO (UI'da gizle, silme) |
| `31a22a5a-cf38-48b5-914d-a67bde4c1e16` | muhasebe | accountai | 2026-03-23 | EVET | ❌ DEMO (UI'da gizle, silme) |
| `16871326-afef-4ba3-a079-2c5ede8fac4d` | otel | hotelai | 2026-03-23 | EVET | ❌ DEMO (UI'da gizle, silme) |
| `03f58dcb-b931-4dcf-bd47-a0885f9286e8` | restoran | restoranai | 2026-04-27 | EVET | ❌ DEMO (UI'da gizle, silme) |
| `c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e` | siteyonetim | residenceai | 2026-03-23 | EVET | ❌ DEMO (UI'da gizle, silme) |

> **Cleanup adayı: 3 bayi signup orphan** (`d84d7d1f`, `9c064abe`, `b8fcf358`). Hepsi 2026-06-05 günü oluşmuş, hepsinde profile yok → muhtemelen rollback gap'ten kaynaklı (KATMAN B'ye bakın).

## Tablo 4 — DEMO ↔ DB karşılaştırma

| saas_type | config tenantId | DB'de? |
|---|---|---|
| emlak | `3f3598fc-…089` | ✓ |
| bayi | `32f5feda-…994` | ✓ |
| muhasebe | `31a22a5a-…e16` | ✓ |
| otel | `16871326-…c4d` | ✓ |
| siteyonetim | `c12010c7-…82e` | ✓ |
| market | `af1f27b0-…b73a` | ✓ |
| restoran | `03f58dcb-…6e8` | ✓ |

7 DEMO eksiksiz, fazlası yok.

## Tablo 5 — Profile tenant_id NULL (1 satır)

| id | phone | display_name | role | created_at |
|---|---|---|---|---|
| `846a103e-…3618` | 905066806262 | **Çağrı** | admin | 2026-05-29 22:19 |

> Çağrı'nın admin profile'ı tenant'a bağlı değil. Bu profile admin panel kullanıcı listesinde tenant filter (`.in("tenant_id", tenantIds)`) yüzünden **görünmüyor**. "4 vs 3" mismatch'inin **2. yarısı** burada (Tablo 7'ye bakın).
>
> **Karar:** Profile silme/değiştirme Çağrı kararı (CLAUDE.md "Never modify user data"). Adım önerisi: tenant_id'yi `emlak DEMO`'ya bağla VEYA `super_admin` rolü için tenant'sız davranışı resmi yap.

## Tablo 6 — Multi-profile tenant'lar (1 satır)

| tenant_id | profile_count | notlar |
|---|---|---|
| `3f3598fc-…089` (emlak DEMO) | 2 | System Scraper V3 + Doğuş Can |

## Tablo 7 — "Toplam Kullanıcı 4 vs Liste 3" kök sebep

**API `/api/admin/stats` `totalUsers`:**

```ts
// src/app/api/admin/stats/route.ts:30
for (const u of userCounts) {
  if (u.tenant_id) {        // sadece tenant_id NOT NULL
    total++;                // role filter YOK
  }
}
```

→ Çağrı'yı (tenant_id NULL) atlar, System Scraper'ı sayar → **4** (System + Doğuş + Test Admin + Ruhi).

**UI tablo başlığı (`admin/page.tsx:278`):**

```tsx
stats.users.filter(u => u.role !== 'system' && u.tenant_id !== null).length
```

→ Hem System Scraper'ı hem Çağrı'yı atlar → **3** (Doğuş + Test Admin + Ruhi).

**Fark = 1 satır = System Scraper V3** (header tarafından sayılan, tablo tarafından filtrelenen).

**Fix önerisi:** API `totalUsers` da `role !== 'system'` filter eklemeli. Çağrı'nın tenant_id-NULL profile'ı için ayrı bir uyarı/sayım önerilir (orphan admin sayacı).

---

## Per-SaaS müşteri sayısı (gerçek vs DEMO)

| saas_type | DB tenant adedi | DEMO | Gerçek (signup) | Profile-li gerçek |
|---|---|---|---|---|
| bayi | 5 | 1 | **4** | 1 (Ruhi can) |
| emlak | 1 | 1 | 0 | – (DEMO'da 2 admin) |
| market | 1 | 1 | 0 | – |
| muhasebe | 1 | 1 | 0 | – |
| otel | 1 | 1 | 0 | – |
| restoran | 1 | 1 | 0 | – |
| siteyonetim | 1 | 1 | 0 | – |

UI'da "5 bayi müşteri" demek yerine "**4 gerçek + 1 demo**" demeli; cleanup sonrası "**1 gerçek + 1 demo**".

---

## KATMAN B — verify signup rollback boşlukları

Mevcut akış (`src/app/api/auth/otp/verify/route.ts:170-224`):

| Adım | Mevcut rollback | Durum |
|---|---|---|
| 2. `createTenantForSignup` | Yok — bu adım fail ise hiçbir şey yaratılmamış | OK |
| 3. `auth.admin.createUser` | `tenants.delete()` (line 193) | OK |
| 4. `profiles.insert` | `auth.user.delete()` + `tenants.delete()` (213-215) | OK |
| 5. `attachSessionToResponse` | **Yok** — throw olursa tenant + auth.user + profile orphan | ⚠️ Gap |
| **Outer try/catch** | **Yok** | ⚠️ Gap — herhangi bir adım `throw` ederse rollback atlanır |

**Etki:** Tablo 3'teki 3 bayi orphan'ın muhtemel sebebi — `createUser` veya `profiles.insert` `throw` ettiğinde rollback satırına ulaşılmadı. Tenant ortada kaldı.

**Önerilen düzeltme (KATMAN B commit):**
- Tüm signup bloğunu outer `try/catch`'e sar.
- `createdTenantId` + `createdAuthUserId` değişkenlerini track et.
- `catch`: `createdAuthUserId` varsa `deleteUser`, `createdTenantId` varsa `tenants.delete`.
- Step 5 (`attachSessionToResponse`) da try kapsamında olmalı.

**Auto-cleanup cron (opsiyonel, Çağrı onayı):**
- `src/app/api/cron/cleanup-orphan-tenants/route.ts` — saatlik
- `WHERE created_at < now() - interval '10 minutes' AND id NOT IN (SELECT tenant_id FROM profiles WHERE tenant_id IS NOT NULL)`
- DEMO 7 UUID hard-exclude
- Vercel Hobby cron limiti gözet (memory: kalan cron slot sayısını kontrol et — şu an `vercel.json`'da kaç cron var?)

---

## KATMAN C — UI fix önerisi

**C2 — admin panel page.tsx + stats API:**

1. Header "Toplam Kullanıcı" (`stats.totalUsers`): backend filter `role !== 'system' AND tenant_id IS NOT NULL` → değer **3**. Tablo başlığı ile aynı sonuca gelir.
2. "Tenant_id NULL admin" için ayrı stat card: **"Atanmamış admin: 1"** (Çağrı) → görünür yap, yok say-ma.
3. "Toplam Müşteri" stat card: ayrı **"Gerçek Müşteri: 4 / Demo: 7"** veya **"4 müşteri (+ 7 demo)"**.
4. SaaS kategori kartı (`/admin/saas/[key]`): tenant listesinde DEMO satırı için **"DEMO" rozeti** + ayrı sayı.

**C3 — `/api/admin/stats` değişiklikleri:**

- `totalUsers`: filter eklendi (sistem hariç + tenant_id non-null).
- Yeni alan `orphanAdmins`: `tenant_id IS NULL AND role IN ('admin','super_admin')` sayısı.
- Yeni alan `demoTenantIds`: config'ten 7 UUID (UI DEMO badge için).
- Per-tenant `is_demo: boolean` bayrağı (enriched response).

---

## Önerilen sıra (KATMAN 2)

1. **KATMAN A doc commit** (bu dosya) — Çağrı raporu okuduktan sonra.
2. **C1 cleanup commit** — 3 bayi signup orphan sil (`d84d7d1f`, `9c064abe`, `b8fcf358`). Çağrı onayı şart.
3. **B commit** — signup outer try/catch + rollback hardening. Opsiyonel cron ayrı commit.
4. **C2 + C3 commit** — stats API + admin page UI fix.

---

## Çağrı'nın profile'ı hakkında

`846a103e-…3618` Çağrı admin profile tenant_id NULL. Bu tek başına bir bug değil ama UI tutarsızlığının kaynağı. **Karar Çağrı'nın:**
- A) Profile'ı emlak DEMO'ya bağla (`tenant_id = 3f3598fc-…`) → tek satır UPDATE.
- B) `super_admin` rolü için tenant'sız davranışı resmi yap, UI'da ayrı sayım.
- C) Hiçbir şey yapma, sadece UI'da "Atanmamış admin: 1" göster.

Bu KATMAN A audit'i ile karar verilecek — KATMAN 2'de C2'ye nasıl yansıtacağımı belirleyecek.
