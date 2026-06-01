# Market SaaS — CLAUDE.md

Bu dosya market tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` + `@AGENTS.md` üzerine eklenir.

## Ne yapar

Market SaaS — yerel market/bakkal/zincir mağazası yönetimi. Stok takibi, kasa raporu, müşteri sadakat, kampanya, online sipariş. WhatsApp = bildirim/kısa komut, web panel = derinleşme. Subdomain: marketai.upudev.nl. Banking style port'a geçiş yapılıyor (task #82).

## Pattern'ler

**Route group:** `src/app/[locale]/(market-panel)` — market panel sayfaları.

**Subdomain:** marketai.upudev.nl. Tenant header `x-tenant-key=market`.

**Auth:** Cookie session öncelikli + token fallback. Her API route İLK SATIRDA `requireAuth` veya `resolveTenantProfile`.

**Capability model:** `role='admin'` veya `role='user'` = market sahibi (OWNER_ALL). Kasiyer/depocu gibi diğer roller sınırlı capability.

**WA + panel:** Bayi WA pivot pattern'i — komut yapısı azaltıldı, bildirim odaklı (sipariş onayı, stok uyarısı, kasa farkı).

**Şablon kaynağı:** Emlak/bayi banking style port'tan (task #82 in_progress). Ana SaaS mimarisini emlak'a göre güncelle.

## Sınırlar (UPU genel)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS (migration `20260520172328`).
- **profiles.tenant_id NOT NULL** market profili için her zaman market tenant'a bağlı.
- **role='admin' = TENANT SAHİBİ**, platform admin değil. Platform admin: `role='admin' AND tenant_id IS NULL`.
- **Cookie domain `.upudev.nl`** — tüm subdomain paylaşımlı.
- **Multi-tenant route group zorunlu** — `(market-panel)` (memory: feedback-multi-tenant-route-groups).
- **PWA YOK** — normal web cookie session.

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Token-only init/save endpoint** — cookie öncelikli + token fallback ZORUNLU (task #51, #98 dersleri).
- ❌ **API route auth eksik** — her admin endpoint İLK satırda guard.
- ❌ **Emlak/bayi şablonundan link kalıntısı** — market emlak'tan port edildi, "Yeni ilan", "Mülk", "Sipariş ver" (bayi) gibi link/metin sızabilir. Yeni sayfada grep ile audit yap (memory: feedback-saas-template-port-link-audit). Gerçek risk düşükse aşırı kilitleme yapma.
- ❌ **Generic panel-* sayfası** — her SaaS kendi route group'una sahip olmalı.
- ❌ **Mock database test**.

## Bilinen iyi pattern'ler (port edilirken takip)

- Banking BBVA design depth (emlak Faz 5.x'ten port — task #82).
- Cookie session + Google OAuth + tenant-aware giriş.
- KVKK consent modal + endpoint.
- AI Eleman roster pattern (bayi'den port edilebilir, sırası gelince).

## İlgili planning dosyaları (pointer)

- `.planning/MARKET-ADMIN-SHELL-2026-05.md` — admin shell port planı
- `.planning/ARCHITECTURE.md` — UPU genel mimari

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit, sayısal durum YAZMA.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
