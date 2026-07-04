# ResumeAI Release Checklist

Complete every gate before a production release.

- Environment variables are set and validated with production values.
- `SESSION_SECRET` is generated from strong randomness and is at least 32 characters.
- `LLM_PROVIDER=deepseek` is set in production and `DEEPSEEK_API_KEY` is present.
- `DATABASE_URL` points at the production PostgreSQL database.
- Prisma datasource provider is set to `postgresql` for production migrations.
- Migrations have been applied with `pnpm exec prisma migrate deploy`.
- Admin account and system templates have been seeded with `pnpm db:seed`.
- Security headers are present on application responses.
- Session cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
- LLM route rate limits and text-size limits have been smoke-tested.
- Backups are scheduled and a restore drill has been documented.
- `GET /api/health` returns `{ "status": "ok" }` in the target environment.
- `pnpm test` exits 0.
- `pnpm typecheck` exits 0.
- `pnpm build` exits 0.
- `pnpm test:e2e` exits 0.
- PDF export remains unimplemented unless a later approved plan explicitly adds it.
- No resume scoring, payments, template marketplace, or upload-recognition scope has slipped into the release.
