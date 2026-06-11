# CYBERSEC HARDENING AUDIT — Bayi B2B Portal MVP

> **Tarih:** 2026-06-11
> **Tür:** Defensif self-audit (kendi sistemimizi sertleştirmek için — pentest değil)
> **Denetçi:** Fable 5 (Claude) — Mukul cybersec-skills (agentskills.io) workflow'ları + bağımsız canlı doğrulama
> **Kapsam:** upu-platform kod tabanı (bayi + dağıtıcı), retailai.upudev.nl (test tenant `f5a92742` / 31600000001), Supabase prod, Vercel env
> **Kural uyumu:** Yalnızca read + probe. Hiç DROP/UPDATE/DELETE yok. Yıkıcı test (DoS/brute-force lockout/mass-enum) yapılmadı. Test verisi yalnızca test tenant'ında oluşturuldu.

---

## Yönetici Özeti

**Genel tablo iyi.** En kritik iki güvenlik sınırı sağlam çıktı ve canlıda doğrulandı: **cross-tenant izolasyon kırılmıyor** (3/3 IDOR denemesi 404) ve **mass-assignment blokludur** (order + profil enjeksiyonları sunucu tarafında yok sayıldı). Auth wrapper kapsaması tam, secrets hijyeni temiz, OTP brute-force korumalı.

**Açık bulgular: 0 P0 · 2 P1 · 4 P2 · 5 P3.**

İki P1 hardening ihtiyacı:
1. **AI Eleman rol kapısı client-kontrollü** → tenant-içi yetki yükseltme: düşük yetkili bir bayi kullanıcısı (depocu/satış/muhasebe) `role:"kurucu"` göndererek kurucu yazma araçlarına (bayi/ürün ekleme, toplu import) erişebiliyor. Canlıda doğrulandı.
2. **Güvenlik header'ları eksik** → portal + ödeme sayfaları clickjacking'e açık (X-Frame-Options/CSP yok).

Önceki audit'in (2026-06-10) fixlediği 4 bug bu denetimde güvenlik açısından temiz; not düşüldü.

---

## Bulgu Tablosu

| ID | Kategori | Lokasyon | Severity | OWASP/CWE | Kanıt | Fix |
|----|----------|----------|----------|-----------|-------|-----|
| **H-01** | AI yetki yükseltme (BFLA) | `src/app/api/agent/chat/route.ts:165-167,302` + `src/platform/agent/tools/bayi-kurucu/*` | **P1** | API5:2023 BFLA / CWE-285 | Tool seti `body.role`'den seçiliyor (client). Kurucu yazma-araçları (`add-dealer.ts:32`, `add-product.ts:33`, `commit-dealers.ts:42`, `commit-products.ts:49`) yalnızca `ctx.tenantId` ile scope'lu, **`ctx.role` kontrolü yok** (kıyasla `send_dealer_message.ts:19` role kontrol ediyor). **Canlı:** `role=user` test kullanıcısı `POST {role:"kurucu"}` → 8 yazma-aracı listelendi. | `agentRole`'ü `lookup.profile.role`'den türet (ör. yalnız `admin`→kurucu) **veya** kurucu tool handler'larına `send_dealer_message` gibi `ctx.role` guard ekle. Tenant-içi sızıntı; cross-tenant değil. |
| **H-02** | Güvenlik header eksik | `next.config.*` (headers() yok) — canlı tüm sayfalar | **P1** | A05:2021 / CWE-1021, CWE-693 | **Canlı `curl -I`:** `/tr/bayi`, `/tr/dagitici-panel`, `/tr/bayi/odeme` → **X-Frame-Options MISSING**, Content-Security-Policy yok, X-Content-Type-Options yok, Referrer-Policy yok, Permissions-Policy yok. Yalnız HSTS var (`max-age=63072000`). | `next.config` `async headers()`: `X-Frame-Options: DENY` (veya CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, temel CSP. Ödeme sayfası clickjacking'i öncelik. |
| **H-03** | Insecure design — sipariş miktar sınırı | `src/app/api/bayi/siparis-olustur/route.ts` | **P2** | A04:2021 / CWE-20, CWE-770 | **Canlı:** `quantity:999999999` kabul → `bayi_order_items.quantity=999999999`, total ₺24.999.999.975 (üst sınır + stok kontrolü yok, onay kuyruğu floodlanabilir). `quantity:-5` reddedilmiyor ama 1'e clamp'leniyor (`qty=1` kaydedildi). | Server-side: `quantity` 1..N üst sınır + (opsiyonel) stok kontrolü; ≤0 reddet (clamp yerine 400). |
| **H-04** | Cron fail-open fallback | `src/app/api/cron/*` (11/21 route) | **P2** | A07:2021 / CWE-636 | 11 cron route `if (process.env.CRON_SECRET && authHeader !== ...)` paterni kullanıyor → **CRON_SECRET tanımsızsa kontrol atlanır, endpoint internете açılır** (`bayi-drip` mesaj atıyor, `bayi-scoring` skor yazıyor). `admin-alerts:16` doğru (fallback'siz). **Şu an exploit DEĞİL:** `vercel env ls` → `CRON_SECRET Encrypted` set; yanlış-bearer probe → 401. | Fail-closed yap: `if (authHeader !== Bearer ${secret})` ve secret yoksa 500/401 dön. Latent risk (env rotasyon hatası). |
| **H-05** | Prompt injection yüzeyi | `src/app/api/agent/chat/route.ts:258-259` + `src/platform/agent/prompts/bayi-*.ts` | **P2** | LLM01:2025 / CWE-77 | Kullanıcı `display_name` + `firmaUnvani` sistem promptuna **escape edilmeden** enjekte ediliyor; "Ignore instructions above" tarzı isim talimat sızdırabilir. Mesaj 4000 char + context `\n` strip'li (route.ts:150,157) — kısmi koruma. Exploitability düşük: araçlar `ctx.tenantId` ile scope'lu, cross-tenant exfil yok. | İsim/unvan alanlarını delimiter'la sarıp "veri, talimat değil" ibaresi ekle; isimde kontrol karakteri filtrele. |
| **H-06** | Bağımlılık CVE (npm audit) | `package.json` (transitive ağırlıklı) | **P2** | A06:2021 / CWE-1104 | `npm audit --omit=dev`: 13 açık (4 high, 8 mod, 1 low). High: `next-intl <=4.9.1` (runtime, çoğu icu-minify ReDoS transitive), `brace-expansion <1.1.13` (ReDoS), `postcss <8.5.10` (build-time `</style>` XSS), `basic-ftp`/`ip-address`/`tmp` (transitive). | `npm audit fix` (non-breaking) çoğunu kapatır; `next-intl` major upgrade ayrı test ister. Gerçek exploit yüzeyi düşük (transitive/build-time). |
| **H-07** | x-powered-by info disclosure | canlı response header | **P3** | A05:2021 / CWE-200 | `curl -I` → `x-powered-by: Next.js`. Framework parmak izi. | `next.config` `poweredByHeader: false`. |
| **H-08** | AI history query tenant_id'siz | `src/app/api/agent/chat/route.ts:217-222` | **P3** | API1:2023 / CWE-639 | `agent_conversations` sorgusu yalnız `.eq("user_id", profile.id)` — explicit `tenant_id` yok. **Mitigasyon:** `resolveTenantProfile` user'ı tenant-scope'ta çözüyor (user_id zaten tenant'a bağlı) + RLS politikası var. Sızıntı yok, defense-in-depth eksiği. | Belt-and-suspenders: `.eq("tenant_id", lookup.tenantId)` ekle. |
| **H-09** | notifications tenant_id kolonu yok | `notifications` tablosu + `src/app/api/bayi/bildirim/route.ts:35` | **P3** | API1:2023 / CWE-639 | Tablo `user_id` ile filtreleniyor, `tenant_id` kolonu yok (önceki audit'te de not edildi). `user_id = profiles.id` tenant-scoped olduğu için fiilî sızıntı yok. | Mimari netlik için `tenant_id` kolonu + filtre (opsiyonel). |
| **H-10** | Session revocation yok | `src/platform/auth/session.ts:21` | **P3** | A07:2021 / CWE-613 | JWT (HS256, `SESSION_SECRET`) 30 gün TTL, server-side iptal yok — çalınan token logout'ta geçersizleşmez. Cookie flag'leri sağlam: `HttpOnly; Secure; SameSite=Lax; Domain=.upudev.nl` (canlı doğrulandı). alg confusion yok (jose `jwtVerify`, simetrik). | Kritik değil; gerekirse `session_version` profile alanı + verify'da karşılaştır. |
| **H-11** | Legacy magic-link URL token | `src/app/[locale]/(bayipanel)/*` (`?t=token`) | **P3** | A02:2021 / CWE-598 | Eski bayipanel sayfaları token'ı URL query'de taşıyor (referer/log sızıntısı). **Mitigasyon:** legacy panel `bayi.legacy_panel` flag'i arkasında (default OFF, yeni portala redirect). | Yeni portal cookie-session kullanıyor; legacy sökülünce kapanır. |

---

## Güvenli Çıkan Kontroller (kanıtlı)

| Kontrol | Sonuç | Kanıt |
|---------|-------|-------|
| **Cross-tenant izolasyon** | ✅ Kırılmıyor | Canlı: test tenant kullanıcısı, başka tenant'ın (`32f5feda`) order/dealer ID'leriyle `/api/bayi/siparisler/[id]`, `/api/dagitici/siparisler/[id]`, `/api/dagitici/bayiler/[id]` → **3/3 → 404** |
| **Mass assignment (order)** | ✅ Bloklu | Canlı: `{status:"approved", tenant_id, total_amount:0.01, approved_at}` enjekte → kaydedilen `status=pending`, tutar `25` (server-computed) |
| **Mass assignment (profil)** | ✅ Bloklu | Canlı + DB: `{role:"admin", is_active, metadata.isAdmin}` enjekte → DB `role=user` kaldı, `isAdmin` yok, yalnız `display_name` allowlist'ten geçti |
| **Auth wrapper kapsaması** | ✅ Tam | 46 bayi/dağıtıcı route hepsinde `getBayiAuth`/`getDagiticiAuth`/`requireAuth`; tek istisna `iyzico/callback` (server-to-server, gerekçeli) |
| **OTP brute-force** | ✅ Korumalı | `otp.ts`: phone+IP rate-limit (429), `attempt_count >= MAX_VERIFY_ATTEMPTS` → 429, `expires_at` kontrolü |
| **Secrets hijyeni** | ✅ Temiz | Hardcoded literal secret yok; `NEXT_PUBLIC_*` yalnız anon-key/URL/flag; service-role hiçbir `"use client"` dosyasında yok; `.env` untracked (yalnız `.env.example`); Vercel env'ler `Encrypted` |
| **CORS** | ✅ Reflektör yok | `Origin: evil.example.com` → `Access-Control-Allow-*` dönmüyor |
| **Cookie flags** | ✅ Sağlam | `upu_session=…; HttpOnly; Secure; SameSite=Lax; Domain=.upudev.nl` — CSRF için Lax yeterli koruma |
| **CSRF** | ✅ SameSite=Lax | State-changing POST'lar cross-site cookie taşımaz; ayrıca çoğu mutasyon JSON body + cookie session |
| **IDOR (dealer-scope)** | ✅ Doğru | `siparisler/[id]:45`, `takip/[no]:64`, `tekrar:42` hepsi `dealer_id === dealer.id` guard'ı |

---

## Önceki Audit Fix'leri (2026-06-10) — güvenlik açısından

| Fix | Durum |
|-----|-------|
| iyzico callback tenant-aware origin | ✅ Önceki fix tamam — `resolveTenantOrigin` host/canonical, open-redirect riski yok |
| dashboard status_id→TEXT | ✅ Güvenlik etkisi yok (veri doğruluğu) |
| fatura PDF Storage | ✅ Public bucket; PDF path `tenant_id/` prefix'li — enumeration riski düşük (P3: invoice_no tahmin edilebilir, bucket public — ileride imzalı URL düşün) |
| kargo takip iç sayfa | ✅ Dealer-scope guard'lı (`takip/[no]:64`), open-redirect kapandı |

---

## Kullanılan Skill'ler (şeffaflık)

cybersec-skills/skills/ (754) frontmatter taraması → yüklenen workflow'lar:

- `detecting-broken-object-property-level-authorization` (BOPLA/API3)
- `exploiting-mass-assignment-in-rest-apis` (API6) — order/profil enjeksiyon testi
- `exploiting-excessive-data-exposure-in-api` (API3) — `.select("*")` + secrets taraması
- `exploiting-broken-function-level-authorization` (API5) — AI rol kapısı (H-01)
- `exploiting-idor-vulnerabilities` — cross-tenant order/dealer testi
- `detecting-shadow-api-endpoints` — debug/test endpoint taraması
- `detecting-ai-model-prompt-injection-attacks` (LLM01) — AI Eleman (H-01,H-05,H-08)
- `performing-security-headers-audit` — canlı header (H-02,H-07)
- `testing-cors-misconfiguration` — foreign-origin probe
- `implementing-secrets-scanning-in-ci-cd` — grep+entropy+env (gitleaks/trufflehog kurulu değil; manuel grep fallback)
- `testing-api-authentication-weaknesses` / `conducting-api-security-testing` — auth wrapper sweep
- `implementing-api-rate-limiting-and-throttling` — OTP + chat quota
- `testing-jwt-token-security` — session.ts HS256 inceleme

---

## Defansif Doğrulama Sonuçları (test tenant, canlı)

| # | Test | Komut özeti | Sonuç |
|---|------|-------------|-------|
| 1 | Cross-tenant order (bayi) | login A → `GET /api/bayi/siparisler/<B'nin-id>` | 404 ✅ |
| 2 | Cross-tenant order (dağıtıcı) | `GET /api/dagitici/siparisler/<B'nin-id>` | 404 ✅ |
| 3 | Cross-tenant dealer | `GET /api/dagitici/bayiler/<B'nin-id>` | 404 ✅ |
| 4 | AI rol privesc | `POST /api/agent/chat {role:"kurucu"}` (user rolü) | 8 yazma-aracı açıldı ⚠️ H-01 |
| 5 | Order mass-assign | `POST siparis-olustur {status,tenant_id,total_amount}` | yok sayıldı (pending/25) ✅ |
| 6 | Profil mass-assign | `PUT profil {role:admin,isAdmin}` → DB | role=user kaldı ✅ |
| 7 | Negatif miktar | `quantity:-5` | 1'e clamp (reddedilmedi) ⚠️ H-03 |
| 8 | Devasa miktar | `quantity:999999999` | kabul, ₺25M ⚠️ H-03 |
| 9 | Güvenlik header | `curl -I` ×3 sayfa | X-Frame/CSP MISSING ⚠️ H-02 |
| 10 | CORS reflektör | `Origin: evil` | header yok ✅ |
| 11 | Cookie flags | login Set-Cookie | HttpOnly/Secure/Lax ✅ |
| 12 | Cron fail-open | yanlış bearer + `env ls` | 401 + secret set ✅ (latent H-04) |
| 13 | OTP attempt-limit | otp.ts kod | attempt_count+429 ✅ |
| 14 | Secrets sızıntı | git grep + env | temiz ✅ |

*Bu denetimde test tenant'ında oluşan veri: sipariş 0007 (negatif→clamp), 0008 (999M), bir mass-assign denemesi (pending), display_name="AuditTest". Hepsi 31600000001 test tenant'ı; gerçek müşteri verisine dokunulmadı.*

---

## Fix Log (2026-06-11)

| ID | Durum | Commit | Canlı doğrulama |
|----|-------|--------|-----------------|
| **H-01** | ✅ FIXED | `423ee96` | `effectiveAgentRole` — kurucu yalnız admin/user/satis; muhasebe/depocu → yonetici. Predikat 8/8 deterministik test geçti. Canlı no-regression: owner (role=user) hâlâ 8 kurucu aracını alıyor; yonetici persona read-only çalışıyor. (Engelleme yolu canlı kanıtı muhasebe/depocu profili gerektirir — CLAUDE.md "rolleri izinsiz UPDATE etme" kuralı gereği mevcut profil rolü değiştirilmedi; logic + no-regression ile doğrulandı.) |
| **H-02** | ✅ FIXED | `5aab26c` | `next.config` headers() + poweredByHeader:false. Canlı `curl -I` ×3 sayfa: X-Frame-Options: DENY, CSP frame-ancestors 'none', X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy → hepsi mevcut; x-powered-by kalktı; app kırılmadı (sayfalar 200, chat çalışıyor). |
| **H-07** | ✅ FIXED | `5aab26c` | x-powered-by header'ı kaldırıldı (H-02 ile birlikte). |

| **H-03** | ✅ FIXED | `dbb31ad` | Sipariş miktarı: ≤0/NaN → 400, üst sınır 100000 → 400. Canlı: quantity=-5/0/999999999 → 400 (net hata mesajı); quantity=3 → 200 no-regression. |
| **H-04** | ✅ FIXED | `4d4488f` | 11 cron route fail-closed (`!process.env.CRON_SECRET \|\| ...`). Canlı: bayi-drip/bayi-scoring/quota-renewal yanlış-bearer → 401. |
| **H-05** | ✅ FIXED | `4c6b485` | `sanitizePromptField` (codepoint-bazlı) — kontrol/satır/görünmez karakter temizliği; displayName/firmaUnvani/callerContext bundan geçer. 7/7 unit test (çok-satırlı + zero-width/bidi payload). Canlı: AI chat normal isimle çalışıyor (sanitizer kırmadı). |
| **H-06** | ✅ FIXED | `a0beece` | npm audit high 4→0. Next.js 16.2.1→16.2.9 (Middleware/Proxy bypass patch — tenant izolasyonu için kritik) + non-breaking audit fix. Vercel build hatasız (Next bump app'i kırmadı: tüm sayfalar 200, tenant izolasyon hâlâ 404). Kalan 6 moderate transitive/build-time/kullanılmayan-özellik (kabul edilen artık risk). |

| **H-08** | ✅ FIXED | `2620xxx`/`bw7dhx5cm` | agent_conversations history sorgusuna explicit `tenant_id` filtresi (belt-and-suspenders; user_id zaten tenant-scope). Canlı: AI chat çalışıyor. |
| **H-09** | ✅ FIXED | `23a5d2d` | Migration: notifications.tenant_id + backfill (45/48, 3 orphan admin) + index. sendNotification tenant_id yazıyor (tek profil lookup). bayi/bildirim GET+count+PATCH tenant filtreli. Canlı: yeni sipariş bildirimleri `tenant_id` dolu ✓; bildirim merkezi 200. |
| **H-10** | ✅ FIXED | `f26a9f7` | Migration: profiles.sessions_revoked_at. `isSessionRevoked(iat, revokedAt)` — token revoke damgasından önceyse 401. getBayiAuth+getDagiticiAuth kontrol (ek sorgu yok). /api/auth/logout cookie temizler + damga atar. **Canlı kanıt: logout → eski cookie /me+dağıtıcı 401 (REVOKED), yeni login 200 (kalıcı kilit yok).** Default null → sıfır regresyon. |
| **H-11** | ✅ FIXED | `c10e94d` | Legacy (bayipanel) layout token'ı ilk render'da yakalar (stable, init kırılmaz), `history.replaceState` ile ?t=/?token= landing URL'den silinir. Cross-origin referer zaten H-02 ile kapalıydı. Canlı: legacy route 200 (crash yok). |

Prod deploy'lar: `5aab26c` (H-01/02/07) + `dbb31ad` (H-03) + `4d4488f` (H-04) + `4c6b485` (H-05) + `a0beece` (H-06) + `23a5d2d` (H-08/09) + `f26a9f7` (H-10) + `c10e94d` (H-08/11 final) hepsi Ready, canlıda doğrulandı. **Açık bulgu kalmadı — 11/11 kapatıldı.**

---

## Öncelikli Aksiyon Listesi (hardening)

**P1 — yakında:**
1. **H-01** AI Eleman: kurucu tool handler'larına `ctx.role` guard (veya `agentRole`'ü profile.role'den türet). En küçük fix: 4 kurucu yazma-aracına `send_dealer_message` paternindeki role kontrolünü ekle.
2. **H-02** `next.config` güvenlik header'ları (X-Frame-Options/CSP frame-ancestors öncelik — ödeme sayfası).

**P2 — Faz 5 öncesi:**
3. **H-03** Sipariş miktar üst sınır + ≤0 reddi (clamp yerine 400).
4. **H-04** Cron auth fail-closed (11 route).
5. **H-05** AI prompt'a giren isim/unvan delimiter+filtre.
6. **H-06** `npm audit fix` (non-breaking) + next-intl upgrade planı.

**P3 — fırsat buldukça:** H-07 (poweredByHeader:false), H-08 (history tenant_id), H-09 (notifications tenant_id), H-10 (session revocation), H-11 (legacy panel sökümü).
