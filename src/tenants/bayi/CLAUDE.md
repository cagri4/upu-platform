# Bayi SaaS — CLAUDE.md

Bu dosya bayi tenant'ında çalışan worker için kalıcı bağlam. Root `CLAUDE.md` ve `@AGENTS.md` üzerine eklenir.

## Ne yapar

Bayi (B2B distribütör portalı) — marka/distribütör ile bayi (perakendeci) arasındaki sipariş, cari, vade, tahsilat, kampanya, ürün yönetimi. WhatsApp = yan kanal/bildirim (ana "uzaktan kumanda"), web panel = derinleşme ("kokpit"). 37 alt-sayfalı portal canlıda (`src/app/[locale]/(bayipanel)/bayi-*`).

## Pattern'ler

**Route group:** `src/app/[locale]/(bayipanel)/bayi-*`. Her özellik kendi route'unda (`bayi-siparis-ver`, `bayi-cari`, `bayi-tahsilatlarim`...). Generic `panel-*` sayfası yapma — cross-SaaS kırılır.

**Auth:** Cookie session öncelikli (`getSessionFromCookies` / `resolvePanelAuth`). Her API route İLK SATIRDA `requireAuth(req)` veya `resolveTenantProfile`. Magic-link token sadece WA URL fallback.

**Capability model:** `src/tenants/bayi/capabilities.ts`. `role='admin'` veya `role='user'` = tenant sahibi (OWNER_ALL). Diğer roller (`muhasebe`, `depocu`, `satis`) sınırlı capability seti. Tenant rolüdür — platform admin değil.

**WA + panel ayrımı:** Bayi WA pivot'ı sonrası komut yapısı azaltıldı, **bildirim odaklı** (sipariş onayı, vade hatırlatma, tahsilat). Form/uzun iş hep web panel'e taşı. WA'da kısa komut + onay/red.

**AI Eleman roster:** Tek chatbot DEĞİL — rol-bazlı ekip (`agents/` altında Kurucu/Yönetici Asistanı/Eğitmen). Sağ-alt ikondan seçilir. Tek hafıza, tek kimlik, yetki farkındalığı.

## Sınırlar (UPU genel + bayi spesifik)

- **phone GLOBAL UNIQUE** — 1 telefon = 1 SaaS (migration `20260520172328`). Aynı kişiyi farklı tenant'a kayıt yapamazsın.
- **profiles.tenant_id NOT NULL** bayi profili için her zaman bayi tenant_id'sine bağlı.
- **role='admin' = TENANT SAHİBİ**, platform admin değil. Platform admin koşulu: `role='admin' AND tenant_id IS NULL` (commit 8d13558 sonrası).
- **Cookie domain `.upudev.nl`** — tüm subdomain'ler paylaşımlı (retailai/estateai/qr...). Bir SaaS'ta cookie set edilirse diğerlerinde de aktif. Auth gate'i daima profile+tenant kontrolüyle yap.
- **Multi-tenant route group zorunlu** — generic panel sayfası yapma (memory: feedback-multi-tenant-route-groups).
- **PWA YOK** — UPU normal web cookie session kullanıyor. PWA install banner / service worker / offline cache YOK (2026-06-05'te tamamen kaldırıldı). Native iOS/Android app olarak yapılacak. "PWA install / offline / manifest" önerme.

## YASAKLI pattern'ler (geçmiş bug dersleri)

- ❌ **Token-only init/save endpoint** — `if (!token) return 400 "Token gerekli"`. Cookie session öncelikli + token fallback (resolvePanelAuth) zorunlu. Task #51 (11 sayfa) + task #98 (setup/init) bu pattern'in maliyetiydi.
- ❌ **API route auth eksik** — her admin/dashboard endpoint İLK satırda `requireAdminUser` / `requireAuth`. 2026-05-28 /cso 6 kritik açık buldu (commit 14e304b).
- ❌ **Admin guard sadece role kontrolü** — `role='admin'` tek başına platform admin değil. tenant_id NULL şartı ŞART (commit 8d13558).
- ❌ **Mock database test** — integration test gerçek Supabase'e gitmeli, mock prod'da patlar.
- ❌ **Emlak şablonu port'tan kalıntı link/metin** — bayi emlak'tan port edildi, "yeni ilan / mülk / sahibinden" kalıntısı sızabilir. Yeni sayfa eklerken grep ile audit yap, gerçek risk düşükse aşırı kilitleme yapma.
- ❌ **Admin (kendisi) kullanıcı silme** — adminpanel silme `profiles + auth_user` birlikte siliyor, admin kendi kaydını silerse giriş gider. Önce role + alternatif admin kontrolü, NET uyar.
- ❌ **Compact ≠ RAM relief** — bayi worker context dolu olsa `/compact` token azaltır, RAM düşürmez. Worker RAM dolarsa restart şart.

## Bilinen iyi pattern'ler (devam ettir)

- **Bildirim merkezi** (`bayi-bildirimler`) — task #59'da geldi, event-driven.
- **Cari + sanal POS + vade + tahsilat** (`bayi-cari/vade/tahsilatlarim`) — task #49 birleşik akış.
- **Stok UI + Mollie billing** (`bayi-stok`, `bayi-billing`) — task #60.
- **Marketing otomatik + öneri motoru** (`bayi-marketing`, `bayi-kampanya-otomatik`, `recommendations.ts`) — task #66 (Faz B), cross-sell.
- **Online Vitrin + referans** (`bayi-vitrinim`, `bayi-davet*`) — task #68 (Faz C).
- **AI Eleman ekibi** (`agents/`) — task #92, roster pattern.
- **OTP-first signup** (task #96) — cookie set + redirect, sanal telefon test için `admin_test_identities` last_otp_code mekanizması.

## İlgili planning dosyaları (pointer, içerik değil)

- `.planning/BAYI-DALGA-2026-05-08.md` — major refactor logu
- `.planning/BAYI-PARITY-AUDIT-2026-05-14.md` — emlak ile parity karşılaştırması
- `.planning/BAYI-ADMIN-SHELL-2026-05.md` — admin shell port
- `.planning/bayi-tek-asistan-vision-2026-04-30.md` — vizyon
- `.planning/bayi-multiuser-design-2026-04.md` + `bayi-multiuser-plan.md` — multi-user
- `.planning/bayi-tour-mvp-2026-05-04.md` — tour MVP

## Bu dosyayı güncellerken

- ❌ Açık iş listesi, son commit hash, sayısal durum YAZMA — task list / git log / memory'de zaten var, hızla bayatlar.
- ✅ Kalıcı mimari karar, anti-pattern dersi, sınır ekle.
- 🔄 Bir kural çiğnenip yeni karar verildiyse eski kuralı güncelle veya sil — stale kalmasın.

**Stale CLAUDE.md tutmaktansa boş CLAUDE.md daha iyi.**
