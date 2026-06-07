# Federated Identity Design — 2026-06-07

**Status:** PLAN (not yet implemented)
**Trigger task:** #113 — Federated identity göçü tasarımı (1 telefon → N SaaS)
**Author:** Claude (2026-06-07 mimari refactor paketi 4. iş)
**When to apply:** Sahaya çıkış sonrası (üretim datasıyla daha güvenli yapılmalı; mevcut test akışlarını kıracak)

---

## Bağlam

Bugünkü öz eleştirimde tespit edilen mimari sorunlardan biri: bir kullanıcı = bir `tenant_id`. Eğer Ruhi can hem bayi hem emlak SaaS'ı kullanmak isterse mevcut modelde **iki ayrı profile** (iki ayrı telefon) açması gerekiyor. UPU'nun büyüme yönü "tek telefon → N SaaS" ise bu yapı bloker.

`profiles` tablosu polimorfik bir kimlik: aynı zamanda **kim olduğun** (telefon, ad) + **hangi tenant'a bağlı olduğun** (tenant_id) bilgilerini taşıyor. Bu iki kavram ayrılmalı.

---

## Current state

```
profiles
├── id (PK)
├── auth_user_id (FK auth.users)
├── whatsapp_phone (UNIQUE — tek kimlik kaynağı)
├── display_name, email
├── role ('admin' | 'user' | 'system')
├── tenant_id (FK tenants) → NOT NULL except platform admin
└── is_platform_admin (BOOLEAN, 2026-06-07 mimari fix)

tenants
├── id (PK)
├── saas_type ('emlak' | 'bayi' | 'otel' | ...)
├── slug, name, is_demo
└── tenant data fields
```

Sorunlar:
- `profiles.tenant_id` tek değer → bir kullanıcı tek tenant'a bağlı
- Aynı telefon farklı SaaS'a katılamaz (UNIQUE phone constraint)
- "Hangi tenant'ta çalışıyorum?" sorusu profile'dan okunuyor — domain/context bilgi atılıyor

---

## Target state

```
profiles  (universal identity — tenant'sız)
├── id (PK)
├── auth_user_id
├── whatsapp_phone (UNIQUE)
├── display_name, email
├── is_platform_admin (BOOLEAN)
└── created_at

tenant_memberships  (many-to-many)
├── id (PK)
├── profile_id (FK profiles, ON DELETE CASCADE)
├── tenant_id (FK tenants, ON DELETE CASCADE)
├── role ('owner' | 'admin' | 'employee' | 'viewer')
├── permissions (JSONB, optional)
├── is_default (BOOLEAN — fallback active tenant)
├── invited_by (FK profiles, ON DELETE SET NULL)
├── joined_at
└── UNIQUE (profile_id, tenant_id)

session_active_context  (cookie payload uzantısı)
└── active_tenant_id eklenir

tenants  (değişmedi)
└── existing schema
```

---

## Migration sequence

### Faz 1 — Tablo ve trigger (geri uyumlu)

```sql
-- 1) tenant_memberships tablosu
CREATE TABLE public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','employee','viewer')) DEFAULT 'employee',
  permissions JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, tenant_id)
);

CREATE INDEX idx_tenant_memberships_profile ON public.tenant_memberships(profile_id);
CREATE INDEX idx_tenant_memberships_tenant ON public.tenant_memberships(tenant_id);
CREATE INDEX idx_tenant_memberships_default ON public.tenant_memberships(profile_id) WHERE is_default;

-- 2) Backfill: profiles.tenant_id NOT NULL satırlar → tenant_memberships
INSERT INTO public.tenant_memberships (profile_id, tenant_id, role, is_default, joined_at)
SELECT
  id,
  tenant_id,
  CASE WHEN role = 'admin' THEN 'owner' ELSE 'employee' END,
  true,  -- mevcut tek tenant = default
  created_at
FROM public.profiles
WHERE tenant_id IS NOT NULL;

-- 3) RLS politikaları (tenant_memberships)
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_memberships" ON public.tenant_memberships
  FOR SELECT USING (profile_id = auth.uid());
-- platform admin tüm membership'leri okur
```

### Faz 2 — Auth flow değişikliği (kırıcı)

- OTP verify (login): telefon → profile → membership listesi. Kullanıcı 1+ membership varsa **active tenant selection** sayfası (varsayılan: is_default=true olan, yoksa kullanıcı seçer).
- Cookie session payload genişler:
  ```ts
  { uid: string, tenantId: string | null, activeTenantId: string | null }
  ```
- Signup: telefon zaten profile varsa → yeni signup denemesini **membership extension** olarak yorumla (kullanıcıyı uyar: "bu telefon zaten X SaaS'da kayıtlı, yeni SaaS'a da eklensin mi?")
- Yeni domain'e ilk girişte: middleware Host → tenant_key → membership check → yoksa "bu SaaS'a erişimin yok" + davet linki

### Faz 3 — Endpoint refactor (büyük kapsam)

Mevcut `actor.tenant_id` referansları (~50 endpoint) **active context'ten** okumaya geçer:
- `getActiveTenantId(session)` — session.activeTenantId veya membership.is_default
- requireTenantAccess(req, tenantId) — membership check
- 7 SaaS panel-me endpoint'leri: profile'ı çekerken membership ile JOIN

### Faz 4 — profiles.tenant_id deprecation

- profiles.tenant_id NULLABLE'a indir (default NULL — yeni profile'lar tenant'sız)
- Eski referansları audit script ile tek tek refactor
- 90 gün sonra kolon DROP

---

## Auth flow diyagramı

### Login (mevcut tek tenant → federated)

```
[Telefon]
   ↓
[OTP gir]
   ↓
[/api/auth/otp/verify]
   ↓
   profile = SELECT * FROM profiles WHERE whatsapp_phone = X
   ↓
   memberships = SELECT * FROM tenant_memberships WHERE profile_id = profile.id
   ↓
┌──────────────────────────────────────────┐
│ memberships.length === 0 → fallback eski │
│   yapısı: profile.tenant_id (uyum süresi)│
│   veya redirect "/no-tenant"             │
└──────────────────────────────────────────┘
   ↓
   memberships.length === 1 → activeTenantId = m[0].tenant_id (auto)
   ↓
   memberships.length > 1 → /tr/tenant-secim sayfası
                            (kart-grid: SaaS adı + slug + role)
   ↓
[set session cookie] uid + activeTenantId
   ↓
[redirect /tr/<saas>-panel]
```

### Signup (yeni telefon → yeni tenant + membership)

```
[/api/auth/otp/verify signup branch]
   ↓
   1. createTenantForSignup(saas_type)
   2. createProfile (tenant_id NULL — federated)
   3. createTenantMembership (profile_id, tenant_id, role='owner', is_default=true)
   4. attachSessionToResponse({ uid, activeTenantId: new tenant.id })
```

### Yeni SaaS'a katılma (mevcut telefon → ek membership)

```
[Mevcut profile retailai.upudev.nl'den signup deniyor]
   ↓
   profile = exists (whatsapp_phone match)
   ↓
   UI: "Bu telefon zaten bayi SaaS'da kayıtlı. Yeni emlak SaaS'a da eklensin mi?"
   ↓
   onay → createTenantMembership(profile_id, new tenant_id, role='owner')
   ↓
   tenant-secim sayfasına yönlendir
```

---

## Risk listesi + mitigation

| # | Risk | Mitigation |
|---|---|---|
| 1 | Mevcut signup'lar kırılır (profile.tenant_id okuyan endpoint'ler) | Faz 1'de yalnızca membership backfill; profile.tenant_id deprecation Faz 4'te. Audit script ile her endpoint kontrol. |
| 2 | Active tenant context kaybedildiğinde panel boş kalır | Middleware her request'te `activeTenantId` cookie payload'unda yoksa → fallback `is_default=true` membership |
| 3 | Tenant_memberships tablosu RLS hatası → admin tüm membership'leri göremez | Platform admin için ayrı policy: `is_platform_admin = true` ise tam erişim |
| 4 | Aynı telefon farklı SaaS'a 100 kez signup → çok membership | UI'da "yeni SaaS'a katılma" onayı zorunlu (POST confirm endpoint) |
| 5 | Tenant silindiğinde membership CASCADE silinir, kullanıcı orphan kalabilir | profile silinmez; eğer tek membership idiyse kullanıcı "tenant-secim" sayfasında "hiç tenant'ın yok" görür → davet bekler |
| 6 | Platform admin (is_platform_admin=true) federated mantığa girmesin | requireAdminUser bayrak check yeterli; admin için membership kontrolü yapılmıyor |
| 7 | Session cookie payload boyutu büyür | activeTenantId tek UUID; JWT ~3 byte artar, sorun yok |

---

## Test stratejisi

- **Faz 1 (backfill):** her profile için tam 1 membership oluştu mu? UNIQUE (profile_id, tenant_id) ihlali yok mu?
- **Faz 2 (auth flow):** 4 senaryo:
  1. Tek tenant kullanıcı → otomatik girer ✅
  2. Çok tenant kullanıcı → seçim sayfası ✅
  3. Mevcut telefon yeni SaaS'a katılır → onay + membership eklenir ✅
  4. Tenant silinince kullanıcı → orphan akışı ✅
- **Faz 3 (endpoint):** her SaaS panel-me + admin endpoint'leri test edilir (50+ endpoint, otomasyon gerekli)
- **Faz 4 (deprecation):** profile.tenant_id NULL'a inerken hiçbir endpoint okumuyor mu? grep ile audit + 7 gün dry-run

---

## Tahmini effort

- **Faz 1:** 1-2 saat (migration + backfill + RLS + test)
- **Faz 2:** 4-6 saat (auth flow refactor + tenant-secim sayfası + UI)
- **Faz 3:** 6-10 saat (50+ endpoint refactor + audit)
- **Faz 4:** 2-3 saat (deprecation + 90 gün dry-run + DROP)

**Toplam:** ~2-3 gün yoğun çalışma. Sahaya çıkış sonrası, gerçek müşteri trafiği başladığında planlanması doğru (üretim verisi ile validasyon kolay).

---

## Bağlantılar

- Task: #113
- Audit: `.planning/AUTH-FEDERATED-AUDIT-2026-06-05.md` (Faz 0 — geçmiş hazırlık)
- Memory: `feedback_multi_tenant_refactor_audit` (6 katman audit kuralı federated için de uygulanır)
- Memory: `feedback_cascade_delete_audit_both_directions` (yeni tablo eklendiğinde FK iki yön audit)

---

## Karar

Bu dosya **uygulama planı** olarak hazırlandı. Şu an üretim trafiği yok ama sahaya çıkış öncesi büyük refactor riski yüksek. Çağrı 2026-06-07 onayı: federated identity sahaya çıkış sonrası, Faz 1'den başlayarak uygulanır.

Sahaya çıkıştan ÖNCE acil ihtiyaç doğarsa (örn. erken müşteri "ben hem bayi hem otel istiyorum" derse) Faz 1+2'yi minimum olarak uygulayıp Faz 3'ü gradual yapma seçeneği var.
