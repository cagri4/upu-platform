# upu-platform — Mimari

Bu dosya yüksek seviye mimarinin kalıcı tanımı. Yeni Claude oturumu burayı
okuduktan sonra SAAS-INVENTORY.md'ye geçer.

## 1) Ne yapıyoruz?

upu-platform, sektör bazlı **SaaS dikey** bir multi-tenant platformudur. Her
sektörün (emlak, bayi, otel, market, muhasebe, siteyonetim) kendi sanal ofis
ekibi, AI asistanı, komut paleti var. Kullanıcı **WhatsApp** üzerinden
bot'la konuşarak işini yapar; ağır UI gereken işleri **web panel** açarak
yapar; 3. parti sitelerle (sahibinden, Funda, vb.) **Chrome uzantısı**
köprülenir.

## 2) 3 Kanal Mimarisi

```
┌──────────────┐         ┌──────────────────────┐        ┌──────────────────┐
│   WhatsApp   │ <────>  │   upu-platform       │ <────> │  3. parti site   │
│  (kumanda)   │         │   Next.js + Supabase │        │  (sahibinden,    │
│              │         │                      │        │   Funda vb.)     │
└──────────────┘         │   Web Panel (kokpit) │        └──────────────────┘
                         │   /tr/{flow}-form    │              ▲
                         └──────────────────────┘              │
                                                  ┌────────────┴───────┐
                                                  │   Chrome Extension │
                                                  │  (3. parti köprü)  │
                                                  └────────────────────┘
```

**A) WhatsApp** = uzaktan kumanda. Kısa metin, butonlar, listeler. Komut
   tetikler, durum sorgular.

**B) Web Panel** (`/tr/{flow}-form` sayfaları) = kokpit. Foto upload, slayt
   düzenleme, profil bilgileri, müşteri formu gibi UI gereken her şey burda.
   Magic link ile giriş.

**C) Chrome Extension** = 3. parti site köprüsü. Sahibinden gibi sitelerin
   form alanlarını otomatik doldurur. extension_tokens tablosunda 6-hex
   eşleşme kodu ile pair edilir.

## 3) Klasör Yapısı

```
src/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # i18n (tr/en/nl)
│   │   ├── (admin)/             # admin dashboard
│   │   ├── (auth)/              # login/register
│   │   ├── (dashboard)/         # web panel (giriş yapan kullanıcı)
│   │   ├── (marketing)/         # landing pages
│   │   ├── ara/                 # arama sayfası
│   │   ├── mulkekle-form/       # mülk ekle formu (web panel)
│   │   ├── mulklerim/           # mülklerim listesi
│   │   ├── musteri-ekle-form/   # müşteri ekle formu
│   │   ├── profil-duzenle/      # profil düzenleme formu
│   │   ├── sunum/[id]/          # sunum detay/edit
│   │   ├── sunumlarim/          # sunum listesi
│   │   ├── takip/               # takip kur formu
│   │   ├── web-sayfam/          # kişisel web sayfa kurulumu
│   │   └── sign/[token]/        # sözleşme imza sayfası (token ile)
│   ├── api/                      # API endpoints
│   │   ├── ara/                 # arama API
│   │   ├── musteri/save/        # müşteri kaydı + WA chain
│   │   ├── mulkekle/            # mülk kaydı + sunum üretimi
│   │   ├── mulklerim/finish/    # WA'a Dön → sonraki flow
│   │   ├── profilduzenle/save/  # profil kaydı + web sayfası link
│   │   ├── websayfam/finish/    # web sayfa hazır + sahibinden uzantı kurulum
│   │   ├── sunum/finish/        # sunum tamam → mülklerim link
│   │   ├── sign/                # sözleşme imza
│   │   ├── contracts/[id]/pdf/  # sözleşme PDF
│   │   ├── extension/           # Chrome uzantısı endpoint'leri
│   │   ├── cron/                # cron'lar (admin-alerts, tracking-notify, vb.)
│   │   ├── admin/               # admin endpoint'leri (scrape-alert, insight)
│   │   └── whatsapp/route.ts    # WA webhook (mesajları router'a yönlendirir)
│   └── u/[slug]/                # public landing /u/{slug}
│
├── platform/                     # paylaşılan altyapı (cross-tenant)
│   ├── whatsapp/
│   │   ├── router.ts            # KÖŞE TAŞI: gelen mesajı tenant + komuta yönlendirir
│   │   ├── send.ts              # sendText, sendButtons, sendList, sendUrlButton, sendNavFooter
│   │   ├── session.ts           # command_sessions CRUD (multi-step komut)
│   │   ├── onboarding.ts        # onboarding adım yöneticisi
│   │   ├── intro.ts             # yeni kullanıcı intro flow (demo zinciri)
│   │   ├── photo-upload.ts      # WA'dan foto alma
│   │   ├── error-handler.ts     # hata yakalama + platform_events log
│   │   └── types.ts             # WaContext tipi
│   ├── auth/
│   │   └── supabase.ts          # getServiceClient() — RLS bypass server client
│   ├── agents/                  # AI agent framework (V2)
│   │   ├── engine.ts            # tool-using agent loop
│   │   ├── memory.ts            # agent memory (DB)
│   │   ├── tools.ts             # tool registry
│   │   └── cycle.ts             # daily/hourly agent run
│   ├── ai/                      # Anthropic SDK wrapper, prompt building
│   ├── analytics/               # platform_events kaydı
│   ├── admin/
│   │   └── commands.ts          # ADMIN_PHONE, sendAdminAlert
│   ├── cron/                    # cron yardımcıları
│   ├── i18n/                    # next-intl entegrasyonu
│   ├── scraping/                # scrape yardımcıları (cookie, proxy)
│   └── tips/                    # Tips sistemi (her SaaS için)
│
├── tenants/                      # SaaS dikey kodu
│   ├── config.ts                # KÖŞE TAŞI: TENANTS registry (tenantId, slug,
│   │                              employees, commands)
│   ├── emlak/
│   │   ├── commands/            # 22+ komut handler'ı
│   │   ├── agents/              # V2 agent dosyaları
│   │   └── onboarding-flow.ts   # onboarding adımları
│   ├── bayi/, otel/, market/, muhasebe/, siteyonetim/
│   └── (her biri aynı yapı: commands/, agents/, onboarding-flow.ts)
│
└── (kalan: components, hooks, lib, vb.)
```

## 4) Veri Akışı — WhatsApp mesajı geldiğinde

```
1. WA webhook → /api/whatsapp/route.ts
2. → router.ts handleMessage(ctx)
3. → ctx.tenant_id'ye göre tenants/{name}/commands/index.ts'den handler bul
4. → handler çalışır (sendText/sendButtons/sendList ile cevap)
5. → multi-step ise updateSession; tek-shot ise endSession
6. → platform_events tablosuna log
```

## 5) Veri Akışı — Web Form save edildiğinde

```
1. Kullanıcı /tr/{flow}-form'da Submit
2. POST /api/{flow}/save { token, ...data }
3. magic_link_tokens validate (24h)
4. DB'ye yaz (emlak_properties, emlak_customers, vb.)
5. NextResponse return (form kullanıcıya success cevabı verir, sayfayı kapatır
   veya WA'ya Dön ekranı gösterir)
6. after() içinde:
   - sendText(WA, "✅ kaydedildi")
   - sendUrlButton(WA, sonraki magic link)
   - profiles.metadata.<flow>_finished_at = now (idempotent flag)
```

## 6) Tenant Routing

**Domain-based.** middleware.ts gelen domain'e bakar, TENANTS registry'den tenant_id'yi
çıkarır:

| Domain                  | Tenant       |
|-------------------------|--------------|
| estateai.upudev.nl      | emlak        |
| retailai.upudev.nl      | bayi         |
| ...                     | ...          |
| adminpanel.upudev.nl    | super admin (cross-tenant) |

config.ts içinde her tenant'ın `slug` alanı subdomain'e karşılık gelir.

WhatsApp'ta tenant tespiti farklı: kullanıcının `profiles.tenant_id`'sine bakılır.
Tenant değiştirme için "switch" callback (router.ts içinde, line ~60).

## 7) AI Agent Framework (V2)

`platform/agents/` altında tool-using AI agent loop. Tenant'lar
`tenants/{name}/agents/` altında kendi agent'larını yazar (örn:
`siteyonetim/agents/hukuk.ts`, `muhasebe/agents/fatura-uzmani.ts`).

- **engine.ts** — agent loop (Anthropic API + tool calling)
- **tools.ts** — built-in tool'lar (DB query, sendMessage, vb.)
- **memory.ts** — agent_memories tablosu (long-term)
- **cycle.ts** — periyodik agent çalıştırma (cron)

V2 agent'lar genellikle uzun running, complex domain task'ları için (örn:
fatura analizi, hukuki danışma, satış öneri).

## 8) Database

- **Supabase** (PostgreSQL + PostgREST + Storage)
- Service role key server-side, anon key client-side
- Storage bucket'ları: `property-photos`, `profile/`
- RLS policies tenant_id ile filtreleme yapar
- Migration'lar `supabase/migrations/` altında (manuel uygulama, vercel'de
  otomatik değil — supabase CLI ile)

## 9) Cron'lar

| Cron                            | Sıklık                  | Amaç                                |
|---------------------------------|-------------------------|-------------------------------------|
| `daily-scrape.sh part1/2/3`     | 03:00, 04:30, 06:00     | sahibinden ilan çekme               |
| `monitor-scrape.sh`             | (each part sonunda)     | 5-imza bug detection                |
| `/api/cron/admin-alerts`        | saatlik + sabah özet    | yeni kayıt + hata spike + günlük    |
| `/api/cron/tracking-notify`     | 06:45                   | günlük takip brifingi (emlak)       |
| `/api/cron/morning-briefing`    | sabah                   | tenant brifingleri (genel)          |
| `/api/cron/agent-run`           | saatlik veya günlük     | V2 agent cycle                      |
| `/api/cron/tips`                | günlük                  | Tips push                           |

Hobby plan limit: vercel cron'ları sayılı. Yeni cron eklenmeden önce karar.

## 10) Deployment

- **Vercel** — Hobby plan, auto-deploy `main` branch
- **Domain'ler:**
  - estateai.upudev.nl (emlak ana site)
  - adminpanel.upudev.nl (super admin)
  - retailai/otelai/vb. (diğer SaaS subdomain'leri)
- **Env'ler:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
  WHATSAPP_TOKEN, WHATSAPP_PHONE, ADMIN_PHONE, CRON_SECRET, vb.
- Push → ~50s build → prod. `vercel ls` ile doğrula.

## 11) WhatsApp Bot Numarası

Tek numara: **31644967207** (Hollanda) — tüm SaaS dikeyleri için aynı bot. Tenant
routing user'ın WA numarasına ve profiles.tenant_id'ye göre.

## 12) Önemli Diller

- TypeScript (strict mode), Next.js App Router, Tailwind CSS
- next-intl (TR / EN / NL)
- Anthropic SDK (claude-opus, claude-sonnet)
- Supabase JS client + REST API doğrudan
- Puppeteer (sahibinden scrape)

## Sıradaki Doküman

→ `SAAS-INVENTORY.md` — her SaaS dikeyin ne yaptığı + komut listesi + DB
tabloları
