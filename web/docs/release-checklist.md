# ResumeAI Release Checklist

Complete every gate before a production release.

- Environment variables are set and validated with production values.
- `SESSION_SECRET` is generated from strong randomness and is at least 32 characters.
- `LLM_PROVIDER=deepseek` is set in production and `DEEPSEEK_API_KEY` is present.
- `DATABASE_URL` points at the production PostgreSQL database.
- PostgreSQL Prisma schema generation passes with `pnpm db:generate:prod`.
- Migrations have been applied with `pnpm db:migrate:prod`.
- Admin account and system templates have been seeded with `pnpm db:seed`.
- Security headers are present on application responses.
- Session cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
- LLM route rate limits and text-size limits have been smoke-tested.
- Backups are scheduled and the backup/restore path is documented in `docs/deployment.md` and `docs/cloud-staging-runbook.md`.
- `GET /api/health` returns `{ "status": "ok" }` in the target environment.
- Staging smoke passes with `STAGING_BASE_URL="https://YOUR_STAGING_HOST" pnpm smoke:staging`.
- `pnpm test` exits 0.
- `pnpm typecheck` exits 0.
- `pnpm build` exits 0.
- `pnpm test:e2e` exits 0.
- Browser print-to-PDF export has been manually verified through `/resume/[id]/print`.
- No resume scoring, payments, template marketplace, or upload-recognition scope has slipped into the release.
