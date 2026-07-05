# ResumeAI Cloud Staging Runbook

This runbook covers the first cloud staging deployment for pilot users. The target is a single Node.js web service backed by a managed PostgreSQL database.

## Target Architecture

- One Next.js Node service running `pnpm start`.
- One managed PostgreSQL database.
- Staging uses the same Prisma models as local development, but with a generated PostgreSQL Prisma schema.
- Static assets are served by Next.js.
- No Redis, queue, object storage, or horizontal scaling is required for the first staging milestone.

## Provider Requirements

Choose a host that supports:

- Node.js 20 or later.
- `pnpm install --frozen-lockfile` during build.
- A release or pre-start command for database migrations.
- Persistent environment variables.
- Managed PostgreSQL with backups or snapshots.
- HTTPS on the public staging URL.

## Required Environment

Set these variables in the staging service:

```dotenv
NODE_ENV="production"
APP_ENV="staging"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
SESSION_SECRET="<at least 32 random characters>"
LLM_PROVIDER="deepseek"
DEEPSEEK_API_KEY="<staging key>"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
LLM_RATE_LIMIT_PER_MINUTE="10"
MAX_TEXT_BYTES="20000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="<strong bootstrap password>"
```

Generate a session secret with:

```bash
openssl rand -base64 48
```

## Build Command

```bash
pnpm install --frozen-lockfile
pnpm db:generate:prod
pnpm build
```

## Release And Start

Run migrations before the service accepts traffic:

```bash
pnpm db:migrate:prod
pnpm db:seed
pnpm start
```

`pnpm db:generate:prod` and `pnpm db:migrate:prod` generate `prisma/generated/schema.postgres.prisma` from `prisma/schema.prisma`. Do not edit the Prisma datasource provider by hand.

## Automated Smoke

After the deployment is live, run:

```bash
STAGING_BASE_URL="https://YOUR_STAGING_HOST" pnpm smoke:staging
```

The smoke check verifies:

- `GET /api/health` returns `status: ok`.
- Security headers are present.
- `/login` is reachable.
- `/library` redirects unauthenticated users to login.

## Manual Pilot Smoke

Run the tester path from `docs/pilot-readiness.md`:

1. Register a new account.
2. Fill name, target role, and contact email.
3. Add at least two experiences to the personal library.
4. Paste a target JD in `/match`.
5. Generate rewrites and confirm at least one block.
6. Open the resume editor.
7. Add one additional library experience into the resume.
8. Add one custom section.
9. Check the live page-fit guidance.
10. Save and reload the resume.
11. Export through `导出 PDF` and choose "Save as PDF" in the browser print dialog.

## Backup

Before every staging release, create a PostgreSQL logical backup:

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --file=backups/resumeai-staging-YYYYMMDDHHMMSS.dump
```

If the provider supports managed snapshots, keep them enabled in addition to logical backups.

## Rollback

Use the provider's previous deploy or image rollback when application code fails after release.

If data needs to be restored to an empty staging database, use:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" backups/resumeai-staging-YYYYMMDDHHMMSS.dump
```

Then verify:

```bash
STAGING_BASE_URL="https://YOUR_STAGING_HOST" pnpm smoke:staging
```

## Decision Log

- Staging is single-instance first because the LLM rate limiter in `src/lib/security/rate-limit.ts` is in-memory. Horizontal scaling requires replacing it with a shared store such as Redis.
- PostgreSQL support uses a generated Prisma schema so local SQLite development stays unchanged.
- Browser print-to-PDF remains the supported PDF export path for pilot users; server-side PDF generation is still future work.
