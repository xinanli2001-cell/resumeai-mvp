# Resume SaaS Plan 4: Deployment and Hardening Implementation Plan

> **For agentic workers (Codex included):** Executable directly, no extra discovery. REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`). Implement in order, verify each task, commit after each task.

**Goal:** Take the working MVP loop (Plans 1–3) and make it safe to run for real users: fail-fast configuration, security hardening, privacy/data-deletion, redaction-safe logging + monitoring, a documented PostgreSQL production path, a backup strategy, and a release checklist. This plan adds no new product surface — it hardens what exists.

**Non-goals for this plan:**
- **PDF export remains un-scheduled and out of scope** (product owner said "不要pdf"). Do not add a PDF/print feature here. It is tracked as a deferred item at the end of this document; building it requires an explicit product go-ahead and an approach decision.
- No resume scoring (never). No payments/subscriptions, template marketplace, or Word/PDF upload recognition.

**Architecture:** Extend `web/`. Add a single validated config module that all secret/URL access goes through, a Next.js `middleware.ts` for security headers, a small in-process rate limiter guarding the cost-bearing LLM routes, a privacy service + routes for data/account deletion (cascade deletes already exist in the schema), a redaction-safe logger, and a health endpoint. Keep SQLite for local dev; document and validate a Postgres switch for production. No new runtime dependency is required (rate limiting is in-memory for a single instance; note the horizontal-scale caveat).

**Tech Stack (unchanged):** Next.js App Router (`next@16`, React 19), TypeScript, Tailwind 4, Prisma 6, Zod 4, Vitest, Playwright.

> **Next.js version warning (from `web/AGENTS.md`):** `next@16.2.10` has breaking changes vs. older training data. Read `web/node_modules/next/dist/docs/` before writing `middleware.ts`/route code and follow existing files as the source of truth.

---

## Prerequisites (verify before Task 1)

Plans 1–3 complete and green:

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm install && pnpm test && pnpm typecheck && pnpm build
```

All exit 0. Then branch:

```bash
git checkout -b plan4-deployment-hardening
```

## New / changed environment variables

Append to `web/.env.example` (documented, safe dev defaults):

```dotenv
# Deployment
NODE_ENV="development"
APP_ENV="local"                 # local | staging | production
# Rate limiting (per user, per rolling window) for cost-bearing LLM routes
LLM_RATE_LIMIT_PER_MINUTE="10"
# Max accepted request body size (bytes) for text-heavy routes (import/jd)
MAX_TEXT_BYTES="20000"
```

`DATABASE_URL` stays `file:./dev.db` for dev; production uses a Postgres URL (Task 5).

---

## Task 1: Validated configuration module (fail-fast)

**Files:**
- Create: `web/src/lib/config/env.ts`
- Create: `web/tests/unit/env-config.test.ts`
- Modify: `web/.env.example`

- [ ] **Step 1: Add the env vars** above to `.env.example`.

- [ ] **Step 2: Write the config test** — assert:
- In production (`NODE_ENV=production`), a missing or too-short `SESSION_SECRET` throws at load.
- In production, `LLM_PROVIDER="deepseek"` with an empty `DEEPSEEK_API_KEY` throws (no silent mock in prod).
- Numeric vars parse with defaults (`LLM_RATE_LIMIT_PER_MINUTE`, `MAX_TEXT_BYTES`).
- In development, defaults apply and nothing throws.

- [ ] **Step 3: Implement `env.ts`** — a Zod-validated, lazily-evaluated accessor. All code that reads `process.env` for secrets/URLs/limits must go through this module (except the existing `session.ts` secret check, which may stay but should match the same length rule). Shape:

```ts
import { z } from "zod";

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string(),
  LLM_PROVIDER: z.enum(["mock", "deepseek"]).default("mock"),
  DEEPSEEK_API_KEY: z.string().default(""),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  LLM_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  MAX_TEXT_BYTES: z.coerce.number().int().positive().default(20000),
});

export function loadEnv() {
  const parsed = RawEnvSchema.parse(process.env);
  if (parsed.NODE_ENV === "production") {
    if (parsed.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET must be >= 32 chars in production");
    }
    if (parsed.LLM_PROVIDER === "deepseek" && !parsed.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY required when LLM_PROVIDER=deepseek in production");
    }
  }
  return parsed;
}

let cached: ReturnType<typeof loadEnv> | undefined;
export function env() {
  if (!cached) cached = loadEnv();
  return cached;
}
```

- [ ] **Step 4: Route the LLM provider selector and rate/size limits through `env()`** (update `src/lib/llm/provider.ts` to read `env().LLM_PROVIDER` / `env().DEEPSEEK_API_KEY`; behavior unchanged for tests since defaults keep mock).

- [ ] **Step 5: Verify + commit**

```bash
pnpm test tests/unit/env-config.test.ts && pnpm typecheck
git add web/src/lib/config web/tests/unit/env-config.test.ts web/.env.example web/src/lib/llm/provider.ts
git commit -m "feat: add fail-fast validated config module"
```

## Task 2: Security headers, cookie + input hardening, rate limiting

**Files:**
- Create: `web/middleware.ts`
- Create: `web/src/lib/security/rate-limit.ts`
- Create: `web/tests/unit/rate-limit.test.ts`
- Modify: the three LLM routes (`api/import`, `api/jd`, `api/rewrite`) to apply rate-limit + body-size checks.

- [ ] **Step 1: Add security headers middleware** — `middleware.ts` sets, on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a conservative `Content-Security-Policy` compatible with Next, and (production only) `Strict-Transport-Security`. Do not break existing auth redirects — headers only.

- [ ] **Step 2: Write the rate-limit test** — a pure, injectable-clock limiter: assert N calls pass within the window and the N+1th is rejected, and that the window rolls over after time advances. No real timers.

- [ ] **Step 3: Implement the rate limiter** — in-memory, keyed by `userId` + action, rolling window using an injected `now()` so it is testable. Signature:

```ts
export function checkRateLimit(key: string, limitPerMinute: number, now?: () => number): { allowed: boolean; retryAfterMs: number };
```

Document at the top of the file: **single-instance only**; for horizontal scaling replace with a shared store (Redis). This is acceptable for the MVP single-instance deployment.

- [ ] **Step 4: Apply to cost-bearing routes** — in `api/import`, `api/jd`, `api/rewrite`: after `requireUser`, reject over-limit requests with HTTP 429 `{ error: "Rate limited" }` (before `assertCanConsume`), and reject bodies whose text field exceeds `env().MAX_TEXT_BYTES` with HTTP 413. Confirm the session cookie is already `secure` in production (it is, in `login/route.ts`) and `httpOnly`+`sameSite=lax`.

- [ ] **Step 5: Verify + commit**

```bash
pnpm test tests/unit/rate-limit.test.ts && pnpm typecheck && pnpm build
git add web/middleware.ts web/src/lib/security web/src/app/api/import web/src/app/api/jd web/src/app/api/rewrite web/tests/unit/rate-limit.test.ts
git commit -m "feat: add security headers, rate limiting, and input size limits"
```

## Task 3: Privacy — data and account deletion

**Files:**
- Create: `web/src/lib/privacy/privacy-service.ts`
- Create: `web/src/app/api/account/data/route.ts` (DELETE: wipe library data)
- Create: `web/src/app/api/account/route.ts` (DELETE: delete account)
- Create: `web/src/app/(app)/settings/page.tsx` + `settings-client.tsx`
- Create: `web/tests/unit/privacy-service.test.ts`

- [ ] **Step 1: Write the privacy test** (real DB + `deleteMany` cleanup). Assert:
- `deleteUserData(userId)` removes that user's profile content, experiences, JDs, rewrite sessions/blocks, resumes, and non-system templates — but NOT the `User` row and NOT another user's data.
- System templates (`isSystem = true`) are never deleted.
- `deleteAccount(userId)` removes the `User` and everything cascaded, and no other user's rows are affected.

- [ ] **Step 2: Implement the privacy service** — rely on existing `onDelete: Cascade` where possible; explicitly scope every delete by `userId`. Signatures:

```ts
deleteUserData(userId: string): Promise<{ deleted: Record<string, number> }>; // counts per model
deleteAccount(userId: string): Promise<void>;                                  // deletes User; cascades the rest
```

Never delete `isSystem` templates. `deleteUserData` resets the profile to empty defaults rather than deleting the one-to-one Profile row (keep the account usable).

- [ ] **Step 3: Implement routes** — both `requireUser`; operate only on `user.id` (never a body-supplied id). `DELETE /api/account/data` → `deleteUserData`. `DELETE /api/account` → `deleteAccount` then clears the session cookie. Return counts / `{ ok: true }`.

- [ ] **Step 4: Settings page** — `/settings` with two clearly-labeled destructive actions behind confirmation: "删除我的资料数据" and "注销账号". Wire to the routes; on account deletion, redirect to `/login`.

- [ ] **Step 5: Verify + commit**

```bash
pnpm test tests/unit/privacy-service.test.ts && pnpm typecheck
git add web/src/lib/privacy web/src/app/api/account "web/src/app/(app)/settings" web/tests/unit/privacy-service.test.ts
git commit -m "feat: add privacy data and account deletion"
```

## Task 4: Redaction-safe logging, health, and failure resilience

**Files:**
- Create: `web/src/lib/logging/logger.ts`
- Create: `web/src/app/api/health/route.ts`
- Create: `web/tests/unit/logger-redaction.test.ts`
- Review: LLM route error paths preserve user input.

- [ ] **Step 1: Write the redaction test** — assert the logger strips/omits any field named like `password`, `passwordHash`, `authorization`, `apiKey`, `DEEPSEEK_API_KEY`, `SESSION_SECRET`, cookie/token values from logged objects; assert a normal message passes through.

- [ ] **Step 2: Implement the logger** — a thin structured logger (`info`/`warn`/`error`) that deep-redacts known-sensitive keys before serializing. All server logging in new code uses it. Confirm `UsageLog` never stores raw prompt text, secrets, or PII beyond the existing `actionType`/`costUnits`/`status`/related-object fields (PRD §8.1).

- [ ] **Step 3: Health endpoint** — `GET /api/health` returns `{ status: "ok", appEnv }` and performs a trivial DB round-trip (`db.$queryRaw` SELECT 1); returns 503 if the DB is unreachable. No auth. Leaks nothing sensitive.

- [ ] **Step 4: Failure resilience (PRD §8.2)** — verify (and fix if needed) that a failed LLM call in import/jd/rewrite returns a clear error WITHOUT discarding the user's submitted text, and the client keeps the input on screen for retry. The rewrite path already logs `FAILED` per block without consuming quota; confirm the import/jd clients do not clear the textarea on error.

- [ ] **Step 5: Verify + commit**

```bash
pnpm test tests/unit/logger-redaction.test.ts && pnpm typecheck && pnpm build
git add web/src/lib/logging web/src/app/api/health web/tests/unit/logger-redaction.test.ts
git commit -m "feat: add redaction-safe logging, health check, failure resilience"
```

## Task 5: PostgreSQL production path

**Files:**
- Create: `web/prisma/schema.production.prisma` OR document the datasource switch (choose one; document in README).
- Create: `web/docs/deployment.md`

- [ ] **Step 1: Document the datasource switch** — the schema uses `provider = "sqlite"` for dev. For production, the same models run on Postgres by setting the datasource `provider = "postgresql"` and `DATABASE_URL` to a Postgres URL. Confirm no SQLite-only constructs are used (the schema uses `Json`, `String`, enums — all Postgres-compatible). Provide the exact steps to generate and apply Postgres migrations with `prisma migrate deploy` (the local `sqlite-migrate.ts` script is dev-only and must NOT be used in production).

- [ ] **Step 2: Write `deployment.md`** covering: required env vars and how to generate a strong `SESSION_SECRET`; setting `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY` in production; build (`pnpm build`) and start (`pnpm start`); running `prisma migrate deploy`; the single-instance rate-limiter caveat; and how to seed the admin + system templates in production safely (idempotent upserts already exist in `seed.ts`).

- [ ] **Step 3: Verify + commit**

```bash
pnpm build
git add web/docs/deployment.md web/prisma
git commit -m "docs: add postgres production path and deployment guide"
```

## Task 6: Backup strategy

**Files:**
- Create: `web/scripts/backup.ts`
- Modify: `web/docs/deployment.md` (backup section)

- [ ] **Step 1: Implement a backup helper** — `scripts/backup.ts` that, for a `file:` SQLite URL, copies the DB file to a timestamped path under a `backups/` dir (timestamp passed in as an arg or from `process.env`, since `Date.now()` policy in scripts is fine here — this is a plain Node script, not a workflow). For a Postgres URL, print the `pg_dump` command to run (do not shell out to pg_dump automatically). Add a `db:backup` script to `package.json`.

- [ ] **Step 2: Document restore** — in `deployment.md`, document backup cadence recommendation and restore steps for both SQLite (file copy back) and Postgres (`pg_restore`/`psql`).

- [ ] **Step 3: Verify + commit**

```bash
pnpm exec tsx scripts/backup.ts   # dev: produces a timestamped SQLite copy
git add web/scripts/backup.ts web/package.json web/docs/deployment.md
git commit -m "feat: add database backup script and restore docs"
```

## Task 7: Release checklist and final hardening verification

**Files:**
- Create: `web/docs/release-checklist.md`
- Create: `web/tests/e2e/hardening.spec.ts`
- Modify: `web/README.md`

- [ ] **Step 1: Release checklist** — `release-checklist.md` enumerating pre-release gates: all env vars set and validated; `SESSION_SECRET` rotated & strong; `LLM_PROVIDER=deepseek` + key present; migrations applied via `migrate deploy`; admin + system templates seeded; security headers verified; rate limits verified; backups scheduled; health endpoint reachable; `pnpm test`/`typecheck`/`build`/`test:e2e` green.

- [ ] **Step 2: Hardening e2e** — `hardening.spec.ts` (mock provider): unauthenticated `GET /api/health` returns ok; a logged-in user can wipe their data via `/settings` and the library becomes empty while the account still logs in; account deletion redirects to `/login` and the session no longer authenticates. Optionally assert security headers on a page response.

- [ ] **Step 3: Full suite**

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm test && pnpm typecheck && pnpm build && pnpm test:e2e
```

Expected: all pass.

- [ ] **Step 4: Update README + commit**

```bash
git add web/docs/release-checklist.md web/tests/e2e/hardening.spec.ts web/README.md
git commit -m "test: add hardening smoke and release checklist"
```

## Deferred item: PDF export (NOT built)

PDF export is a PRD MVP item (§3.1) but was explicitly deferred by the product owner ("不要pdf"). It is intentionally NOT implemented in Plans 1–4. When the owner decides to build it, a small follow-up plan should choose an approach (browser print-to-PDF via a print route, server-side headless-chromium render, or `@react-pdf/renderer`) and add it against the existing `Resume.contentSnapshot` + `Template.config`. Do not implement it without that go-ahead.

## Self-Review

- Spec coverage: production config + fail-fast validation, security headers + cookie/input hardening + rate limiting (protects LLM cost, PRD §5.9/§8.1), privacy data/account deletion (PRD §8.1), redaction-safe logging + no-secret-leak in logs/UsageLog (PRD §8.1), health + failure resilience (PRD §8.2), Postgres production path (PRD §8.3 replaceability + Plan 1 note), backups, release checklist.
- Not covered by design: PDF export (explicitly deferred, documented above); scoring/payments/marketplace/upload-recognition (out of product scope).
- Placeholder scan: no `TBD`/`TODO`; every task names exact files and concrete behavior/contracts. The only "not built" item is PDF, called out explicitly.
- Consistency: all secret/URL/limit access flows through `env()`; rate limiter is documented single-instance; deletes are `userId`-scoped and never touch system templates or other users; system templates preserved; tests use mock provider and injected clocks — no network, no real timers.
