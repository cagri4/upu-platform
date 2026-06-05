# AUTH/SESSION FEDERATED IDENTITY AUDIT — 2026-06-05

**Bağlam:** Auth/Session Konsolidasyon Sprint'i C5a katmanı. Aşama 1 (A–D) bayi/otel/restoran panel init'lerine `saas_type` guard + cookie-fast-path ekledi. Bu rapor, **cookie cross-subdomain federation** davranışını ve geriye kalan kapsam boşluklarını dökümante eder.

**Yöntem:** Dev sunucu + canlı curl probe (4 endpoint, 5 case) + statik kod incelemesi.

---

## Cookie Federation Modeli

`src/platform/auth/session.ts:85` — `getCookieDomain()` prod'da `.upudev.nl` döner. Yani:

- `bayi.upudev.nl` → `upu_session` cookie set
- Aynı cookie `emlak.upudev.nl`, `otel.upudev.nl`, `adminpanel.upudev.nl` vd. tüm `.upudev.nl` subdomain'lerine **otomatik gönderilir**.
- **Tek auth boundary** = endpoint-level guard (saas_type filtreli profile lookup veya admin role check).

**Karar:** Cookie federation kasıtlı (SSO UX). Federation güvenliği `requireAuth + saas_type guard` bileşiminden gelir. Bir endpoint guard atlarsa cross-saas leak gerçek olur.

---

## Canlı Probe Sonuçları

| # | Endpoint | İstek | Beklenen | Gözlenen |
|---|---|---|---|---|
| 1 | GET /api/bayi-panel/init | no cookie, no token | 401 | **401** `{"error":"Oturum bulunamadı."}` |
| 2 | GET /api/otel-panel/init | no cookie, no token | 401 | **401** `{"error":"Oturum bulunamadı."}` |
| 3 | GET /api/restoran-panel/init | no cookie, no token | 401 | **401** `{"error":"Oturum bulunamadı."}` |
| 4 | GET /api/admin/users | no cookie | 401 | **401** `{"error":"Oturum bulunamadı."}` |
| 5 | GET /api/bayi-panel/init | garbage JWT cookie | 401 | **401** (verifySession reject) |

**Sonuç:** 401 yolu sağlam. Kötü/eksik kimlik tüm SaaS panel init'lerinde reddediliyor.

---

## Statik Kapsam Boşlukları (Aşama 1 Sonrası Kalan)

### Bulgu F1 — `/api/market/init` cookie-fast-path eksik *(kritik)*

`src/app/api/market/init/route.ts:14` hâlâ eski pattern'de:

```ts
if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
```

Etki: Market panel kullanıcısı sidebar nav'dan herhangi bir route'a tıklayınca cookie session olmasına rağmen 400 alır (Aşama 1 öncesi bayi-panel/init bug'ı ile birebir aynı). Aşama 1D scope bayi/otel/restoran ile sınırlıydı; market atlanmış. Ek olarak `eq("id", magicToken.user_id).single()` → composite `or(id, auth_user_id)` lookup yok, multi-tenant profilde 0 satır riski.

**Aksiyon:** Ayrı küçük sprint'te bayi-panel/init pattern'i market/init'e taşı (composite lookup + saas_type guard dahil).

### Bulgu F2 — `/api/panel/init` (emlak) saas_type guard'sız

`src/app/api/panel/init/route.ts:38`:

```ts
.from("profiles")
.select("display_name, tenant_id, metadata")
.eq("id", userId)
.single();
```

Cookie session'lı bir kullanıcı emlak panel domain'ine giderse (cookie `.upudev.nl` ile otomatik gider) profile fetch eder ve `tenantId` döner. **Saas_type filtresi yok** → bayi kullanıcısının emlak panel init'i 200 dönmesi mümkün.

UX katmanında URL panel ayrımı (bayi.upudev.nl → bayi panel route) görece koruma sağlasa da API katmanında federation boundary kırık.

**Aksiyon:** `panel/init` route'una `getAllTenantIdsForSaas(sb, "emlak")` + `.in("tenant_id", tenantIds)` guard eklenmeli. Bulgu F1 ile aynı sprint'te ele alınabilir.

### Bulgu F3 — Muhasebe SaaS init endpoint yok

`src/app/api/muhasebe-panel/` altında sadece `evergreen/` var; `init/` yok. Henüz launch olmamış veya `/api/panel/init` üzerinden çalışıyor (F2 kapsamında).

**Aksiyon:** Muhasebe panel launch öncesi dedicated init endpoint (bayi-panel/init pattern) eklenecek. Şu an dormant, blocker değil.

---

## Aşama 1 Sonrası Federation Skoru

| SaaS | Init Endpoint | saas_type Guard | Cookie-Fast-Path | Durum |
|---|---|---|---|---|
| emlak | `/api/panel/init` | ❌ (F2) | ✅ | **Boşluk** |
| bayi | `/api/bayi-panel/init` | ✅ Aşama 1B | ✅ Aşama 1D | OK |
| otel | `/api/otel-panel/init` | – (composite OR yeter) | ✅ Aşama 1D | OK |
| restoran | `/api/restoran-panel/init` | – (composite OR yeter) | ✅ Aşama 1D | OK |
| market | `/api/market/init` | ❌ (F1) | ❌ (F1) | **Boşluk** |
| siteyonetim | `/api/site/init` | ✅ resolveTenantProfile | ✅ resolvePanelAuth | OK |
| muhasebe | yok | – | – | **Dormant (F3)** |

---

## Tavsiye Edilen Sonraki Sprint

**Federated boundary tamamlama (3 commit):**

1. `panel/init` (emlak) — saas_type guard ekle (F2).
2. `market/init` — bayi-panel/init pattern uygula (F1).
3. Smoke test: 4 senaryo (her SaaS cookie ile diğer panel init'ine 403/redirect olduğunu doğrula).

`muhasebe-panel/init` launch eşiğinde aynı pattern ile yazılır (F3).

---

## Aşama 1 Commit Referansları

- `98ff0e8` — Aşama 1A: 6 evergreen endpoint saas_type lookup
- `62592e5` — Aşama 1B: bayi-panel/init guard
- `c9ed5e6` — Aşama 1C: cron/tips + admin/users multi-row
- `4b6ef08` — Aşama 1D: cookie-fast-path bayi/otel/restoran init

---

**Rapor sonu.** Yalnız belge — kod değişikliği yok.
