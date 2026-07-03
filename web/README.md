# ResumeAI MVP Foundation

Plan 1 builds the SaaS foundation for the AI resume rewriting product: auth, user-isolated personal information library, quota tracking, and a minimal admin dashboard.

This foundation intentionally does not include resume scoring, JD matching, AI rewriting, the resume editor, templates, or PDF export.

## Local Setup

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

## Seed Accounts

- Admin: `admin@example.com` / `ChangeMe123!`
- Sample user: `student@example.com` / `Student123!`

Admins have unlimited usage semantics in the quota service and can access `/admin`.

## Checks

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

The e2e test starts a local Next dev server, resets the SQLite database, seeds accounts, registers a new user, saves profile and project data, verifies persistence, then checks the admin quota flow.

## Notes

- Local database: `prisma/dev.db`, ignored by git.
- Migration SQL: `prisma/migrations/*/migration.sql`.
- The custom `db:migrate` script wraps Prisma diff output for SQLite because the local Prisma schema engine reports an empty schema-engine error while the generated SQL applies cleanly with sqlite3.
