# {{SAAS_NAME}} SaaS — CLAUDE.md

Bu dosya {{SAAS_KEY}} tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` + `@AGENTS.md` üzerine eklenir.

> **TEMPLATE — yeni SaaS açarken doldur:** Tüm `{{PLACEHOLDER}}` ifadelerini doldur, doldurmayacağın bölümleri SİL (boş başlık bırakma). Bitince dosyayı kullanılan SaaS klasörüne taşı.

## Ne yapar

{{SAAS_NAME}} SaaS — {{1-2 paragraf SaaS'ın ne yaptığını anlat: hedef kullanıcı + ana iş + WA/web ayrımı + subdomain}}. Subdomain: {{SUBDOMAIN}}.upudev.nl.

## Pattern'ler

**Route group:** `src/app/[locale]/({{ROUTE_GROUP}})` — {{kısa açıklama, hangi sayfalar burada}}.

**Subdomain:** {{SUBDOMAIN}}.upudev.nl. Tenant header `x-tenant-key={{SAAS_KEY}}` middleware'den gelir.

**Auth:** Cookie session öncelikli + token fallback (`resolvePanelAuth` pattern). Her API route İLK SATIRDA `requireAuth(req)` veya `resolveTenantProfile`.

**Capability model:** `src/tenants/{{SAAS_KEY}}/capabilities.ts` — `role='admin'` veya `role='user'` = tenant sahibi (OWNER_ALL). Diğer roller ({{varsa örnek: muhasebe/depocu/satis}}) sınırlı capability seti.

**WA + panel ayrımı:** {{WA'da ne yapılır + panel'de ne yapılır — bayi WA pivot pattern'ine uy: komut yapısı azalt, bildirim odaklı}}.

**{{SaaS'a özel pattern varsa ekle: örn multi-property, B2C ordering, QR-based public flow, AI Eleman roster}}**

## Sınırlar (UPU genel + {{SAAS_KEY}} özel)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS (migration `20260520172328`).
- **profiles.tenant_id NOT NULL** {{SAAS_KEY}} profili için her zaman {{SAAS_KEY}} tenant'a bağlı.
- **role='admin' = TENANT SAHİBİ**, platform admin değil. Platform admin: `role='admin' AND tenant_id IS NULL` (commit 8d13558 sonrası).
- **Cookie domain `.upudev.nl`** — tüm subdomain paylaşımlı (estateai/retailai/qr...). Auth gate'i daima profile+tenant kontrolüyle yap.
- **Multi-tenant route group zorunlu** — `({{ROUTE_GROUP}})` (generic `panel-*` yok).
- **PWA YOK** — normal web cookie session.
- **{{SaaS'a özel sınırlar ekle: multi-property property_id filter, platform-wide veri pattern, vs.}}**

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Token-only init/save endpoint** — `if (!token) return 400 "Token gerekli"` kabul edilmez. Cookie session öncelikli + token fallback zorunlu. (Task #51 + #98 dersi.)
- ❌ **API route auth eksik** — her admin/dashboard endpoint İLK satırda `requireAdminUser` / `requireAuth`. (2026-05-28 /cso 6 kritik açık dersi.)
- ❌ **Admin guard sadece role kontrolü** — `role='admin'` tek başına platform admin değil. `tenant_id IS NULL` şartı ŞART. (commit 8d13558.)
- ❌ **Generic panel-* sayfası** — her SaaS kendi route group'una sahip olmalı.
- ❌ **Mock database test** — integration test gerçek Supabase'e gitmeli.
- ❌ **Şablon kaynağı SaaS'tan link/metin kalıntısı** — port'tan kaynak SaaS'a ait "Yeni ilan/Mülk/Sipariş ver" gibi sızıntı, grep audit yap.
- ❌ **{{SaaS'a özel YASAKLI pattern varsa ekle}}**

## Bilinen iyi pattern'ler (devam ettir)

- {{Bu SaaS'ın özel başarılı pattern'leri — task numaralı liste, kalıcı kararlar}}
- {{Banking style port, AI Eleman roster, vs. eklenecekse buraya}}

## Pivot/revert noktaları

{{Bu SaaS için major pivot commit'lerini liste yap, revert noktaları olsun. Eğer henüz yoksa bu bölümü SİL.}}

## İlgili planning dosyaları (pointer, içerik değil)

- `.planning/{{SAAS_KEY}}-*` — {{varsa kısa açıklama}}
- `.planning/ARCHITECTURE.md` — UPU genel mimari (cross-cutting)

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit hash, sayısal durum YAZMA — task list / git log / memory'de zaten var, hızla bayatlar.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Bir kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil — stale kalmasın.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
