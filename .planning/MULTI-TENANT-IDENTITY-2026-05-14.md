# Multi-Tenant Identity — Sprint Foundation (2026-05-14)

Aynı `whatsapp_phone`'un birden fazla tenant'ta ayrı profile satırına sahip olmasına izin verir. Lookup tarafı + composite unique constraint + feature flag.

## Neden

1. **Admin test edemiyor.** Çağrı tek phone ile emlak ve bayi'yi paralel test etmek istiyor. Bugünkü tek-tenant `whatsapp_phone` unique constraint engelliyor.
2. **Gerçek müşteri çoklu SaaS.** Bir kullanıcı hem emlakçı hem distribütör olabilir; aynı phone ile birden fazla SaaS'a üye olamıyor.
3. **Test gerekliliği.** Audit raporu (`BAYI-PARITY-AUDIT-2026-05-14.md` Madde 1) tenant-aware giriş tarafının önkoşulu.

## Mimari

```
auth.users (phone unique — DOKUNMUYORUZ)
  └─ id ──── profiles.id (1-1, mevcut)
                   tenant_id     ──→ tenants.saas_type
                   whatsapp_phone (UNIQUE birlikte tenant_id)
```

Şimdilik `profiles.id = auth.users.id` (1-1) korunuyor. Yeni profile insert akışı (`whatsapp/route.ts` `auth.admin.createUser` çağrıları) aynı phone'a ikinci kez tetiklenirse Supabase auth tarafı reddedebilir — **aynı phone için 2. tenant'a profile yaratma akışı bu sprint scope'unda DEĞİL**. Sadece lookup tarafı feature flag ile multi-tenant'a açılıyor.

Lookup helper: `src/platform/auth/tenant-identity.ts`
- `resolveTenantContext(supabase, phone, text)` → `{ tenantKey, selectedProfile, allProfiles, activeSession }`
- `isTenantAwareIdentityEnabled()` → boolean (env flag)
- `extractTenantHintFromText(text)` → "bayi" | "market" | ... | null

## Tenant Resolution Priority Chain

| # | Kaynak | Flag KAPALI | Flag AÇIK |
|---|--------|-------------|-----------|
| 1 | Mesaj prefix hint (`BAYI: ` / `MARKET: ` …) | — | ✓ (yalnız phone'un o tenant'ta profile'ı varsa) |
| 2 | `saas_active_session.active_saas_key` | ✓ | ✓ |
| 3 | En yeni profile (`allProfiles[0]`, created_at DESC) | ✓ | ✓ |
| 4 | Fallback `"emlak"` | ✓ | ✓ |

**Önemli:** Flag KAPALI iken Priority 1 atlanır → davranış birebir mevcut sistem. Refactor side-effect yok.

`BAYI:CODE` (boşluksuz alfa-numerik invite kodu) pattern'i bu helper'dan ÖNCE `whatsapp/route.ts:200+`'de işleniyor — DOKUNULMADI.

## Feature Flag

```bash
# Vercel Project Settings → Environment Variables (Production):
TENANT_AWARE_IDENTITY=true
```

- **Default `false`**: Mevcut davranış birebir. Deploy güvenli.
- **`true` yapılınca**:
  - Webhook regular message resolution prefix hint ek priority alır.
  - `/tr/uye-ol` tenant prefix WA deep link gönderir (örn. `retailai.upudev.nl/tr/uye-ol` → `"BAYI: Üye olmak istiyorum"`).

## Migration

`.planning/migrations/2026-05-14-profiles-multi-tenant.sql` — defensive (mevcut unique constraint adı bilinmiyor, muhtemel adları drop ediyor). Composite `UNIQUE (whatsapp_phone, tenant_id)` ekler + 2 index.

**Ön kontrol (manuel, çalıştırmadan önce):**
```sql
SELECT whatsapp_phone, tenant_id, count(*)
FROM profiles
GROUP BY whatsapp_phone, tenant_id
HAVING count(*) > 1;
-- Boş çıkmalı. Dup varsa önce temizlenmeli.
```

## Rollout Plan

1. **Şimdi:** Bu commit deploy → `TENANT_AWARE_IDENTITY=false` (default). Mevcut davranış, helper refactor sadece kod organizasyonu.
2. **Migration:** Manuel `psql` ile çalıştır. `whatsapp_phone` artık tek başına unique değil — composite (whatsapp_phone, tenant_id).
3. **Flag aç:** Vercel ENV `TENANT_AWARE_IDENTITY=true` + redeploy. Test plan (audit'te listelendi):
   - Tek profile user (emlak only) → mevcut davranış (regression yok)
   - Multi profile user → `degistir` doğru SaaS listesi gösteriyor
   - `retailai.upudev.nl/tr/uye-ol` → WA prefix `"BAYI: Üye olmak istiyorum"` 
4. **Sonraki sprint (scope dışı):** Yeni profile insert akışı multi-tenant — `auth.users` 1-1 ilişkisi gevşetilir veya phone shadow account stratejisi (bu sprint'te DEĞİL).

## Rollback

Hızlı (flag-based):
```bash
TENANT_AWARE_IDENTITY=false  # Vercel ENV
# + redeploy
```
Bu, prefix hint'i devre dışı bırakır. Mevcut davranışa döner.

Schema rollback (sadece composite constraint'ten geri dönmek gerekirse):
```sql
ALTER TABLE profiles DROP CONSTRAINT profiles_whatsapp_phone_tenant_unique;
DROP INDEX IF EXISTS idx_profiles_whatsapp_phone_tenant;
DROP INDEX IF EXISTS idx_profiles_whatsapp_phone;
ALTER TABLE profiles ADD CONSTRAINT profiles_whatsapp_phone_key UNIQUE (whatsapp_phone);
```
**Önce flag'i kapat**, sonra schema rollback. Aksi halde regular message lookup yanlış profile seçebilir.

## Etkilenen Dosyalar

- `src/platform/auth/tenant-identity.ts` (YENİ) — helper
- `src/app/api/whatsapp/route.ts` — regular message lookup helper'a yönlendi
- `src/platform/whatsapp/router.ts` — `degistir` tek-profile mesajı tenant adı söylesin
- `src/app/[locale]/uye-ol/page.tsx` — server wrapper (yeni)
- `src/app/[locale]/uye-ol/_components/UyeOlClient.tsx` (YENİ) — eski client logic
- `.planning/migrations/2026-05-14-profiles-multi-tenant.sql` (YENİ) — composite unique

## Bilinen Sınırlar

- Yeni profile yaratma (`auth.admin.createUser`) aynı phone'a 2. kez tetiklenirse Supabase auth reddeder. Test 6.B.2 ("bayi'ye yeni profile yazılır") bugün çalışmaz — sonraki sprint'in işi (auth shadow account veya `profiles.id ≠ auth.users.id` ayrımı).
- Prefix hint sadece o tenant'ta phone'un profile'ı varsa geçerli — orphan hint (BAYI: yazan ama bayi'de profile'ı olmayan phone) ignore edilir, fallback chain çalışır.
- `siteyonetim/kayit.ts:60` `sy_residents` farklı tablo — bu sprint scope dışı.
