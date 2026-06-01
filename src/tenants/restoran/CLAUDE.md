# Restoran SaaS — CLAUDE.md

Bu dosya restoran tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` + `@AGENTS.md` üzerine eklenir.

## Ne yapar

Restoran SaaS — restoran/kafe yönetimi. QR menü, masa siparişi, garson çağrısı, B2C online sipariş, kampanya, müdavim sistemi. Subdomain: restoranai.upudev.nl. 3'lü paket yaklaşımı (banking + B2C sipariş sitesi + QR menü, task #84). menutje.nl benchmark — sade QR menu pazarda var, UPU farkı = garson modülü + Türk niş.

## Pattern'ler

**Route'lar (route group YERİNE düz route'lar — port edilirken `(restoran-panel)` route group'una taşınması planlanıyor):**
- `src/app/[locale]/restoran-menu` — menü yönetimi
- `src/app/[locale]/restoran-kampanyalar` — kampanya
- `src/app/[locale]/restoran-profil` — restoran profili
- `src/app/[locale]/restoran-mudavimler` — müdavim/sadakat
- `src/app/[locale]/restoran-masalar` — masa yönetimi
- `src/tenants/restoran/b2c/` — B2C online sipariş modülü

**Subdomain:** restoranai.upudev.nl. Tenant header `x-tenant-key=restoran`.

**Auth:** Cookie session öncelikli + token fallback.

**B2C order:** `restoran-panel/b2c-orders/*` endpoint'leri var (B2C sipariş listesi, status update). Token-based for QR menu müşteri (cookie yok).

**Garson çağrı:** `restoran-panel/table-calls/*` — masa numarasıyla anında garson çağrı.

**Capability model:** `src/tenants/restoran/capabilities.ts` — `role='admin'` veya `role='user'` = restoran sahibi (OWNER_ALL).

## Sınırlar (UPU genel + restoran)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS.
- **profiles.tenant_id NOT NULL** restoran profili.
- **role='admin' = TENANT SAHİBİ**, platform admin değil.
- **Cookie domain `.upudev.nl`** — tüm subdomain paylaşımlı.
- **Restoran public QR akışı cookie kullanmaz** — masa QR → menü → sipariş, hepsi token + masa_id ile (misafir kimliği).
- **PWA YOK**.

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Token-only init endpoint** — `restoran-panel/init` panel girişi için token-only istisna (login akışı). Diğer endpoint'lerde cookie öncelikli + token fallback.
- ❌ **API route auth eksik** — her admin endpoint İLK satırda guard.
- ❌ **Emlak/bayi şablonundan link kalıntısı** — port'tan kalıntı sızabilir, grep audit.
- ❌ **B2C ile B2B karışıklığı** — restoran tek tenant'ta hem yönetim (B2B) hem müşteri sipariş (B2C). Endpoint'leri net ayır.
- ❌ **Mock database test**.

## Bilinen iyi pattern'ler

- **3'lü paket:** banking (yönetim) + B2C sipariş sitesi + QR menü — menutje farkı.
- **Garson modülü** — UPU'nun farklılaşma noktası (menutje'de yok).
- **Müdavim/sadakat sistemi** — Türk niş.
- **Masa QR token sistemi** — public order intake.

## İlgili planning dosyaları (pointer)

- `.planning/RESTORAN-PROGRESS.md` — sprint progres
- `.planning/restoran-multiuser-plan.md` — multi-user
- `.planning/ARCHITECTURE.md` — UPU genel mimari

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit, sayısal durum YAZMA.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
