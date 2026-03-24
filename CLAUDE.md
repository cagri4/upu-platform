# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
```

No test framework is configured. No ORM or migration tooling — schema is managed in Supabase dashboard.

## Architecture

**Multi-tenant WhatsApp-powered SaaS platform** built on Next.js 16, React 19, Supabase, and Tailwind CSS 4. Each tenant (emlak, bayi, muhasebe, otel, siteyonetim) is a vertical SaaS with its own WhatsApp command set managed by "virtual employees."

### Tenant Resolution Flow

1. Request arrives → `middleware.ts` reads hostname
2. `src/tenants/config.ts` DOMAIN_MAP resolves hostname → tenant key
3. Middleware sets `x-tenant-key`, `x-tenant-id`, `x-is-admin` headers
4. If no locale prefix in path, redirects to `/tr/...` (default Turkish)

Localhost maps to `emlak` tenant. Admin panel is on `adminpanel.upudev.nl`.

### WhatsApp Command Pipeline

```
Meta WhatsApp API → upu-whatsapp-gateway (separate repo) → POST /api/whatsapp
```

The gateway is a separate service that routes messages by phone number to tenant webhooks. This repo handles the platform side:

- `src/platform/whatsapp/router.ts` — Main dispatcher: checks sessions → callbacks → text commands → tenant registry
- `src/platform/whatsapp/session.ts` — Multi-step command state (stored in `command_sessions` table)
- `src/platform/whatsapp/send.ts` — Helpers: `sendText()`, `sendButtons()`, `sendList()`, `sendDocument()`, `markAsRead()`
- `src/platform/whatsapp/placeholder.ts` — Factory for "coming soon" placeholder commands

### Adding a New Tenant

Follow `SAAS-ONBOARDING-GUIDE.md`. Key steps: add config to `src/tenants/config.ts`, create `src/tenants/<key>/commands/index.ts` with command registry, register domain in DOMAIN_MAP.

### Key Directories

- `src/tenants/<key>/commands/` — Tenant-specific WhatsApp command handlers
- `src/platform/` — Shared modules: auth (Supabase clients), i18n (next-intl), whatsapp
- `src/app/[locale]/` — Locale-prefixed App Router pages
- `src/app/api/` — API routes (auth, admin, billing, dashboard, whatsapp webhook)
- `src/components/ui/` — shadcn/ui components (base-nova style)

### Data Access

All DB access via Supabase JS client — no ORM. Two clients:
- `getServiceClient()` — Service role, for API routes (bypasses RLS)
- `getAnonClient()` — Anon key, for browser/server components (respects RLS)

### Conventions

- Commands and aliases are in Turkish: `portfoyum`, `musterilerim`, `fiyatsor`
- Cancel keywords for sessions: `iptal`, `vazgeç`
- Invite codes are 6-char hex (e.g., `A1B2C3`), generated in admin panel
- Locales: tr (default), en, nl — managed by next-intl
- Path alias: `@/*` → `src/*`
- Deployed on Vercel with auto-deploy from GitHub
