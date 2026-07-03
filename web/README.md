# ResumeAI MVP

Plan 1 builds the SaaS foundation for the AI resume rewriting product: auth, user-isolated personal information library, quota tracking, and a minimal admin dashboard.

Plan 2 adds the AI middle loop: free-text import, structured experience confirmation, JD parsing, deterministic experience matching, and per-experience STAR rewrite confirmation.

This app intentionally does not include resume scoring. Resume editing, templates, and PDF export are later-plan scope.

## Local Setup

```bash
cp .env.example .env
pnpm install
pnpm db:generate
rm -f prisma/dev.db
pnpm db:migrate --name plan2_ai_matching_rewrite
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

The e2e tests start a local Next dev server, reset the SQLite database, seed accounts, register users, verify the Plan 1 library/admin flow, and run the Plan 2 mock AI import-to-rewrite smoke flow.

## Notes

- Local database: `prisma/dev.db`, ignored by git.
- Migration SQL: `prisma/migrations/*/migration.sql`.
- The custom `db:migrate` script wraps Prisma diff output for SQLite because the local Prisma schema engine reports an empty schema-engine error while the generated SQL applies cleanly with sqlite3.
