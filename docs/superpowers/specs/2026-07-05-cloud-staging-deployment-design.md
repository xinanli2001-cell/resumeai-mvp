# Cloud Staging Deployment Design

Date: 2026-07-05
Status: Proposed for Plan 7
Product area: ResumeAI pilot launch

## 1. Recommendation

Cloud deployment is the right next step. Plans 1-6 prove the product loop locally; the next meaningful risk is whether first testers can access a stable URL, use real LLM rewriting, export PDFs, and leave data in a recoverable database.

Plan 7 should deploy a staging environment before a public production launch.

Recommended target shape:

- One long-running Node.js web service.
- One managed PostgreSQL database.
- HTTPS on a generated or custom domain.
- Production-like environment variables.
- Real DeepSeek provider for pilot tests.
- Manual or provider-managed daily database backups.

This should not start with Vercel/serverless or multi-instance scaling. The current app uses an in-memory per-user rate limiter for LLM routes; that is acceptable for a single-instance pilot but not reliable across multiple stateless instances. A single-instance PaaS or small VM-style deployment is therefore the safer first cloud step.

## 2. Goals

- Make ResumeAI reachable by first testers through a cloud URL.
- Run against PostgreSQL, not SQLite.
- Exercise production config validation, security headers, health checks, LLM provider, database migrations, seed, backup, and PDF export in a cloud-like setting.
- Produce a repeatable runbook so deployment is not tribal knowledge.
- Keep scope tight: staging first, no payments, no scoring, no template marketplace.

## 3. Non-Goals

- No public launch or paid users.
- No multi-region or multi-instance architecture.
- No Redis rate limiter yet.
- No object storage or file upload pipeline.
- No payment/subscription work.
- No resume scoring.
- No Word/PDF template upload parsing.

## 4. Deployment Architecture

```text
Tester browser
  -> HTTPS cloud URL
  -> Single Node.js Next server
  -> Prisma Client
  -> Managed PostgreSQL
  -> DeepSeek API for LLM actions
```

The app should be deployed as a single web service that runs:

```bash
pnpm install --frozen-lockfile
pnpm db:generate:prod
pnpm build
pnpm db:migrate:prod
pnpm db:seed
pnpm start
```

Exact command wiring can vary by hosting provider, but the runbook must define which commands run at build time and which run at release/start time.

## 5. Prisma Production Schema Strategy

The repository keeps `web/prisma/schema.prisma` as SQLite for local development. For cloud PostgreSQL, Plan 7 should add a generated production schema path instead of asking developers to hand-edit the datasource provider.

Add a script:

```text
web/scripts/create-postgres-schema.ts
```

It reads `prisma/schema.prisma`, replaces only:

```prisma
provider = "sqlite"
```

with:

```prisma
provider = "postgresql"
```

and writes:

```text
web/prisma/generated/schema.postgres.prisma
```

Then add scripts:

```json
"db:generate:prod": "tsx scripts/create-postgres-schema.ts && prisma generate --schema prisma/generated/schema.postgres.prisma",
"db:migrate:prod": "tsx scripts/create-postgres-schema.ts && prisma migrate deploy --schema prisma/generated/schema.postgres.prisma"
```

This keeps local SQLite development unchanged while making cloud deploy commands concrete and repeatable.

## 6. Staging Environment Variables

Staging must define:

```dotenv
NODE_ENV="production"
APP_ENV="staging"
DATABASE_URL="postgresql://..."
SESSION_SECRET="<48+ random base64 chars>"
LLM_PROVIDER="deepseek"
DEEPSEEK_API_KEY="<staging key>"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
LLM_RATE_LIMIT_PER_MINUTE="10"
MAX_TEXT_BYTES="20000"
ADMIN_EMAIL="<staging admin email>"
ADMIN_PASSWORD="<strong staging password>"
```

Production config validation should fail fast if `SESSION_SECRET` is weak or the DeepSeek key is missing.

## 7. Cloud Smoke Test

After deployment, run a smoke script against the staging URL:

```bash
STAGING_BASE_URL="https://..." pnpm smoke:staging
```

The smoke should verify:

- `GET /api/health` returns `200`.
- Security headers include `x-frame-options`, `x-content-type-options`, and `content-security-policy`.
- The login page is reachable.
- The app redirects unauthenticated `/library` access to login.

Manual pilot smoke should then run the full user script from `web/docs/pilot-readiness.md`: register, add library data, parse JD, rewrite, edit resume, add another library experience, export PDF.

## 8. Backup and Rollback

Before pilot use:

- Confirm the managed PostgreSQL provider has snapshots or backups enabled.
- Run `pnpm db:backup` and confirm it prints a valid `pg_dump` command for the staging `DATABASE_URL`.
- Document restore steps for the chosen provider.

Rollback for Plan 7 is operational:

- Revert the web service to the previous git commit.
- Keep the database unless a migration is proven harmful.
- If data migration damage occurs, restore from the latest snapshot/dump.

Plan 7 should avoid schema model changes beyond generating a Postgres schema copy, so rollback risk is mostly deployment configuration.

## 9. Acceptance

Plan 7 is complete when:

- Cloud deployment runbook exists.
- Production Prisma schema generation is scripted and tested.
- Staging smoke script exists and passes against a configured `STAGING_BASE_URL`.
- Release checklist reflects Plan 5 PDF and Plan 7 staging gates.
- The four local gates still pass.
- A human can follow the runbook from fresh cloud service + database to a working staging URL.
