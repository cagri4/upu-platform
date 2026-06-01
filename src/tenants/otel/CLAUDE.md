# Otel SaaS — CLAUDE.md

Bu dosya otel tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` + `@AGENTS.md` üzerine eklenir.

## Ne yapar

Otel SaaS — küçük/orta otel/pansiyon yönetimi. Rezervasyon, misafir, çalışan, oda, kasa, kampanya, online check-in. WhatsApp = bildirim/kısa komut, web panel = derinleşme. Multi-property (zincir otel) modülü var. Subdomain: otelai.upudev.nl. Banking style port'a geçiş yapılıyor (task #81).

## Pattern'ler

**Route group:** `src/app/[locale]/(otel-panel)` — otel panel sayfaları.

**Multi-property:** `src/tenants/otel/multi-property.ts` — bir tenant altında birden çok mülk. Endpoint'lerde `property_id` filter zorunlu.

**Misafir check-in:** `src/app/[locale]/otel-cekin` (route group dışı, public misafir pre-checkin) — token-only by design (misafir cookie session yok, tek-amaçlı magic-link). Bu bilinçli istisna.

**Çalışan davet:** `src/app/[locale]/otel-calisan-davet` — otel çalışanı onboarding.

**Subdomain:** otelai.upudev.nl. Tenant header `x-tenant-key=otel`.

**Auth:** Cookie session öncelikli + token fallback. Her API route İLK SATIRDA `requireAuth` veya `resolveTenantProfile`.

**Capability model:** `src/tenants/otel/capabilities.ts` — `role='admin'` veya `role='user'` = otel sahibi (OWNER_ALL). `employee` = sınırlı (mizant/resepsiyon).

## Sınırlar (UPU genel + otel)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS.
- **profiles.tenant_id NOT NULL** otel profili için her zaman otel tenant'a bağlı.
- **role='admin' = TENANT SAHİBİ**, platform admin değil. Platform admin: `role='admin' AND tenant_id IS NULL`.
- **Cookie domain `.upudev.nl`** — tüm subdomain paylaşımlı.
- **Multi-property guard** — endpoint'lerde `property_id` filter atlanırsa diğer mülklerin verisi sızar.
- **PWA YOK** — normal web cookie session.

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Token-only init/save endpoint** — cookie öncelikli + token fallback ZORUNLU. **İstisna:** `otel-cekin/init` (misafir pre-checkin, cookie yok, magic-link tek-amaçlı). Bunun dışında uygulanır.
- ❌ **API route auth eksik** — her admin endpoint İLK satırda guard.
- ❌ **property_id filter atlama** — multi-property tenant'larda her query'de filter zorunlu.
- ❌ **Emlak/bayi şablonundan link kalıntısı** — port'tan kalıntı sızabilir, grep audit.
- ❌ **Mock database test**.

## Bilinen iyi pattern'ler

- **Multi-property module** — task #70'te şablon olarak çoğaltıldı.
- **Misafir check-in akışı** — token-based public flow.
- **Çalışan rol sistemi** — admin/employee/muhasebe.
- Banking style port (task #81 in_progress, emlak Faz 5.x'ten).

## İlgili planning dosyaları (pointer)

- `.planning/otel-multiuser-plan.md` — multi-user mimarisi
- `.planning/ARCHITECTURE.md` — UPU genel mimari

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit, sayısal durum YAZMA.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
