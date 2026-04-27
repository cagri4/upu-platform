# upu-platform — Yeni SaaS Dikey Ekleme Recipe

Bu dosya yeni bir SaaS dikey eklemek için adım adım rehberdir. Mevcut SaaS'ları
(emlak, bayi, otel, market, muhasebe, siteyonetim) model alıyor.

> **Önce şunları oku:** ARCHITECTURE.md (mimari) + SAAS-INVENTORY.md (mevcut
> dikeyler) + CONVENTIONS.md (konvansiyonlar). Bu dosya o üçünün üstüne kurulu.

## Karar Vermen Gereken Şeyler — En Başta

Yeni SaaS işine başlamadan **kullanıcıyla** netleştir:

1. **Sektör + ana kullanıcı kim?** (örn: dental klinik / sigorta acentesi /
   kuaför) — concrete persona seç
2. **3-5 "killer komut"** (önce büyük resim, sonra detay) — emlakçıya `mulkekle`
   ne kadar değerli ise dental kliniğin de o kadar değerli ne komutu olacak?
3. **Domain (subdomain)** — `dentalai.upudev.nl` mı, yoksa custom domain mı?
4. **Tipik onboarding bilgileri** — ad + ne? (ofis adı? lokasyon? hizmet
   kategorisi?)
5. **DB tabloları** — bu SaaS'ın tipik kayıtları neler? (örn: hasta listesi,
   randevu, tedavi geçmişi, ödeme)
6. **Brifing içeriği** — sabah brifingi varsa içinde ne olacak? (yarınki
   randevular? bekleyen ödemeler?)
7. **AI agent gerekecek mi?** Karmaşık iş (dosya inceleme, çok adımlı analiz)
   varsa V2 agent ekle. Basit ise sadece komut yeterli.

## Adım Adım Recipe

### 1) `src/tenants/{name}/` dizinini oluştur

```bash
mkdir -p src/tenants/dental/{commands,agents}
```

### 2) `src/tenants/{name}/onboarding-flow.ts` yaz

Model: `src/tenants/emlak/onboarding-flow.ts`

İçerikte:
- `tenantKey: "dental"`
- `steps: []` — array of { key, question, buttons?, onComplete? }
- `onFinish: async (ctx, data) => { profiles.metadata güncelle, discovery chain başlat }`

Önemli alanlar (kullanıcının verdiği bilgilerden):
- display_name, telefon (zaten profiles'ta), spesifik (örn: clinic_name,
  specialization), brifing tercihi

### 3) İlk komut(ları) yaz: `src/tenants/{name}/commands/{komut}.ts`

Model: `src/tenants/emlak/commands/mulk-ekle.ts` (en fazla pattern var)
veya `siteyonetim/commands/aidat.ts` (basit)

Tipik handler imzası:
```typescript
import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons, sendList, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";

export async function handleHasta(ctx: WaContext): Promise<void> {
  // tek-shot komut: kayıt listesi göster
  const supabase = getServiceClient();
  const { data: hastalar } = await supabase
    .from("dental_patients")
    .select("id, name, last_visit")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.userId)
    .order("last_visit", { ascending: false })
    .limit(10);

  if (!hastalar?.length) {
    await sendButtons(ctx.phone, "Henüz hastanız yok.", [
      { id: "cmd:hasta-ekle", title: "Hasta Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }
  // ... liste oluştur, sendList...
}

// multi-step ise:
export async function handleHastaEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "hasta-ekle", "name");
  await sendText(ctx.phone, "👤 Hastanın ad-soyadını yazın:");
}

export async function handleHastaEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  switch (session.current_step) {
    case "name":
      await updateSession(ctx.userId, "phone", { name: text });
      await sendText(ctx.phone, "📱 Telefon?");
      return;
    // ...
  }
}
```

### 4) `src/tenants/{name}/commands/index.ts` ile registry yaz

Model: `src/tenants/emlak/commands/index.ts`

```typescript
import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { handleHasta, handleHastaEkle, handleHastaEkleStep } from "./hasta";
// ...

export const dentalCommands: TenantCommandRegistry = {
  commands: {
    hasta: handleHasta,
    hastaekle: handleHastaEkle,
  },
  stepHandlers: {
    "hasta-ekle": handleHastaEkleStep,
  },
  callbackPrefixes: {
    "hasta:": handleHastaCallback,
  },
  aliases: {
    "hasta ekle": "hastaekle",
    "hastalar": "hasta",
  },
};
```

### 5) `src/tenants/config.ts`'e tenant ekle

```typescript
const TENANTS: Record<string, TenantConfig> = {
  emlak: { ... },
  // ...
  dental: {
    key: "dental",
    name: "Dental Klinik",
    slug: "dentalai",
    tenantId: "<UUID — Supabase'den oluştur>",
    saasType: "dental",
    whatsappPhone: "31644967207",
    icon: "🦷",
    color: "#0EA5E9",
    description: "Diş hekimi muayenehaneleri için sanal asistan",
    welcomeFeatures: "Hasta yönetimi, randevu, tedavi takibi",
    employees: [
      { key: "asistan", name: "Asistan", icon: "📋",
        description: "Günlük randevu, hatırlatma",
        commands: ["randevular", "hatirlatma", "ozet"] },
      { key: "muhasebeci", name: "Muhasebeci", icon: "💰",
        description: "Ödeme, fatura",
        commands: ["odemeler", "fatura"] },
      // ...
    ],
    commandMap: {},
    guide: "",
    defaultFavorites: ["hasta", "hastaekle", "randevular", "ozet"],
  },
};
```

### 6) Router'a tenant'ı kaydet

`src/platform/whatsapp/router.ts` veya `src/platform/whatsapp/types.ts` —
**TENANT_REGISTRIES** map'ine yeni tenant'ı ekle:

```typescript
import { dentalCommands } from "@/tenants/dental/commands";
// ...
const TENANT_REGISTRIES: Record<string, TenantCommandRegistry> = {
  emlak: emlakCommands,
  // ...
  dental: dentalCommands,
};
```

(Tam path için onboarding-flow registry'sine de bak — `src/platform/whatsapp/onboarding.ts`'a ekle.)

### 7) DB tabloları + migration

Supabase migration yaz: `supabase/migrations/{timestamp}_add_dental_tables.sql`

```sql
-- Hasta tablosu
create table dental_patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references profiles(id),
  name text not null,
  phone text,
  birth_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index dental_patients_user_id_idx on dental_patients(user_id);

-- RLS
alter table dental_patients enable row level security;
create policy "tenant_access" on dental_patients
  for all using (tenant_id = (auth.jwt()->>'tenant_id')::uuid);
```

İsim kuralı: `{shortprefix}_{noun}` — emlak: `emlak_*`, market: `mkt_*`,
muhasebe: `muh_*`, siteyonetim: `sy_*`, otel: `otel_*`, bayi: `bayi_*`. Yeni
SaaS için kısa prefix seç (dental → `dnt_`, sigorta → `sgr_`, ...).

### 8) Web form gerekiyorsa: `src/app/[locale]/{flow}-form/page.tsx`

Karmaşık form (10+ alan, foto upload) WA'da değil web'de. Model:
`src/app/[locale]/musteri-ekle-form/page.tsx`

Pattern:
1. URL'den `?t=token` al
2. `/api/{flow}/init?t=...` ile token validate et + initial data al
3. Form göster, "Submit" → POST /api/{flow}/save
4. Success → "WhatsApp'a Dön" butonu (wa.me/{BOT}, ?text yok)

API endpoint için: `src/app/api/{flow}/save/route.ts` model:
`src/app/api/musteri/save/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  // 1. Token validate
  // 2. DB'ye yaz
  // 3. NextResponse return
  // 4. after() içinde:
  //    - sendText(WA, "✅ kaydedildi")
  //    - sendUrlButton(WA, sonraki magic link)
  //    - profiles.metadata.{flow}_finished_at = now
}
```

### 9) Onboarding flow'u register et

`src/platform/whatsapp/onboarding.ts` veya benzeri yerde:

```typescript
import { dentalOnboardingFlow } from "@/tenants/dental/onboarding-flow";
// ...
const FLOWS: Record<string, OnboardingFlow> = {
  emlak: emlakOnboardingFlow,
  // ...
  dental: dentalOnboardingFlow,
};
```

### 10) Cron'lar (opsiyonel, brifing varsa)

`src/app/api/cron/morning-briefing/route.ts` zaten tüm tenant'lar için ortak —
sadece tenant'a özel brifing içeriği eklemek için switch'e branch ekle:

```typescript
switch (profile.tenant_id) {
  case DENTAL_TENANT_ID:
    text = await buildDentalBriefing(profile);
    break;
}
```

Çok özel agent cycle gerekiyorsa `src/platform/agents/cycle.ts`'ye case ekle.

### 11) Dashboard route'u (opsiyonel, web panel görsellesi)

`src/app/[locale]/(dashboard)/dental/page.tsx` — dental kullanıcısının özel
panel sayfası. Çoğu tenant için minimum: stats grid + son işlemler tablosu.

### 12) Test

1. Lokal: `npm run dev`, supabase local DB ile veya prod ile (dikkat).
2. `tsc --noEmit` — type check geçsin.
3. `npm run build` — build hata vermesin.
4. Commit + push → Vercel auto-deploy.
5. `vercel ls` ile Ready bekle.
6. Test kullanıcısı ile WA'dan komut çalıştır.

### 13) Onboarding tarafından test

Yeni kullanıcı oluştur (admin invite ile), tenant_id'yi `dental` olarak set et,
WA'dan davet kodu mesajı gönder, onboarding adımlarını yürü, ilk komutu test et.

## Kontrol Listesi (PR / Deploy Öncesi)

- [ ] `tenants/{name}/onboarding-flow.ts` yazıldı, register edildi
- [ ] `tenants/{name}/commands/index.ts` ve handler'lar yazıldı, register edildi
- [ ] `tenants/config.ts` TENANTS registry'sine eklendi (UUID, slug, employees,
      commandMap, defaultFavorites)
- [ ] `router.ts` (veya types.ts'de TENANT_REGISTRIES) tenant kayıtlı
- [ ] DB migration yazıldı, prod'a uygulandı
- [ ] RLS policies tenant_id ile filtreleniyor
- [ ] tablo isimleri prefix'li (örn: `dnt_*`)
- [ ] Web form gerekiyorsa /tr/{flow}-form + /api/{flow}/save yazıldı
- [ ] After() pattern uygulandı (WA notify + sonraki link + idempotent flag)
- [ ] Brifing varsa cron route'una branch eklendi
- [ ] tsc + build geçti
- [ ] Vercel ready
- [ ] Test kullanıcısı ile end-to-end deneme yapıldı

## Sık Yapılan Hatalar

- ❌ tenant_id eklemeyi unutmak (tablo verisi sızar)
- ❌ Multi-step komutta `endSession` çağırmamak (eski state kalır)
- ❌ wa.me linkinde `?text=devam` (kullanıcı manuel yazıyor sandığı şey)
- ❌ Tablo prefix'i belirsiz (örn: `dental_dental_patients` veya prefix yok)
- ❌ Magic link TTL çok kısa veya yok (kullanıcı login'i kaybeder)
- ❌ `after()` içinde idempotent flag yazmamak (form 2 kere submit edilirse 2
  WA mesajı gider)
- ❌ Hobby plan'de yeni cron eklerken limit'e dikkat etmemek
- ❌ Migration'ı manuel uygulamamak (Vercel migration çalıştırmaz)

## Yardımcı Komutlar

```bash
# Yeni tenant'ın taslağını üretmek için (ileride scaffold scripti yazabiliriz):
ls src/tenants/emlak/  # şablon olarak

# Tenant ID üretmek (Supabase tenants tablosunda yeni kayıt):
SUPABASE_URL=... SERVICE_KEY=... \
  curl -X POST "$SUPABASE_URL/rest/v1/tenants" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dental Klinik","saas_type":"dental"}'

# Yeni komutu lokal test:
npm run dev
# Sonra ngrok ile dış URL → WA webhook'u oraya yönlendir → mesaj gönder

# Type check + build:
npm run typecheck && npm run build
```

## Sıradaki

→ İlk komutla başla, küçük çıktılarla kontrol et, kullanıcıya gösterip iterate
et. Tüm SaaS'ı tek seferde tamamlama → karşılaştırılabilir hata oluşturur.
