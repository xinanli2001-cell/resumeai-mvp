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

## Render Blueprint Deployment

Plan 8 provides `render.yaml` at the repository root for a Render staging deployment. Validate it before pushing Blueprint changes:

```bash
pnpm validate:render
```

In the Render Dashboard:

1. Choose New > Blueprint.
2. Connect the Git repository and select the staging branch.
3. Confirm the Blueprint path is `render.yaml`.
4. Review the planned resources: `resumeai-staging` web service and `resumeai-staging-db` PostgreSQL database.
5. Confirm the web service root directory is `web`.
6. Confirm the build command is `pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build`.
7. Confirm the start command is `pnpm db:migrate:prod && pnpm db:seed && pnpm start`.
8. Fill the `sync: false` secret values in the Render Dashboard: `SESSION_SECRET`, `DEEPSEEK_API_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
9. Deploy the Blueprint.

`DATABASE_URL` is wired from the Render PostgreSQL database through `fromDatabase.property: connectionString`. Do not paste the database URL into `render.yaml`.

The `--prod=false` install flag is intentional. Render builds with production-like environment variables, while this app's Prisma and TypeScript build tools are dev dependencies.

If `basic-256mb` is unavailable for the staging PostgreSQL database in the selected Render account, choose the smallest available persistent staging tier and enable backups or snapshots before inviting testers.

## Automated Smoke

After the deployment is live, run:

```bash
STAGING_BASE_URL="https://YOUR_STAGING_HOST" pnpm smoke:staging
```

For Render, use the staging service URL:

```bash
STAGING_BASE_URL="https://YOUR_RENDER_STAGING_URL" pnpm smoke:staging
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

On Render, confirm PostgreSQL backups or snapshots are enabled before first testers use the staging URL. If the selected staging tier does not include backups, take a manual dump from a trusted shell before every release.

## Rollback

Use the provider's previous deploy or image rollback when application code fails after release.

On Render, use the service rollback action to return `resumeai-staging` to the previous deploy when startup, health check, or `pnpm smoke:staging` fails. Keep the database unless a migration is proven harmful. If data is damaged, restore PostgreSQL from the latest Render snapshot or logical dump.

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
