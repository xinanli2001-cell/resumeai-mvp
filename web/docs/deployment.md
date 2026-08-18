# ResumeAI Deployment Guide

This app keeps SQLite for local development. Production should use PostgreSQL with the same Prisma models.

## Required Environment

Set these variables before build/start:

```dotenv
NODE_ENV="production"
APP_ENV="production"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
SESSION_SECRET="<at least 32 random characters>"
LLM_PROVIDER="openai"
OPENAI_API_KEY="<production key>"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-5.6"
LLM_RATE_LIMIT_PER_MINUTE="10"
MAX_TEXT_BYTES="20000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="<strong bootstrap password>"
```

Generate a strong session secret with:

```bash
openssl rand -base64 48
```

The app validates production configuration at startup. Production fails fast when `SESSION_SECRET` is shorter than 32 characters, or when `LLM_PROVIDER=openai` is configured without `OPENAI_API_KEY`.

## PostgreSQL Datasource Path

Local development keeps `prisma/schema.prisma` on SQLite. Production and staging use a generated PostgreSQL schema:

```bash
pnpm db:generate:prod
```

This writes `prisma/generated/schema.postgres.prisma` with only the datasource provider switched to PostgreSQL. The models use Prisma `String`, enums, relations, and `Json` fields and do not depend on SQLite-only column types.

Apply production migrations with:

```bash
pnpm db:migrate:prod
```

For the temporary free Render staging trial, use:

```bash
pnpm db:push:prod
```

Do not use `pnpm db:push:prod` for a durable production launch; create a proper PostgreSQL migration history first. Do not edit the datasource provider by hand, and do not use `scripts/sqlite-migrate.ts` in production. That script is only for the local SQLite development database.

## Build And Start

```bash
pnpm install --frozen-lockfile
pnpm db:generate:prod
pnpm build
pnpm db:migrate:prod
pnpm db:seed
pnpm start
```

`pnpm db:seed` is idempotent for the admin account and system templates. Set a strong `ADMIN_PASSWORD` for the first production seed.

For the first managed PostgreSQL staging deployment, follow `docs/cloud-staging-runbook.md`.

## Security And Rate Limiting

The app sets security headers through `middleware.ts`: content type nosniff, frame deny, referrer policy, CSP, and production HSTS.

Cost-bearing LLM routes are protected by an in-memory per-user rate limiter. This is acceptable for a single-instance MVP deployment. For horizontal scaling, replace the in-process store in `src/lib/security/rate-limit.ts` with a shared store such as Redis.

## Health Check

Use:

```bash
curl https://YOUR_HOST/api/health
```

Expected response:

```json
{"status":"ok","appEnv":"production"}
```

The endpoint performs a trivial database round-trip and returns `503` if the database is unreachable.

## Backups

Recommended cadence:

- SQLite development/pilot: copy before every release and daily during active use.
- PostgreSQL production: scheduled daily logical backups plus provider-managed snapshots when available.

Run:

```bash
pnpm db:backup
```

For a SQLite `file:` URL, the script writes a timestamped copy under `backups/`.

For a PostgreSQL URL, the script prints a `pg_dump` command. Run it from a trusted machine with `pg_dump` installed:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=backups/resumeai-YYYYMMDDHHMMSS.dump
```

## Restore

SQLite restore:

```bash
cp backups/resumeai-sqlite-YYYYMMDDHHMMSS.db prisma/dev.db
pnpm db:generate
```

PostgreSQL restore to an empty database:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" backups/resumeai-YYYYMMDDHHMMSS.dump
```

For a plain SQL dump, use:

```bash
psql "$DATABASE_URL" < backups/resumeai-YYYYMMDDHHMMSS.sql
```

Verify after restore:

```bash
pnpm build
curl https://YOUR_HOST/api/health
```

For staging, run the automated smoke gate after restore:

```bash
STAGING_BASE_URL="https://YOUR_STAGING_HOST" pnpm smoke:staging
```
