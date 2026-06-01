# Emlak SaaS — CLAUDE.md

Bu dosya emlak tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` + `@AGENTS.md` üzerine eklenir.

## Ne yapar

Emlak SaaS — emlak ofisi/danışman portföy yönetimi. Mülk listele, sahibinden ilan sahibiyle iletişim, müşteri talebi, fiyat takibi, sözleşme, rapor. WhatsApp = yan kanal/bildirim, web panel = derinleşme. Multi-property (residenceai) + ana panel (estateai). UPU'nun en olgun şablon SaaS'ı — bayi/market/otel buradan port edildi.

## Pattern'ler

**Route groups:**
- `src/app/[locale]/(panel)` — ana emlak paneli (mulklerim, bildirimler, destek, hakkinda, ara, eklenti...)
- `src/app/[locale]/(dashboard)` — CRM/sahibinden derinleşme (billing, contracts, customers, properties, reminders, reports, settings)

**Subdomain:** estateai.upudev.nl (ana ofis), residenceai.upudev.nl (multi-property). Tenant header `x-tenant-key=emlak` middleware'den gelir.

**Auth:** Cookie session öncelikli (`resolvePanelAuth`). Her API route İLK SATIRDA `requireAuth(req)` veya `resolveTenantProfile`. Magic-link token sadece WA fallback.

**Capability model:** `role='admin'` = ofis sahibi/danışman (OWNER_ALL). Diğer roller (`employee` vs) sınırlı.

**Sahibinden integration:** Cookie auto-recover canlı (`bayi-davet-et`'in emlak karşılığı, task #45). Manuel iş yok.

## Sınırlar (UPU genel)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS (migration `20260520172328`).
- **profiles.tenant_id NOT NULL** emlak profili için her zaman emlak tenant'a bağlı.
- **role='admin' = TENANT SAHİBİ**, platform admin değil. Platform admin: `role='admin' AND tenant_id IS NULL`.
- **Cookie domain `.upudev.nl`** — tüm subdomain paylaşımlı.
- **Tenant izolasyon** — residenceai (multi-property) emlak tenant'ından profil sızması bug'ı vardı (task #90, commit fixed). Her dashboard endpoint tenant_id guard ŞART.
- **PWA YOK** — normal web cookie session.

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Token-only init/save endpoint** — Cookie session öncelikli + token fallback ZORUNLU. Task #51'de 11 sayfada düzeltildi, atlanırsa "Token gerekli" hatası.
- ❌ **API route auth eksik** — her admin/dashboard endpoint İLK satırda `requireAuth`. 2026-05-28 /cso 6 kritik açık buldu.
- ❌ **Tenant_id guard atlama** — multi-tenant route'larda `eq("tenant_id", lookup.tenantId)` zorunlu (task #90 sızıntı). residenceai/estateai ayrımı KRİTİK.
- ❌ **SEO migration atlamak** — emlak redesign yapılırken sıralaması olan siteye 301 redirect + sitemap + GSC zorunlu. Xanthos sitelinks bu yüzden düştü (memory).
- ❌ **Çeviri TR-kalıntı** — i18n sayfalarda /en, /fr, /nl çevirilerine TR cümle sızması (task #67, #73). Çeviri yapınca her dilde regex grep ile audit.
- ❌ **Mock database test** — integration test gerçek DB'ye.

## Bilinen iyi pattern'ler

- **Banking BBVA design depth** (Faz 5.x) — emlak'ın UI olgunluk noktası, diğer SaaS'lar buraya port ediliyor (task #81, #82, #83).
- **Cookie session `.upudev.nl` + Google OAuth + tenant-aware /tr/giris** (Faz 6.x).
- **KVKK consent modal + endpoint** (Faz 7.0).
- **Cookie banner + ToS + İade/iptal** (Faz 7.1a).
- **Verilerim → panel-ayarlari + Mollie billing_address sync** (Faz 7.1b/c).
- **i18n public landing + branded QR** (Faz 9.x).
- **Admin shell pivot** (kart-grid → modern shell, task #88 emlak için devam).
- **Density-aware kartlar** (cookie session + QR login, 2026-05-09 stable).
- **AI Eleman MVP V1** (task #53) — emlak için pivot edilebilir agent.

## Pivot/revert noktaları

- 2026-05-06 emlak `/tr/panel` kart-grid → modern admin shell pivotu. Başarısızsa revert: `ef2a805`.
- 2026-05-11 dark mode öncesi stable: `f7a727d`.
- 2026-05-12 banking redesign öncesi stable: `3bd4107`.
- 2026-05-09 panel UX stable + mobile UI deneme revert noktası: `fd2a86e`.

## İlgili planning dosyaları (pointer)

- `.planning/EMLAK-ADMIN-SHELL-2026-05.md` — admin shell pivot
- `.planning/EMLAK-USER-FLOW.md` — user akış haritası
- `.planning/EMLAK-UX-AUDIT-2026-04-20.md` (+ PDF) — UX audit
- `.planning/ARCHITECTURE.md` — UPU genel mimari (cross-cutting)

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit hash, sayısal durum YAZMA — task list / git log / memory'de.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
