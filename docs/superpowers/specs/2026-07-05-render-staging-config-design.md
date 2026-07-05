# Render Staging Config Design

Date: 2026-07-05
Status: Proposed for Plan 8
Product area: ResumeAI cloud staging deployment

## 1. Recommendation

Plan 8 should turn the Plan 7 generic cloud runbook into a Render-specific staging configuration package. Render is the recommended first platform because it supports a single long-running Node web service, managed PostgreSQL, HTTPS, environment variables, deploy hooks, and simple rollback controls without forcing a serverless or multi-instance architecture.

The goal is not to operate the user's Render account from Codex. The goal is to make the repository contain the exact configuration, environment template, and verification steps a human can use to create a working staging service with minimal guessing.

## 2. Goals

- Add a Render Blueprint file for the staging web service and managed PostgreSQL database.
- Keep the app single-instance to match the current in-memory LLM rate limiter.
- Wire Render build and start commands to the existing Plan 7 scripts.
- Provide a safe staging environment template without secrets.
- Add local validation for the Render Blueprint so configuration mistakes are caught before upload.
- Update cloud staging documentation with Render-specific setup, deploy, smoke, backup, and rollback steps.
- Keep all changes locally verifiable without a live Render account.

## 3. Non-Goals

- No real Render account provisioning from Codex.
- No real DNS/custom-domain setup.
- No real DeepSeek key, database URL, admin password, or session secret committed to the repo.
- No public production launch.
- No Redis or multi-instance scaling.
- No database model changes.
- No payment, scoring, marketplace, or upload parsing work.

## 4. Target Render Architecture

```text
Tester browser
  -> Render HTTPS staging URL
  -> Render Web Service: resumeai-staging
  -> Prisma Client
  -> Render PostgreSQL: resumeai-staging-db
  -> DeepSeek API
```

The Render web service should run in the `web/` directory and use:

```bash
pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build
```

as the build command.

The service should run:

```bash
pnpm db:migrate:prod && pnpm db:seed && pnpm start
```

as the start command so a fresh staging database is migrated and seeded before serving traffic.

## 5. Render Blueprint

Create `render.yaml` at the repository root. It should define:

- One PostgreSQL database named `resumeai-staging-db`.
- One web service named `resumeai-staging`.
- `runtime: node`.
- `rootDir: web`.
- Build command:

```bash
pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build
```

- Start command:

```bash
pnpm db:migrate:prod && pnpm db:seed && pnpm start
```

- `NODE_ENV=production`.
- `APP_ENV=staging`.
- `DATABASE_URL` from the managed PostgreSQL database connection.
- Secret env vars marked as sync-disabled values where Render supports it.

The `--prod=false` flag is required because Render exposes production-like environment variables during build, while `tsx`, `prisma`, and TypeScript build tooling live in dev dependencies.

The exact Render plan names should be conservative and low-cost. If a free PostgreSQL tier is unavailable in the user's Render account, the documentation should tell the user to pick the smallest paid staging tier and enable backups or snapshots.

## 6. Environment Template

Create a committed template such as `web/.env.staging.example` with safe placeholders:

```dotenv
NODE_ENV="production"
APP_ENV="staging"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
SESSION_SECRET="<generate with openssl rand -base64 48>"
LLM_PROVIDER="deepseek"
DEEPSEEK_API_KEY="<set in Render dashboard>"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
LLM_RATE_LIMIT_PER_MINUTE="10"
MAX_TEXT_BYTES="20000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="<set in Render dashboard>"
```

This file must not contain real secrets.

## 7. Blueprint Validation

Add a small validation script and unit test so Plan 8 can be verified locally without Render:

- `web/scripts/validate-render-blueprint.ts`
- `web/tests/unit/render-blueprint.test.ts`

The script should parse the root `render.yaml` and assert:

- There is exactly one web service.
- There is exactly one PostgreSQL database.
- The web service has `rootDir: web`.
- The build command contains `pnpm db:generate:prod` and `pnpm build`.
- The start command contains `pnpm db:migrate:prod`, `pnpm db:seed`, and `pnpm start`.
- The environment includes `NODE_ENV=production`, `APP_ENV=staging`, and a PostgreSQL-backed `DATABASE_URL` reference.

The script should be runnable with:

```bash
pnpm validate:render
```

## 8. Documentation Updates

Update `web/docs/cloud-staging-runbook.md` with a Render section:

- Create a Render Blueprint from the repository.
- Confirm the service root is `web`.
- Confirm build/start commands.
- Fill secret environment variables in the Render dashboard.
- Deploy.
- Run:

```bash
STAGING_BASE_URL="https://YOUR_RENDER_STAGING_URL" pnpm smoke:staging
```

- Run the manual pilot smoke from `web/docs/pilot-readiness.md`.
- Check PostgreSQL backups/snapshots before inviting testers.
- Use Render rollback to return to the previous deploy if app startup or smoke fails.

Update `web/docs/release-checklist.md` and `web/README.md` to mention `pnpm validate:render`.

## 9. Acceptance

Plan 8 is complete when:

- `render.yaml` exists and expresses the single-instance Render staging target.
- `web/.env.staging.example` exists and contains placeholders only.
- `pnpm validate:render` passes locally.
- Unit tests cover the Render Blueprint validator.
- `web/docs/cloud-staging-runbook.md` contains Render-specific deploy, smoke, backup, and rollback steps.
- `web/docs/release-checklist.md` and `web/README.md` reference Render validation.
- Existing gates still pass: `pnpm test`, `pnpm typecheck`, `pnpm build`, and `E2E_PORT=3001 pnpm test:e2e` when port 3000 is occupied.

## 10. Open Operational Inputs

The user still needs to provide or create these outside Codex before a real deployment can go live:

- Render account access.
- GitHub repository connection to Render.
- Staging PostgreSQL tier choice.
- DeepSeek API key.
- Staging admin email and password.
- Final staging URL for `STAGING_BASE_URL`.
