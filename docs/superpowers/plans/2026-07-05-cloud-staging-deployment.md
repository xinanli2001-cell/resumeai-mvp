# Cloud Staging Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ResumeAI ready for a real cloud staging deployment using a single Node.js service, managed PostgreSQL, production-like environment variables, repeatable Prisma production commands, and a staging smoke test.

**Architecture:** Keep SQLite as the local development database, but generate a PostgreSQL Prisma schema for cloud commands. Add a staging runbook and a lightweight smoke script that verifies the deployed app, headers, auth redirect, and health endpoint without creating user data. Keep the first cloud target single-instance because the current LLM route limiter is in-memory.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL for staging, Zod env validation, Vitest, Playwright, Node built-in `fetch`.

---

## Prerequisites

Run from `/Users/lixinan/Desktop/简历修改工具/web`:

```bash
pnpm test && pnpm typecheck && pnpm build && pnpm test:e2e
```

Expected: all commands exit 0 before implementation starts.

Work on branch:

```bash
git checkout -b plan7-cloud-staging-deployment
```

## Scope

In scope:

- Scripted PostgreSQL Prisma schema generation.
- Production deploy package scripts.
- Staging smoke script.
- Cloud staging runbook.
- Release checklist updates.
- Tests for generated schema and smoke parsing behavior.

Out of scope:

- Actual cloud account provisioning inside Codex.
- Payments/subscriptions.
- Resume scoring.
- Multi-instance scaling.
- Redis/shared rate limiter.
- Public production launch.
- Database model changes.

## File Structure

- Create: `web/scripts/create-postgres-schema.ts` — generates `prisma/generated/schema.postgres.prisma`.
- Create: `web/tests/unit/create-postgres-schema.test.ts` — verifies only datasource provider changes and generated schema preserves models.
- Modify: `web/package.json` — adds `db:generate:prod`, `db:migrate:prod`, and `smoke:staging`.
- Create: `web/scripts/smoke-staging.ts` — checks a deployed base URL.
- Create: `web/tests/unit/smoke-staging.test.ts` — tests smoke helper behavior with mocked fetch responses.
- Create: `web/docs/cloud-staging-runbook.md` — step-by-step staging deployment guide.
- Modify: `web/docs/deployment.md` — links to the staging runbook and replaces hand-edit Prisma guidance with generated schema commands.
- Modify: `web/docs/release-checklist.md` — updates PDF status and adds staging smoke gates.
- Modify: `web/README.md` — adds Plan 7 summary and cloud staging command references.

## Task 1: PostgreSQL Prisma Schema Generation

**Files:**
- Create: `web/scripts/create-postgres-schema.ts`
- Create: `web/tests/unit/create-postgres-schema.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Write the failing unit test**

Create `web/tests/unit/create-postgres-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPostgresSchema } from "../../scripts/create-postgres-schema";

describe("createPostgresSchema", () => {
  it("switches only the datasource provider from sqlite to postgresql", () => {
    const source = [
      "datasource db {",
      "  provider = \"sqlite\"",
      "  url      = env(\"DATABASE_URL\")",
      "}",
      "",
      "model User {",
      "  id String @id",
      "}",
    ].join("\n");

    const generated = createPostgresSchema(source);

    expect(generated).toContain('provider = "postgresql"');
    expect(generated).toContain('url      = env("DATABASE_URL")');
    expect(generated).toContain("model User");
    expect(generated).not.toContain('provider = "sqlite"');
  });

  it("throws when the sqlite datasource provider is missing", () => {
    expect(() => createPostgresSchema("datasource db {}")).toThrow("sqlite datasource provider");
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
pnpm test tests/unit/create-postgres-schema.test.ts
```

Expected: fails because `scripts/create-postgres-schema.ts` does not exist.

- [ ] **Step 3: Implement the generator**

Create `web/scripts/create-postgres-schema.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const sqliteProvider = 'provider = "sqlite"';
const postgresProvider = 'provider = "postgresql"';

export function createPostgresSchema(source: string) {
  if (!source.includes(sqliteProvider)) {
    throw new Error("Expected sqlite datasource provider in prisma/schema.prisma");
  }
  return source.replace(sqliteProvider, postgresProvider);
}

export function writePostgresSchema({
  sourcePath = path.join("prisma", "schema.prisma"),
  outputPath = path.join("prisma", "generated", "schema.postgres.prisma"),
} = {}) {
  const source = readFileSync(sourcePath, "utf8");
  const generated = createPostgresSchema(source);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, generated);
  return outputPath;
}

if (require.main === module) {
  const outputPath = writePostgresSchema();
  console.log(`Generated ${outputPath}`);
}
```

- [ ] **Step 4: Add production DB scripts**

Modify `web/package.json` scripts:

```json
"db:generate:prod": "tsx scripts/create-postgres-schema.ts && prisma generate --schema prisma/generated/schema.postgres.prisma",
"db:migrate:prod": "tsx scripts/create-postgres-schema.ts && prisma migrate deploy --schema prisma/generated/schema.postgres.prisma"
```

- [ ] **Step 5: Verify Task 1**

Run:

```bash
pnpm test tests/unit/create-postgres-schema.test.ts
pnpm db:generate:prod
test -f prisma/generated/schema.postgres.prisma
grep -q 'provider = "postgresql"' prisma/generated/schema.postgres.prisma
pnpm typecheck
```

Expected: all commands exit 0.

## Task 2: Staging Smoke Script

**Files:**
- Create: `web/scripts/smoke-staging.ts`
- Create: `web/tests/unit/smoke-staging.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Write the failing unit test**

Create `web/tests/unit/smoke-staging.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkStagingSmoke } from "../../scripts/smoke-staging";

function response(status: number, headers: Record<string, string>, body = "{}") {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as Response;
}

describe("checkStagingSmoke", () => {
  it("passes when health, headers, login, and auth redirect are healthy", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.endsWith("/api/health")) {
        return response(200, {
          "x-frame-options": "DENY",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'self'",
        }, JSON.stringify({ status: "ok", appEnv: "staging" }));
      }
      if (url.endsWith("/login")) return response(200, {}, "<html>login</html>");
      if (url.endsWith("/library")) return response(302, { location: "/login" });
      throw new Error(`unexpected URL ${url}`);
    };

    await expect(checkStagingSmoke("https://example.com", fetcher)).resolves.toEqual([
      "health ok",
      "security headers ok",
      "login reachable",
      "auth redirect ok",
    ]);
    expect(calls).toHaveLength(3);
  });

  it("fails when health is not ok", async () => {
    const fetcher = async () => response(503, {}, JSON.stringify({ status: "error" }));
    await expect(checkStagingSmoke("https://example.com", fetcher)).rejects.toThrow("Health check failed");
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
pnpm test tests/unit/smoke-staging.test.ts
```

Expected: fails because `scripts/smoke-staging.ts` does not exist.

- [ ] **Step 3: Implement the smoke script**

Create `web/scripts/smoke-staging.ts`:

```ts
type Fetcher = typeof fetch;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function requireHeader(response: Response, key: string) {
  const value = response.headers.get(key);
  if (!value) throw new Error(`Missing security header: ${key}`);
}

export async function checkStagingSmoke(baseUrl: string, fetcher: Fetcher = fetch) {
  const base = normalizeBaseUrl(baseUrl);
  const health = await fetcher(`${base}/api/health`);
  if (!health.ok) throw new Error(`Health check failed with HTTP ${health.status}`);
  const healthBody = (await health.json()) as { status?: string };
  if (healthBody.status !== "ok") throw new Error("Health check failed: status was not ok");
  requireHeader(health, "x-frame-options");
  requireHeader(health, "x-content-type-options");
  requireHeader(health, "content-security-policy");

  const login = await fetcher(`${base}/login`);
  if (!login.ok) throw new Error(`Login page failed with HTTP ${login.status}`);

  const library = await fetcher(`${base}/library`, { redirect: "manual" });
  if (library.status !== 302 && library.status !== 307 && library.status !== 308) {
    throw new Error(`Expected unauthenticated /library redirect, got HTTP ${library.status}`);
  }

  return ["health ok", "security headers ok", "login reachable", "auth redirect ok"];
}

if (require.main === module) {
  const baseUrl = process.env.STAGING_BASE_URL;
  if (!baseUrl) throw new Error("STAGING_BASE_URL is required");
  checkStagingSmoke(baseUrl)
    .then((results) => {
      for (const result of results) console.log(result);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Add the script command**

Modify `web/package.json` scripts:

```json
"smoke:staging": "tsx scripts/smoke-staging.ts"
```

- [ ] **Step 5: Verify Task 2**

Run:

```bash
pnpm test tests/unit/smoke-staging.test.ts
pnpm typecheck
```

Expected: both pass.

## Task 3: Cloud Staging Runbook and Release Checklist

**Files:**
- Create: `web/docs/cloud-staging-runbook.md`
- Modify: `web/docs/deployment.md`
- Modify: `web/docs/release-checklist.md`
- Modify: `web/README.md`

- [ ] **Step 1: Create `web/docs/cloud-staging-runbook.md`**

The runbook must include:

- Target architecture: single Node service + managed PostgreSQL.
- Provider requirements: Node runtime, HTTPS, environment variables, managed Postgres or external Postgres, deploy hooks/logs.
- Required env vars from the design spec.
- Build command:

```bash
pnpm install --frozen-lockfile
pnpm db:generate:prod
pnpm build
```

- Release/start command:

```bash
pnpm db:migrate:prod
pnpm db:seed
pnpm start
```

- Staging smoke:

```bash
STAGING_BASE_URL="https://YOUR_STAGING_HOST" pnpm smoke:staging
```

- Manual pilot smoke from `docs/pilot-readiness.md`.
- Backup and rollback steps.
- Decision log: single-instance first because rate limiter is in-memory.

- [ ] **Step 2: Update `web/docs/deployment.md`**

Replace the hand-edit Prisma provider guidance with the generated-schema commands:

```bash
pnpm db:generate:prod
pnpm db:migrate:prod
```

Link to `docs/cloud-staging-runbook.md`.

- [ ] **Step 3: Update `web/docs/release-checklist.md`**

Fix old PDF wording: PDF export is now implemented through browser print-to-PDF.

Add:

- `pnpm db:generate:prod` succeeds.
- `pnpm db:migrate:prod` has been run against staging.
- `STAGING_BASE_URL=... pnpm smoke:staging` passes.
- Staging backup/restore path is documented.

- [ ] **Step 4: Update `web/README.md`**

Add Plan 7 summary and link:

```markdown
Plan 7 prepares cloud staging deployment with generated PostgreSQL Prisma schema commands, staging smoke checks, and a cloud runbook in `docs/cloud-staging-runbook.md`.
```

- [ ] **Step 5: Verify Task 3**

Run:

```bash
rg -n "cloud-staging-runbook|db:generate:prod|smoke:staging|browser print-to-PDF" README.md docs
pnpm typecheck
```

Expected: references exist and typecheck passes.

## Task 4: Full Verification

**Files:**
- All files changed in Tasks 1-3.

- [ ] **Step 1: Run all gates**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all exit 0.

- [ ] **Step 2: Verify generated artifacts are not staged unless intentionally tracked**

Run:

```bash
git status --short
```

Expected: `prisma/generated/schema.postgres.prisma` should either be ignored or intentionally tracked. Prefer ignoring generated files and regenerating during deploy.

- [ ] **Step 3: Commit**

Run from `/Users/lixinan/Desktop/简历修改工具`:

```bash
git add docs/superpowers/specs/2026-07-05-cloud-staging-deployment-design.md docs/superpowers/plans/2026-07-05-cloud-staging-deployment.md docs/superpowers/acceptance/2026-07-05-plan7-cloud-staging-deployment-acceptance.md web
git commit -m "docs: plan cloud staging deployment"
```

Expected: commit succeeds.
