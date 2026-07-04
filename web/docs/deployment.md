# ResumeAI Deployment Guide

This app keeps SQLite for local development. Production should use PostgreSQL with the same Prisma models.

## Required Environment

Set these variables before build/start:

```dotenv
NODE_ENV="production"
APP_ENV="production"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
SESSION_SECRET="<at least 32 random characters>"
LLM_PROVIDER="deepseek"
DEEPSEEK_API_KEY="<production key>"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
LLM_RATE_LIMIT_PER_MINUTE="10"
MAX_TEXT_BYTES="20000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="<strong bootstrap password>"
```

Generate a strong session secret with:

```bash
openssl rand -base64 48
```

The app validates production configuration at startup. Production fails fast when `SESSION_SECRET` is shorter than 32 characters, or when `LLM_PROVIDER=deepseek` is configured without `DEEPSEEK_API_KEY`.

## PostgreSQL Datasource Path

`prisma/schema.prisma` currently has:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

For production, change only the datasource provider to PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

The models use Prisma `String`, enums, relations, and `Json` fields and do not depend on SQLite-only column types. Generate and apply production migrations with Prisma's production migration flow:

```bash
pnpm db:generate
pnpm exec prisma migrate deploy
```

Do not use `scripts/sqlite-migrate.ts` in production. That script is only for the local SQLite development database.

## Build And Start

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm build
pnpm start
```

`pnpm db:seed` is idempotent for the admin account and system templates. Set a strong `ADMIN_PASSWORD` for the first production seed.

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
