# BAYI SAAS — FOUNDATION AUDIT (gerçek kod kanıtı)

**Tarih:** 2026-06-02
**Repo:** `/home/cagr/Masaüstü/upu-platform`
**Branş:** `main` @ 481628f
**Kapsam:** 12 başlık × 236 alt madde, SaaS-grade architecture/security/db/backend/frontend/devops/monitoring/scalability/testing/docs/compliance/operational health
**Yöntem:** 4 paralel Explore agent (her biri 3 başlık), pazarlama yok — dosya/route/migration/satır kanıtı zorunlu

---

## Üst-düzey özet

| Başlık | 🟢 Var | 🟡 Kısmi | 🔴 Yok | Toplam | Risk |
|---|---:|---:|---:|---:|---|
| 1. Architecture & Design Patterns | 6 | 6 | 2 | 14 | 🟡 Orta |
| 2. Security | 5 | 7 | 16 | 28 | 🔴 Kritik |
| 3. Database Architecture | 8 | 8 | 10 | 26 | 🟡 Orta-Yüksek |
| 4. Backend Architecture | 9 | 6 | 3 | 18 | 🟡 Orta-Yüksek |
| 5. Frontend Architecture | 5 | 10 | 6 | 21 | 🔴 Yüksek |
| 6. DevOps & Deployment | 9 | 7 | 13 | 29 | 🔴 Yüksek |
| 7. Monitoring & Observability | 1 | 9 | 11 | 21 | 🔴 Kritik |
| 8. Scalability & Performance | 3 | 4 | 9 | 16 | 🔴 Yüksek |
| 9. Testing | 0 | 3 | 16 | 19 | 🔴 Kritik |
| 10. Documentation | 2 | 5 | 7 | 14 | 🟡 Orta |
| 11. Compliance & Regulatory | 5 | 6 | 5 | 16 | 🟡 Orta |
| 12. Operational Excellence | 0 | 3 | 11 | 14 | 🔴 Kritik |
| **TOPLAM** | **53** | **74** | **109** | **236** | — |

**Sağlık skoru: 22% 🟢 + 31% 🟡 + 46% 🔴 → ~46% baseline (kısmi'ler yarım sayılırsa)**

Production-blocker olan **5 başlık (Test, Ops, Monitoring, Security, CI/CD)** kritik kırmızı bandında.

---

## 1. ARCHITECTURE & DESIGN PATTERNS (6🟢 / 6🟡 / 2🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 1.1 | Monolith vs microservices | 🟢 | Next.js 16 tek app, `/api/*` route'lar uydu | — | — |
| 1.2 | Modüler folder structure | 🟢 | `src/platform/`, `src/tenants/{bayi,emlak,otel,restoran,site,muhasebe}/`, `src/app/api/` | — | — |
| 1.3 | Dependency injection | 🟡 | Hardcoded `getServiceClient()/getAnonClient()` import | DI container yok | düşük |
| 1.4 | SOLID prensipleri | 🟡 | 40 capability + position preset (OCP iyi); büyük auth dosyaları (SRP zayıf) | refactor (~100+ satır fonksiyonlar) | orta |
| 1.5 | DDD bounded context | 🟢 | tenants/* clear boundaries, aggregate root: profiles+capabilities | — | — |
| 1.6 | API versioning | 🔴 | `/v1` yok, Accept-Version header yok | URL/header versioning | orta |
| 1.7 | Error handling convention | 🟡 | `{ok:false, error, status}` consistent; custom error class yok | typed error enum | düşük |
| 1.8 | JWT vs session | 🟢 | `upu_session` HS256, HttpOnly/Secure/SameSite=Lax, 30g (`platform/auth/session.ts`) | — | — |
| 1.9 | Refresh token rotation | 🟢 | Cookie sliding window, `/me` basarsa uzar | — | — |
| 1.10 | Multi-tenant isolation | 🟢 | `middleware.ts:33` x-tenant-key, RLS 68 tablo | — | — |
| 1.11 | RBAC | 🟢 | `bayi/capabilities.ts` 40 cap + 8 position preset | — | — |
| 1.12 | ABAC | 🔴 | attribute-based (region/team) yok | ABAC engine | yüksek |
| 1.13 | SSO/OAuth2 | 🟡 | Google OAuth2 callback + Supabase PKCE | GitHub/Microsoft provider yok | düşük |
| 1.14 | 2FA/MFA | 🟢 | WA OTP + step-up cookie (10dk sensitive action) | TOTP alternative yok | düşük |

---

## 2. SECURITY (5🟢 / 7🟡 / 16🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 2.1 | HTTPS/TLS 1.2+ | 🟢 | Vercel default, `secure: NODE_ENV=production` cookie | — | — |
| 2.2 | CORS whitelist | 🔴 | `Access-Control-*` header yok | next.config.ts headers + middleware allowlist | orta |
| 2.3 | Rate limiting | 🟡 | OTP 3/phone, 5/IP, 5dk; lead 1/slug+phone 10dk; app-side only | Upstash/Redis endpoint-level RL | orta |
| 2.4 | API key management | 🟡 | env var (MOLLIE, CHIFT, ANTHROPIC); rotation/scoping yok | scoped key + rotation policy | orta |
| 2.5 | CSRF koruması | 🟢 | SameSite=Lax + POST guard | — | — |
| 2.6 | SQL injection | 🟢 | Supabase parametric `.eq()/.from()`; raw SQL yok | — | — |
| 2.7 | NoSQL injection | 🟢 | PostgreSQL only | N/A | — |
| 2.8 | XSS koruması | 🟡 | React auto-escape; `dangerouslySetInnerHTML` 6 yerde (controlled source) | review | düşük |
| 2.9 | OWASP Top 10 audit | 🔴 | eslint-plugin-security yok | SAST + manuel review | yüksek |
| 2.10 | Encryption at rest | 🔴 | pgcrypto EXTENSION yok; phone/email plaintext | sensitive kolon pgcrypto | orta |
| 2.11 | Encryption in transit | 🟢 | HTTPS | — | — |
| 2.12 | Password hashing | 🟢 | Supabase auth built-in bcrypt | — | — |
| 2.13 | API key hashing (DB) | 🔴 | env var plain | DB'de saklarsak hash | düşük |
| 2.14 | Sensitive data masking | 🔴 | log'larda phone/email plain | redaction filter | orta |
| 2.15 | Secrets management | 🟡 | Vercel env vars (managed); vault yok | OK (Vercel = managed) | düşük |
| 2.16 | DB backup encryption | 🟢 | Supabase managed AWS backup | — | — |
| 2.17 | GDPR (DPA/DSAR) | 🟡 | `/api/profile/data-export` Article 15 var; DPA yok | DPA + DSAR formal flow | yüksek |
| 2.18 | CCPA/POPIA | 🔴 | yok | N/A (TR/NL pazar) | — |
| 2.19 | Data residency | 🟡 | Supabase region check gerekli (.env) | EU region pin doğrula | düşük |
| 2.20 | Audit logs | 🔴 | `audit_log` feature flag var (Pro tier); `audit_logs` tablosu yok | tablo + trigger + middleware | yüksek |
| 2.21 | Privacy policy / ToS | 🟢 | `/privacy` + `/terms` i18n | — | — |
| 2.22 | PCI-DSS | 🟡 | Mollie tokenization (kart yerel'de yok) | SAQ-A self-assessment | düşük |
| 2.23 | Dependency scanning | 🔴 | npm audit/dependabot/snyk yok | CI integration | orta |
| 2.24 | SAST | 🔴 | sonarqube/codeql yok | CodeQL workflow | orta |
| 2.25 | DAST | 🔴 | zap/burp yok | DAST scan | yüksek |
| 2.26 | Pentest | 🔴 | yok | 3rd-party pentest €2-5k | yüksek |
| 2.27 | Vulnerability disclosure | 🔴 | `/security.txt` yok | RFC 9116 dosya + bug bounty | düşük |
| 2.28 | Security headers (CSP/HSTS/...) | 🔴 | next.config.ts `headers()` yok | CSP, X-Frame-Options, HSTS, Referrer-Policy | orta |

---

## 3. DATABASE ARCHITECTURE (8🟢 / 8🟡 / 10🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 3.1 | 3NF normalization | 🟢 | junction tables (bayi_dealers, otel_user_hotels); FK clean | — | — |
| 3.2 | UUID v4 PK | 🟢 | `gen_random_uuid() DEFAULT` 40+ tablo | — | — |
| 3.3 | FK constraints | 🟢 | CASCADE/SET NULL pattern tutarlı | — | — |
| 3.4 | Indexes | 🟢 | 155+ index, tenant_id+date composite, partial (is_active=TRUE) | — | — |
| 3.5 | Partitioning | 🔴 | tarih/tenant partition yok | büyük tablo partition planı | orta |
| 3.6 | Soft deletes | 🟢 | `deleted_at` pattern (`20260504110000_emlak_customers_soft_delete`) | — | — |
| 3.7 | Audit kolonlar | 🟢 | created_at/updated_at/created_by/updated_by 167+ tablo | trigger impl yok (manual insert) | düşük |
| 3.8 | Denormalization | 🟡 | daily_leads aggregate var (`20260424120000`); cache tablo sparse | materialized view review | orta |
| 3.9 | RLS aktif | 🟡 | 68 tablo policy (`20260601230742`); 16 migration RLS keyword | audit_log append-only policy yok | düşük |
| 3.10 | SELECT tenant_id filter | 🟢 | RLS gating + `eq("tenant_id", profile.tenant_id)` app-side | — | — |
| 3.11 | INSERT tenant_id auto-inject | 🟡 | app-side; trigger yok | DB trigger güvenlik katmanı | düşük |
| 3.12 | Cross-tenant leakage test | 🔴 | negatif test automation yok | RLS pen-test suite | yüksek |
| 3.13 | DB replication | 🔴 | Supabase replica config yok | read replica setup | düşük |
| 3.14 | Sharding | 🔴 | yok; 100+ tenant scale plan yok | plan dökümanı | düşük |
| 3.15 | Connection pooling | 🟢 | Supabase default pooler | pooler URL explicit | — |
| 3.16 | Query optimization | 🔴 | EXPLAIN ANALYZE izi yok | slow-query audit | orta |
| 3.17 | N+1 prevention | 🟡 | `safeCountQuery` pattern var; bazı loop SELECT'ler tespit edildi (bayi_churn) | join pattern audit | orta |
| 3.18 | Backup strategy | 🟢 | Supabase managed daily | retention/RTO doc yok | düşük |
| 3.19 | Restore drill | 🔴 | DR test yapılmamış | quarterly drill | yüksek |
| 3.20 | RTO/RPO target | 🔴 | dokümante değil | SLA doc | düşük |
| 3.21 | Geo-redundancy | 🔴 | tek region | multi-region | yüksek |
| 3.22 | Incremental backups | 🔴 | Supabase WAL default, explicit config yok | — | düşük |
| 3.23 | Migration version control | 🟢 | 63+ SQL file `supabase/migrations/`, timestamp prefix, git | — | — |
| 3.24 | Migration rollback | 🔴 | down.sql yok | revert script discipline | orta |
| 3.25 | Zero-downtime migration | 🟡 | `IF NOT EXISTS` pattern var; DROP COLUMN riski review yok | safe-migration playbook | orta |
| 3.26 | Staging migration test | 🔴 | staging Supabase project yok | ayrı staging env | yüksek |

---

## 4. BACKEND ARCHITECTURE (9🟢 / 6🟡 / 3🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 4.1 | RESTful convention | 🟢 | `/api/bayi-siparis/save`, `/list`, `/calendar/list` tutarlı | — | — |
| 4.2 | Pagination | 🟢 | `/api/notifications/list?offset=&limit=` (range); `.limit(200)` | cursor pattern yok | düşük |
| 4.3 | Filtering/sorting query | 🟢 | `?filter=all|today|week`, `.order()` | filter param doc | düşük |
| 4.4 | Response envelope standart | 🟢 | `{success, data}` / `{error, status}` consistent | unified ErrorCode enum yok | orta |
| 4.5 | OpenAPI/Swagger | 🔴 | spec dosya yok | API spec generation | yüksek |
| 4.6 | Webhooks + signature | 🟡 | Mollie + Chift webhook; token verify var | HMAC SHA-256 signature; retry queue | orta |
| 4.7 | Custom HTTP error kodları | 🟢 | 400/401/403/404/429 TR mesajla doğru kullanım | error code enum (DEALER_NOT_FOUND) | düşük |
| 4.8 | Structured logging | 🔴 | 304× raw `console.log/error` `/src/app/api`'de | pino/winston JSON logger | yüksek |
| 4.9 | User-friendly TR error | 🟢 | TR string: "Bayi seçmelisiniz", "En az bir ürün ekleyin" | — | — |
| 4.10 | Input validation (Zod) | 🟡 | Zod sadece `src/lib/validations/auth.ts`; route'larda manual `String()` coerce | tüm POST'larda Zod schema | orta |
| 4.11 | Service layer | 🟡 | `src/platform/*` utility-helper; route içinde DB query inline | controller→service→repo separation | orta |
| 4.12 | Repository pattern | 🔴 | `sb.from(...).select(...)` route içinde 80+ yerde | data-access layer | yüksek |
| 4.13 | DTO type | 🟡 | inline interface (BayiPanelLayout, RequestBody); dağınık | `/src/types/dto/` merkezi | orta |
| 4.14 | Transactions (BEGIN/COMMIT) | 🔴 | bayi-siparis/save order+items sequential, best-effort delete fallback | Supabase RPC transactional wrap | yüksek |
| 4.15 | Caching layer | 🟡 | Mollie singleton in-memory; Redis yok | Upstash Redis + invalidation | orta |
| 4.16 | Job queues | 🔴 | Bull/BullMQ/Inngest yok; cron route HTTP-trigger | async queue | yüksek |
| 4.17 | Retry logic | 🟡 | Mollie 24h retry; inline try-catch; generic helper yok | exp backoff helper | orta |
| 4.18 | Webhook HMAC signature | 🟡 | plain token match; HMAC-SHA256 yok | signed payload + timestamp nonce | yüksek |

---

## 5. FRONTEND ARCHITECTURE (5🟢 / 10🟡 / 6🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 5.1 | Component hierarchy | 🟡 | `src/components/{bayi,ui,agent,auth,banking,recommendations,tour}/` feature folder | strict atomic değil | düşük |
| 5.2 | State management | 🔴 | zustand/redux/jotai yok; sadece Context + useState | cross-feature state lib | orta |
| 5.3 | Custom hooks | 🟡 | `useIsMobileDevice` 1 hook; 138× useState inline | shared hooks koleksiyonu | orta |
| 5.4 | Utility functions | 🟢 | `cn()`, `panelFetch()`, deeplink helpers typed | — | — |
| 5.5 | TS strict mode | 🟢 | `tsconfig.json: "strict": true` | — | — |
| 5.6 | `any` kullanım oranı | 🟡 | 125× `: any` in 54 files (~2%) | sıfır-tolerans değil | düşük |
| 5.7 | No-any ESLint rule | 🔴 | `@typescript-eslint/no-explicit-any` yok | rule ekle | düşük |
| 5.8 | Shared types | 🟡 | `platform/*/types.ts` dağınık; `src/types/` index yok | merkezi tip dizini | düşük |
| 5.9 | Responsive design | 🟢 | Tailwind 4 + `md:/lg:/sm:` breakpoint kullanımı | — | — |
| 5.10 | A11y (ARIA) | 🟡 | semantic HTML var; aria-* attr neredeyse yok | jsx-a11y plugin + audit | orta |
| 5.11 | Keyboard navigation | 🟡 | shadcn button var; modal'larda div+onClick var | tab trap + focus mgmt | orta |
| 5.12 | Error boundaries | 🔴 | React ErrorBoundary / `error.tsx` yok | her route group `error.tsx` | yüksek |
| 5.13 | Loading states | 🟡 | Suspense 1 yer, `(site)/loading.tsx` var; 52 instance toplam | per-page loading.tsx | orta |
| 5.14 | Form validation | 🟡 | `react-hook-form` + `@hookform/resolvers` dep var; gerçek useForm import minimal | useForm + Zod resolver yaygınlaştır | orta |
| 5.15 | Optimistic updates | 🔴 | SWR/React-Query yok | mutate pattern | yüksek |
| 5.16 | Code splitting | 🔴 | `next/dynamic` / `React.lazy` 0 import | dynamic import per route | yüksek |
| 5.17 | Image optimization | 🟡 | `next/image` 1 yerde (UpuAgentWidget) | <img> → next/image migration | orta |
| 5.18 | CSS strategy | 🟢 | Tailwind 4 + PostCSS only | — | — |
| 5.19 | Bundle size monitoring | 🔴 | @next/bundle-analyzer yok | analyzer + CI | orta |
| 5.20 | Lazy loading | 🔴 | IntersectionObserver yok, `loading="lazy"` 1 yer | lazy list/component | orta |
| 5.21 | Memoization | 🟡 | useMemo/useCallback/React.memo 11 instance | over-render audit | düşük |

---

## 6. DEVOPS & DEPLOYMENT (9🟢 / 7🟡 / 13🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 6.1 | Git branching | 🟡 | `main` trunk; feature/develop branch convention yok | branching guideline doc | düşük |
| 6.2 | Branch protection / CODEOWNERS | 🔴 | `.github/` dizini boş | branch protection rules + CODEOWNERS | orta |
| 6.3 | Conventional commits | 🟢 | son 100 commit'in 99'unda feat/fix/chore prefix | — | — |
| 6.4 | Semver tagging | 🔴 | `git tag` boş; package.json 0.1.0 | release tag automation | düşük |
| 6.5 | Automated tests CI | 🔴 | test script yok; jest/vitest config yok | full test pipeline | yüksek |
| 6.6 | Linting CI | 🟡 | eslint ^9 + `lint` script; pre-commit hook yok | husky + lint-staged + CI step | düşük |
| 6.7 | TS compilation CI | 🟡 | tsc local OK; CI step yok | `tsc --noEmit` workflow | düşük |
| 6.8 | Security scan CI | 🔴 | npm audit / Snyk / CodeQL workflow yok | dependabot + CodeQL | orta |
| 6.9 | Build artifact | 🟢 | Vercel `.next/` artifact otomatik | — | — |
| 6.10 | Deployment automation | 🟢 | Vercel main push → auto-deploy | — | — |
| 6.11 | Environment ayrımı | 🟡 | `.env.local` + `.env.production.local`; staging ayrı project yok | staging Supabase + preview deployment | orta |
| 6.12 | Env parity (.env.example) | 🟡 | root'ta `.env.example` yok (tools/sahibinden-bridge'de var) | root template | düşük |
| 6.13 | Secrets per env | 🟢 | Vercel env vars per environment | — | — |
| 6.14 | IaC (Terraform) | 🔴 | yok | Terraform Supabase + Vercel | yüksek |
| 6.15 | Containerization | 🔴 | Dockerfile yok | docker-compose dev env | orta |
| 6.16 | Orchestration (k8s) | 🟢 | N/A (Vercel serverless) | — | — |
| 6.17 | Load balancing | 🟢 | Vercel auto LB | — | — |
| 6.18 | CDN | 🟢 | Vercel Edge Network default | — | — |
| 6.19 | DNS health | 🟡 | Vercel DNS; multi-DNS provider yok | Cloudflare secondary | düşük |
| 6.20 | Blue-green deployment | 🟢 | Vercel atomic deploy + rollback | — | — |
| 6.21 | Canary deployment | 🔴 | gradual % traffic yok | feature flag + canary | orta |
| 6.22 | Feature flags | 🔴 | LaunchDarkly/PostHog/GrowthBook yok | flag SDK + dashboard | orta |
| 6.23 | Rollback procedure | 🟡 | Vercel UI revert var; doc yok | RUNBOOK rollback bölümü | düşük |
| 6.24 | DB migration deploy ayrı | 🟡 | `supabase db push` manuel; CI step yok | pre-deploy migration job | düşük |
| 6.25 | HTTPS auto-renewal | 🟢 | Vercel + Let's Encrypt | — | — |
| 6.26 | Firewall | 🟡 | Vercel WAF rules yok | Vercel Security console | düşük |
| 6.27 | DDoS protection | 🟢 | Vercel default | — | — |
| 6.28 | Resource limits | 🟢 | `maxDuration` cron route'larda explicit (30-120s) | — | — |
| 6.29 | Auto-scaling | 🟢 | Vercel serverless otomatik | — | — |

---

## 7. MONITORING & OBSERVABILITY (1🟢 / 9🟡 / 11🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 7.1 | Centralized logging | 🟡 | Vercel Logs default; Datadog/Loki yok | Datadog/Loki | yüksek |
| 7.2 | Log levels | 🟡 | console.error/warn/log mix; logger lib yok | pino + level enum | orta |
| 7.3 | Structured JSON logs | 🔴 | plain string format | pino JSON | orta |
| 7.4 | Log retention 30-90g | 🟡 | Vercel default 3 gün | paid retention upgrade | düşük |
| 7.5 | Sensitive data filter | 🟡 | log'larda PII redact yok | redaction middleware | orta |
| 7.6 | Request/Trace ID | 🔴 | X-Request-Id middleware yok; OpenTelemetry yok | trace ID middleware | düşük |
| 7.7 | APM tool | 🔴 | Datadog/New Relic/Sentry yok | Datadog APM | yüksek |
| 7.8 | API response time | 🔴 | explicit dashboard yok | Vercel Speed Insights + Datadog | orta |
| 7.9 | DB query time | 🟡 | Supabase dashboard slow query log var (manuel) | slow-query alert | düşük |
| 7.10 | CPU/memory metric | 🟢 | Vercel serverless dashboard | — | — |
| 7.11 | Error rate metric | 🟡 | Vercel log grep mümkün; % tracking yok | Sentry/Datadog error rate | orta |
| 7.12 | Business metric | 🟡 | `platform_events` (logEvent) 7 event tipi; Metabase/PostHog yok | analytics dashboard | yüksek |
| 7.13 | Alert system | 🟡 | user-facing WA send var; ops alert yok (Slack/PagerDuty) | Datadog Slack alert | orta |
| 7.14 | Exception monitoring | 🔴 | Sentry SDK yok | Sentry kurulum | yüksek |
| 7.15 | Stack trace + repro | 🔴 | console.error mesaj + raw err; breadcrumb yok | Sentry breadcrumb | düşük |
| 7.16 | Error grouping | 🔴 | yok | Sentry default | düşük |
| 7.17 | Alert on new errors | 🔴 | yok | Sentry rule + Slack | düşük |
| 7.18 | Health endpoint | 🔴 | `/api/health` yok | DB+cron+ext-dep JSON | düşük |
| 7.19 | Synthetic monitoring | 🔴 | UptimeRobot/BetterUptime yok | uptime ping | düşük |
| 7.20 | Dependency uptime | 🟡 | Supabase/Meta/Anthropic status page sub yok | external status sub | düşük |
| 7.21 | Uptime SLA target | 🔴 | doc yok | 99.9% / 99.95% commitment | düşük |

---

## 8. SCALABILITY & PERFORMANCE (3🟢 / 4🟡 / 9🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 8.1 | Query optimization (EXPLAIN) | 🔴 | EXPLAIN izi yok | slow-query audit | orta |
| 8.2 | Connection pooling | 🟡 | Supabase JS client default | DATABASE_URL pooler explicit | düşük |
| 8.3 | Caching layer | 🟡 | Mollie singleton; Redis yok | Upstash KV + invalidation | orta |
| 8.4 | Read replicas | 🔴 | replica yok | Supabase Read Replica | düşük |
| 8.5 | API p95 <200ms target | 🟡 | Vercel Analytics p95 visible; SLO yok | Datadog SLO | düşük |
| 8.6 | Gzip/Brotli | 🟢 | Vercel default | — | — |
| 8.7 | ETag / Cache-Control | 🟡 | next.config.ts headers minimal | static asset headers | düşük |
| 8.8 | Request batching | 🔴 | loop'da SELECT * tespit | batch query helper | orta |
| 8.9 | Lighthouse >90 | 🔴 | CI Lighthouse audit yok | lighthouse-ci workflow | orta |
| 8.10 | Core Web Vitals | 🟡 | Vercel Speed Insights paket mevcut | dashboard enable + threshold | düşük |
| 8.11 | TTI<3s / FCP<1.8s target | 🔴 | budget doc yok | perf budget | düşük |
| 8.12 | Bundle analysis | 🔴 | bundle-analyzer yok | next.config plugin | düşük |
| 8.13 | Stateless servers | 🟢 | JWT cookie, no in-memory state | — | — |
| 8.14 | Load balancing | 🟢 | Vercel auto | — | — |
| 8.15 | Distributed cache | 🔴 | singleton in-memory yetersiz | Redis cluster | orta |
| 8.16 | DB replication | 🔴 | 8.4 ile aynı | read replica | düşük |

---

## 9. TESTING (0🟢 / 3🟡 / 16🔴) — 🔴 KRİTİK

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 9.1 | Unit test coverage | 🔴 | `package.json` test script yok; *.test.ts 0 | Jest/Vitest + coverage | 1-2g |
| 9.2 | Test framework | 🔴 | yok | Vitest + config | 4-6sa |
| 9.3 | Pure function test | 🔴 | utility test yok | unit suite | 1g |
| 9.4 | Mocking strategy | 🔴 | MSW/nock yok | mock layer | düşük |
| 9.5 | Integration test API | 🔴 | endpoint test yok | supertest suite | 1-2g |
| 9.6 | DB integration test | 🔴 | test DB seed yok | test schema + seed | düşük |
| 9.7 | 3rd party mock | 🔴 | WhatsApp/Anthropic/Mollie mock yok | msw handlers | orta |
| 9.8 | Test transaction rollback | 🔴 | yok | fixture teardown | düşük |
| 9.9 | E2E (Playwright/Cypress) | 🔴 | yok | Playwright + config | 4-6sa |
| 9.10 | Critical user journey | 🔴 | login/sipariş/kampanya E2E yok | 5-10 senaryo | 1-2g |
| 9.11 | Scheduled E2E (cron CI) | 🔴 | yok | GH Actions cron | düşük |
| 9.12 | Performance test | 🔴 | k6/autocannon yok | k6 baseline | düşük |
| 9.13 | Load test | 🔴 | yok | k6 ramp | düşük |
| 9.14 | Stress test | 🔴 | yok | k6 stress | düşük |
| 9.15 | Endurance test | 🔴 | yok | k6 24h | düşük |
| 9.16 | OWASP test (ZAP CI) | 🔴 | yok | ZAP baseline scan | orta |
| 9.17 | Auth test | 🟡 | `requireAuth` 236 endpoint'te; test yok | login flow test | düşük |
| 9.18 | Authz cross-tenant test | 🔴 | RLS test yok | leakage suite | yüksek (kritik) |
| 9.19 | Data validation test (Zod) | 🟡 | Zod dep var, schema test yok | 20-30 case | düşük |

---

## 10. DOCUMENTATION (2🟢 / 5🟡 / 7🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 10.1 | JSDoc/TSDoc | 🟢 | 712/883 dosyada başlık doc (~%80) | property doc | düşük |
| 10.2 | ADR | 🔴 | `docs/adr/` yok; `.planning/ARCHITECTURE.md` var | ADR template + 5 örnek | düşük |
| 10.3 | API docs (OpenAPI) | 🔴 | spec yok | route → spec generation | yüksek |
| 10.4 | DB ER diagram | 🔴 | `docs/erd.*` yok | dbdiagram/Miro export | düşük |
| 10.5 | Deployment guide | 🔴 | CLAUDE.md kısmi; `docs/deploy.md` yok | full runbook | düşük |
| 10.6 | Runbook | 🔴 | yok | incident playbook | düşük |
| 10.7 | Incident response | 🔴 | yok | SEV definitions + escalation | düşük |
| 10.8 | Security policy (SECURITY.md) | 🔴 | yok | RFC 9116 + disclosure | düşük |
| 10.9 | Release notes (CHANGELOG.md) | 🔴 | yok; v0.1.0 | semver + CHANGELOG | düşük |
| 10.10 | Local setup guide | 🟢 | README + CLAUDE.md | troubleshooting | düşük |
| 10.11 | Git workflow (CONTRIBUTING.md) | 🔴 | yok | branch + commit guideline | düşük |
| 10.12 | Code style guide | 🟡 | eslint.config.mjs Next.js default; .editorconfig/.prettierrc yok | prettier + editorconfig | düşük |
| 10.13 | Testing guide | 🔴 | test 0 olduğundan yok | test framework sonrası | bağımlı |
| 10.14 | Dependency mgmt guide | 🔴 | renovate/dependabot yok | dependabot.yml | düşük |

---

## 11. COMPLIANCE & REGULATORY (5🟢 / 6🟡 / 5🔴)

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 11.1 | Data classification (PII/PHI/PCI) | 🟡 | kvkk_consent_version kolon; schema PII tag yok | migration COMMENT | düşük |
| 11.2 | Data retention policy | 🔴 | retention_days kolon yok; cleanup cron yok | retention + cron | düşük |
| 11.3 | Right-to-be-forgotten | 🟢 | `/api/profile/data-export` Article 15; silme mailto | formal DELETE endpoint | düşük |
| 11.4 | Data portability | 🟢 | `/api/profile/data-export` multi-tenant JSON | otel/restoran/site tenant'lar ekle | düşük |
| 11.5 | PCI-DSS | 🟢 | Mollie tokenization (kart yerel'de yok) | SAQ-A self-assess | düşük |
| 11.6 | SOC 2 Type II | 🔴 | yok | 3rd-party audit €15-30k + 3-6 ay | büyük |
| 11.7 | Invoice tax compliance | 🟡 | VAT_RATES validation (0/1/9/10/20/21) urun-ekle | TR/NL VAT lookup tablosu | düşük |
| 11.8 | Refund policy | 🟢 | `iade-iptal/page.tsx` 9.8KB + koşullu banner | tenant-per-policy | düşük |
| 11.9 | WCAG 2.1 AA | 🔴 | axe-core yok | axe-core + Lighthouse CI | orta |
| 11.10 | Screen reader | 🟡 | semantic HTML; aria-label limited | aria coverage audit | orta |
| 11.11 | Keyboard nav (skip-to-content) | 🔴 | skip link yok | skip link + focus trap | düşük |
| 11.12 | Color contrast | 🟡 | Tailwind 4; contrast doğrulama yok | contrast checker | düşük |
| 11.13 | GDPR DPA | 🔴 | hukuk doc yok | hukuk müşaviri €2-3k | düşük |
| 11.14 | Privacy policy | 🟢 | `privacy/page.tsx` i18n tr/en/nl + GDPR mention | bayi-specific | düşük |
| 11.15 | ToS | 🟢 | `hizmet-sartlari/page.tsx` + `terms/` | multi-tenant ToS | düşük |
| 11.16 | KVKK consent | 🟢 | `kvkk_consent_version` tracking + login modal; `aydinlatma-metni` i18n | consent bump notif | düşük |

---

## 12. OPERATIONAL EXCELLENCE (0🟢 / 3🟡 / 11🔴) — 🔴 KRİTİK

| # | Madde | Durum | Kanıt | Eksik | Efor |
|---|---|---|---|---|---|
| 12.1 | On-call rotation | 🔴 | yok | rota tanımı | düşük |
| 12.2 | Severity levels | 🔴 | SEV-1..4 def yok | doc | düşük |
| 12.3 | Post-mortem template | 🔴 | yok | template + retrospective process | düşük |
| 12.4 | Code review checklist | 🔴 | `.github/PULL_REQUEST_TEMPLATE.md` yok | PR template | düşük |
| 12.5 | Tech debt tracking | 🟡 | 3× TODO/FIXME grep (billing/current, destek/create, bayi-baglanti) | backlog | düşük |
| 12.6 | MTTR target | 🔴 | doc yok | SLA <30dk SEV-1 | düşük |
| 12.7 | MTTF target | 🔴 | doc yok | reliability metrik | düşük |
| 12.8 | Failover testing (quarterly) | 🔴 | yok | DR drill schedule | orta |
| 12.9 | Communication plan | 🔴 | yok | status page + Slack | düşük |
| 12.10 | Status page | 🔴 | status.upudev.nl yok | uptime dashboard | düşük |
| 12.11 | Infrastructure cost tracking | 🟡 | Vercel + Supabase managed; alert yok | billing alert | düşük |
| 12.12 | DB cost tracking | 🟡 | Supabase project linked; alert yok | usage alert | düşük |
| 12.13 | API cost (Anthropic per tenant) | 🟡 | `agent_quotas` + `agent_usage_events` tablo; invoice yok | tenant invoice çıkış | düşük |
| 12.14 | Reserved capacity | 🔴 | shared plan | reserved decision | düşük |

---

## En kritik 5 boşluk — production-blocker

| Sıra | Boşluk | Neden production-blocker | Efor |
|---|---|---|---|
| 1 | **9.18 Authz cross-tenant test + RLS leakage suite** | Bir tenant'ın başka tenant'ın verisini çekebilme riski test edilmemiş. Bir leak = SaaS sonu. | 1-2g + ekip review |
| 2 | **7.14 + 7.18 Exception monitoring (Sentry) + health endpoint** | Şu an outage'ı kullanıcı bildirim verene kadar göremiyoruz. Vercel logs alarmsız. | 1g |
| 3 | **6.5 + 6.8 CI/CD pipeline (test + lint + security scan)** | `.github/workflows/` boş. Her commit lint/test/audit'siz prod'a gidebiliyor. | 1g |
| 4 | **2.28 Security headers (CSP/HSTS/X-Frame-Options)** | `next.config.ts headers()` yok. XSS/clickjacking koruması yok. Tek dosyalık fix. | 2-4sa |
| 5 | **2.20 Audit logs (tablo + middleware)** | Pro tier feature flag'i var ama gerçek `audit_logs` tablosu/trigger yok. Ne kim ne yapmış izlenmiyor. | 1-2g |

(Yan-kritik): 4.14 Transaction atomicity (sipariş+kalemler), 4.18 Webhook HMAC, 5.12 Error boundaries.

---

## Sprint önerisi (4-5 hafta)

### Sprint 1 — Güvenlik tabanı (1 hafta, ~32 sa)
- 2.28 Security headers (next.config.ts)
- 2.23/2.24 npm audit + CodeQL workflow
- 6.5/6.6/6.7 CI pipeline (lint + tsc + vitest stub)
- 6.2 Branch protection + CODEOWNERS
- 7.18 `/api/health` endpoint

### Sprint 2 — Observability (1 hafta, ~32 sa)
- 7.14 Sentry SDK + breadcrumb context
- 7.13 Ops alert (Slack webhook)
- 7.6 X-Request-Id middleware
- 7.3 pino structured JSON logger
- 7.19 UptimeRobot health ping

### Sprint 3 — Test omurgası (2 hafta, ~80 sa)
- 9.1/9.2 Vitest + config + coverage
- 9.18 RLS cross-tenant leakage test suite (KRİTİK)
- 9.10 Playwright + 5 critical user journey (login/sipariş/kampanya/davet/profil)
- 9.5 API integration test (top 20 endpoint)
- 9.19 Zod schema test

### Sprint 4 — Veri güvenliği + audit (1 hafta, ~32 sa)
- 2.20 `audit_logs` tablo + trigger + middleware
- 4.14 Supabase RPC transaction wrap (sipariş+kalemler)
- 4.18 Webhook HMAC-SHA256 signature
- 11.2 Data retention policy + cleanup cron
- 11.13 GDPR DPA template (hukuk koordinasyonu)

### Sprint 5 — Operasyonel runbook (1 hafta, ~20 sa)
- 10.5/10.6 Deployment guide + runbook
- 12.1/12.2/12.3 On-call rotation + SEV tanımları + post-mortem template
- 12.10 Status page (BetterStack/Statuspage)
- 10.8 SECURITY.md + 10.9 CHANGELOG.md + 10.11 CONTRIBUTING.md

**Toplam:** ~200 saat (~25 insan-gün), 4-5 hafta 1 dev ya da 2-3 hafta 2 dev.

---

## Notlar

- Vercel/Next.js default'ları çoğu DevOps maddesini "ücretsiz" hallediyor (CDN, blue-green, HTTPS, scale, load-balance). Tasarım kararı değil, vendor lock-in farkındalığı.
- Supabase managed → backup, pooling, RLS, encryption-at-rest, EU region native. DR drill ve geo-redundancy gerek görüldüğünde aktif edilebilir.
- En zayıf 3 başlık (Test, Ops, Monitoring) birbirine bağımlı: outage'ı tespit edemezsek (Mon), düzeltemeyiz (Ops), regress'ı yakalayamayız (Test). Sprint 1-2-3 birlikte gitmeli.
- KVKK/GDPR temelli (consent, export, policy) hazır; eksik olan formal hukuk dokümanları (DPA) ve audit log.
- Bu rapor `BAYI-MODULE-AUDIT-2026-06-02.md` (10 modüllü işlev audit) ile birlikte okunmalı — bu mimari sağlık, o işlevsel kapsama.
