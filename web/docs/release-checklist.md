# ResumeAI Release Checklist

Complete every gate before a production release.

- Environment variables are set and validated with production values.
- `SESSION_SECRET` is generated from strong randomness and is at least 32 characters.
- `LLM_PROVIDER=openai` is set in production and `OPENAI_API_KEY` is present.
- `DATABASE_URL` points at the production PostgreSQL database.
- `REGISTRATION_MODE` is deliberately set: `invite_only` for a closed beta with
  at least one active code, or `open` for intentional public registration.
- Render Blueprint validation passes with `pnpm validate:render`.
- Render staging secrets marked `sync: false` have been filled in the Render dashboard.
- PostgreSQL Prisma schema generation passes with `pnpm db:generate:prod`.
- Migrations have been applied with `pnpm db:migrate:prod`.
- Free Render staging schema push has been applied with `pnpm db:push:prod` if no PostgreSQL migration history exists yet.
- Admin account and system templates have been seeded with `pnpm db:seed`.
- An administrator can create, copy, deactivate, reactivate, and inspect recent
  redemption history for invitation codes.
- Invite-only staging rejects registration without a code and accepts an active
  code with remaining capacity.
- Existing users can redeem a code in Settings; duplicate redemption is blocked
  and the increased quota persists after reload.
- A compromised code has been deactivated and confirmed unavailable without
  removing historical grants.
- Invitation codes expose no LLM API key and do not bypass authentication,
  quota, input-size, or rate-limit controls.
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
