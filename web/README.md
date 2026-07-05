# ResumeAI MVP

Plan 1 builds the SaaS foundation for the AI resume rewriting product: auth, user-isolated personal information library, quota tracking, and a minimal admin dashboard.

Plan 2 adds the AI middle loop: free-text import, structured experience confirmation, JD parsing, deterministic experience matching, and per-experience STAR rewrite confirmation.

Plan 3 adds resume creation from confirmed rewrite sessions, an editable resume workspace, system templates, in-platform template customization, and user-owned "my templates".

Plan 4 adds production hardening: fail-fast config validation, security headers, LLM route rate limits and input limits, privacy deletion, redaction-safe logging, health checks, PostgreSQL deployment documentation, backups, and a release checklist.

Plan 5 adds browser print-to-PDF export: the editor can open a chrome-free `/resume/[id]/print` route that renders the saved resume with the same document renderer and triggers the system print dialog.

Plan 6 adds editor V1 pilot readiness: users can add saved library experiences into an existing resume, manage custom sections/items, see live page-fit guidance, and follow `docs/pilot-readiness.md` for first-user testing.

Plan 7 adds cloud staging deployment readiness: generated PostgreSQL Prisma schema commands, production migration scripts, a staging smoke test, and `docs/cloud-staging-runbook.md` for the first managed PostgreSQL deployment.

This app intentionally does not include resume scoring. Server-side one-click PDF generation remains a future enhancement; the current PDF path uses the browser's built-in "save as PDF" flow without adding runtime PDF dependencies.

## Local Setup

```bash
cp .env.example .env
pnpm install
pnpm db:generate
rm -f prisma/dev.db
pnpm db:migrate --name plan3_editor_templates
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

## Seed Accounts

- Admin: `admin@example.com` / `ChangeMe123!`
- Sample user: `student@example.com` / `Student123!`

Admins have unlimited usage semantics in the quota service and can access `/admin`.

## LLM Provider

`.env.example` includes safe defaults:

```dotenv
LLM_PROVIDER="mock"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
```

The app uses DeepSeek only when `LLM_PROVIDER="deepseek"` and `DEEPSEEK_API_KEY` is non-empty. Otherwise it uses the deterministic mock provider, including tests and local no-key development, so no LLM network calls are made.

## Plan 2 Flow

- `/library`: paste free text, run AI breakdown, edit the draft, then confirm before it is saved.
- `/match`: paste a JD, parse requirements/skills/keywords/language, review explainable deterministic recommendations, and manually add or remove experiences.
- `/rewrite/[id]`: review each selected experience block with original snapshot, AI rewrite, match reason, pending claims, and confirm / edit / reject decisions.
- After at least one block is accepted or edited, `进入简历编辑` creates a resume snapshot and opens `/resume/[id]`.

## Plan 3 Resume Editing

- `/resumes`: lists the current user's saved resume versions.
- `/resume/[id]`: left side shows the personal library as read-only reference; right side edits and previews the resume snapshot.
- Resume content comes only from confirmed rewrite blocks: `ACCEPTED` uses `rewrittenText`, `EDITED` uses `userEditedText`.
- Resume content is a snapshot. Later edits to the personal library or source rewrite session do not rewrite an already saved resume.
- Users can reorder sections, show or hide sections, inline edit section titles and item text, switch templates, customize presentation settings, and save the current presentation as "my template".
- Templates are presentation-only. Switching or customizing a template changes preview styling and `templateId`, not `contentSnapshot`.
- Two system templates are seeded: `中文紧凑` and `English Classic`.
- PDF export remains out of scope for Plan 3.

## Plan 4 Hardening

- `src/lib/config/env.ts` validates deployment configuration and fails fast for weak production secrets.
- `middleware.ts` sets security headers; production responses include HSTS.
- `/api/import`, `/api/jd`, and `/api/rewrite` use per-user in-memory rate limits before quota checks.
- `/settings` lets users delete their own data or注销账号; deletion routes never accept body-supplied user ids.
- `/api/health` is unauthenticated and performs a database probe.
- Logs should go through `src/lib/logging/logger.ts`, which redacts password, token, cookie, authorization, and API-key fields.
- Deployment, PostgreSQL migration, backup, and restore guidance lives in `docs/deployment.md`.
- Release gates live in `docs/release-checklist.md`.

## Plan 5 PDF Export

- `/resume/[id]` has a `导出 PDF` action that saves the current resume snapshot and opens `/resume/[id]/print`.
- `/resume/[id]/print` is outside the app chrome, requires the same authenticated user ownership, renders with `ResumeDocument`, and starts the browser print dialog.
- The print route uses A4 print CSS and can be exported through the system "保存为 PDF" option.
- Automated e2e coverage generates a PDF with Playwright `page.pdf()` and validates the file signature.

## Plan 6 Editor V1 Pilot Readiness

- `/resume/[id]` lets users add saved library experiences into the current resume snapshot without changing the library source data.
- Users can add custom sections, add/delete items, and remove modules from the current resume version.
- A live `版面检查` panel gives one-page fit guidance before PDF export.
- First-user pilot steps and feedback prompts live in `docs/pilot-readiness.md`.

## Plan 7 Cloud Staging Deployment

- Local development stays on SQLite; staging/production use `pnpm db:generate:prod` to generate `prisma/generated/schema.postgres.prisma`.
- Managed PostgreSQL migrations run through `pnpm db:migrate:prod`.
- First cloud staging rollout steps, required environment variables, backup/rollback notes, and manual pilot smoke live in `docs/cloud-staging-runbook.md`.
- After deployment, run `STAGING_BASE_URL="https://YOUR_STAGING_HOST" pnpm smoke:staging`.

Quota usage is recorded as:

- `import`: 1 credit per free-text breakdown.
- `jd_parse`: 1 credit per JD parse.
- `rewrite`: 1 credit per selected experience block.

Matching does not call the LLM and does not consume quota. Admin users are not quota-limited.

## Checks

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

The e2e tests start a local Next dev server, reset the SQLite database, seed accounts, register users, verify the Plan 1 library/admin flow, run the Plan 2 mock AI import-to-rewrite smoke flow, run the Plan 3 rewrite-to-resume editor persistence flow, run the Plan 4 hardening smoke flow, generate a Plan 5 PDF export artifact, and cover the Plan 6 editor V1 library-add/custom-section flow.

If port 3000 is already occupied, run e2e with `E2E_PORT=3001 pnpm test:e2e`.

## Notes

- Local database: `prisma/dev.db`, ignored by git.
- Migration SQL: `prisma/migrations/*/migration.sql`.
- Local backups: `backups/`, ignored by git. Run `pnpm db:backup`.
- The custom `db:migrate` script wraps Prisma diff output for SQLite because the local Prisma schema engine reports an empty schema-engine error while the generated SQL applies cleanly with sqlite3.
- Production uses PostgreSQL through `pnpm db:generate:prod` and `pnpm db:migrate:prod`; do not use `scripts/sqlite-migrate.ts` in production.
