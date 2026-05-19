# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
```

No test framework is configured. No ORM — Supabase JS client direct access.

## Database Migrations

Migrations live in `supabase/migrations/` and are applied via Supabase CLI to the linked project (`eodjowwdhsircwebxcmh`).

**File location**: `supabase/migrations/YYYYMMDDHHMMSS_kebab_name.sql` — NOT `.planning/migrations/` (that folder is for planning notes only, won't be applied)

**Naming**: 14-digit timestamp prefix (e.g., `20260519120000_distributor_slugs.sql`). Use `date "+%Y%m%d%H%M%S"` to generate.

**Apply**: From repo root, run `supabase db push` — it auto-detects new files and applies to production. No interactive prompt in CI mode.

**Workflow when YOU (Claude) need a schema change**:
1. Write the SQL file directly in `supabase/migrations/` (correct filename format)
2. Run `supabase db push` to apply
3. `git add supabase/migrations/<file>.sql && git commit -m "chore(db): ..."` and push
4. If another worker (emlak/bayi/etc.) is editing the same repo in parallel, mention in your report so they `git pull` before next commit

**Safety rules**:
- Prefer additive changes: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- AVOID `DROP TABLE`, `DROP COLUMN`, destructive `ALTER` — production data loss
- For renames/drops, ask user explicit approval first (links to "Never modify user data" rule)
- Test SQL locally if possible before push (or in supabase SQL Editor sandbox)

**Do not** ask the user to "apply this migration" — apply it yourself. The CLI is installed at `/usr/local/bin/supabase` and the project is already linked.

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

## Rules

- **Never guess commands**: Don't make up CLI flags or options. Check docs or say "bilmiyorum".
- **Verify before proposing**: Check technical feasibility BEFORE presenting a solution as viable. Don't propose something and then discover it's not possible.
- **Think before responding**: Don't rush with reflexive answers. 2 saniye düşün. Consider the implications.
- **Never modify user data without permission**: NEVER run UPDATE/DELETE on user data (profiles, roles, permissions, invite_codes, etc.) without explicit user approval. Only SELECT queries are allowed without asking.
