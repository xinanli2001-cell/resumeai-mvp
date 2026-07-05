# Render Staging Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free-first Render-specific staging deployment configuration package for ResumeAI.

**Architecture:** Keep the app as one Render Node web service plus one Render PostgreSQL database. Add `render.yaml` at the repository root, validate it locally from `web/scripts/validate-render-blueprint.ts`, and document the human steps that still require Render account access. The validator reads the real root Blueprint file so tests and `pnpm validate:render` prove the committed deployment config stays aligned with Plan 8.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Render Blueprint YAML, PostgreSQL, Vitest, `yaml` package for parsing.

---

## File Structure

- Create `render.yaml`: root Render Blueprint with free `resumeai-staging` web service and free `resumeai-staging-db` PostgreSQL database.
- Create `web/.env.staging.example`: safe staging env template with placeholders only.
- Create `web/scripts/validate-render-blueprint.ts`: parses and validates the root Render Blueprint.
- Create `web/tests/unit/render-blueprint.test.ts`: unit tests for valid and invalid Blueprint behavior.
- Modify `web/package.json`: add `validate:render` and `yaml` dev dependency.
- Modify `web/README.md`: add Plan 8 summary and validation command.
- Modify `web/docs/cloud-staging-runbook.md`: add Render-specific deploy, smoke, backup, and rollback steps.
- Modify `web/docs/release-checklist.md`: add Render Blueprint validation gate.

## Task 1: Render Blueprint Validator

**Files:**
- Create: `web/tests/unit/render-blueprint.test.ts`
- Create: `web/scripts/validate-render-blueprint.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Add YAML parser dependency**

Run:

```bash
pnpm add -D yaml
```

Expected: `web/package.json` and `web/pnpm-lock.yaml` include `yaml`.

- [ ] **Step 2: Write the failing validator test**

Create `web/tests/unit/render-blueprint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateRenderBlueprint } from "../../scripts/validate-render-blueprint";

const validBlueprint = `
databases:
  - name: resumeai-staging-db
    databaseName: resumeai
    user: resumeai
    plan: free
services:
  - type: web
    name: resumeai-staging
    runtime: node
    rootDir: web
    plan: free
    numInstances: 1
    buildCommand: pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build
    startCommand: pnpm db:push:prod && pnpm db:seed && pnpm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: APP_ENV
        value: staging
      - key: DATABASE_URL
        fromDatabase:
          name: resumeai-staging-db
          property: connectionString
      - key: SESSION_SECRET
        sync: false
      - key: LLM_PROVIDER
        value: deepseek
      - key: DEEPSEEK_API_KEY
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
`;

describe("validateRenderBlueprint", () => {
  it("accepts the Render staging Blueprint shape", () => {
    expect(validateRenderBlueprint(validBlueprint)).toEqual([
      "one web service ok",
      "one postgres database ok",
      "web service config ok",
      "render env wiring ok",
    ]);
  });

  it("rejects a web service without the production migration command", () => {
    const invalid = validBlueprint.replace("pnpm db:push:prod && ", "");
    expect(() => validateRenderBlueprint(invalid)).toThrow("startCommand must include pnpm db:push:prod");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
pnpm test tests/unit/render-blueprint.test.ts
```

Expected: FAIL because `scripts/validate-render-blueprint.ts` does not exist.

- [ ] **Step 4: Implement the validator**

Create `web/scripts/validate-render-blueprint.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

type EnvVar = {
  key?: string;
  value?: string;
  sync?: boolean;
  fromDatabase?: {
    name?: string;
    property?: string;
  };
};

type RenderService = {
  type?: string;
  name?: string;
  runtime?: string;
  rootDir?: string;
  buildCommand?: string;
  startCommand?: string;
  numInstances?: number;
  envVars?: EnvVar[];
};

type RenderDatabase = {
  name?: string;
};

type RenderBlueprint = {
  services?: RenderService[];
  databases?: RenderDatabase[];
};

function requireCommand(command: string | undefined, expected: string, field: string) {
  if (!command?.includes(expected)) {
    throw new Error(`${field} must include ${expected}`);
  }
}

function envVarMap(envVars: EnvVar[] | undefined) {
  return new Map((envVars ?? []).filter((item) => item.key).map((item) => [item.key as string, item]));
}

function requireEnvValue(envVars: Map<string, EnvVar>, key: string, value: string) {
  const item = envVars.get(key);
  if (item?.value !== value) {
    throw new Error(`${key} must be ${value}`);
  }
}

function requireSecretPrompt(envVars: Map<string, EnvVar>, key: string) {
  const item = envVars.get(key);
  if (item?.sync !== false) {
    throw new Error(`${key} must use sync: false`);
  }
}

export function validateRenderBlueprint(source: string) {
  const blueprint = parse(source) as RenderBlueprint;
  const webServices = (blueprint.services ?? []).filter((service) => service.type === "web");
  if (webServices.length !== 1) throw new Error("render.yaml must define exactly one web service");

  const databases = blueprint.databases ?? [];
  if (databases.length !== 1) throw new Error("render.yaml must define exactly one Postgres database");
  const database = databases[0];
  if (database.name !== "resumeai-staging-db") {
    throw new Error("database must be named resumeai-staging-db");
  }

  const service = webServices[0];
  if (service.name !== "resumeai-staging") throw new Error("web service must be named resumeai-staging");
  if (service.runtime !== "node") throw new Error("web service runtime must be node");
  if (service.rootDir !== "web") throw new Error("web service rootDir must be web");
  if (service.numInstances !== 1) throw new Error("web service numInstances must be 1");
  requireCommand(service.buildCommand, "pnpm install --frozen-lockfile", "buildCommand");
  requireCommand(service.buildCommand, "--prod=false", "buildCommand");
  requireCommand(service.buildCommand, "pnpm db:generate:prod", "buildCommand");
  requireCommand(service.buildCommand, "pnpm build", "buildCommand");
  requireCommand(service.startCommand, "pnpm db:push:prod", "startCommand");
  requireCommand(service.startCommand, "pnpm db:seed", "startCommand");
  requireCommand(service.startCommand, "pnpm start", "startCommand");

  const envVars = envVarMap(service.envVars);
  requireEnvValue(envVars, "NODE_ENV", "production");
  requireEnvValue(envVars, "APP_ENV", "staging");
  requireEnvValue(envVars, "LLM_PROVIDER", "deepseek");
  requireSecretPrompt(envVars, "SESSION_SECRET");
  requireSecretPrompt(envVars, "DEEPSEEK_API_KEY");
  requireSecretPrompt(envVars, "ADMIN_PASSWORD");

  const databaseUrl = envVars.get("DATABASE_URL");
  if (
    databaseUrl?.fromDatabase?.name !== "resumeai-staging-db" ||
    databaseUrl.fromDatabase.property !== "connectionString"
  ) {
    throw new Error("DATABASE_URL must reference resumeai-staging-db connectionString");
  }

  return ["one web service ok", "one postgres database ok", "web service config ok", "render env wiring ok"];
}

export function validateRenderBlueprintFile(filePath = path.resolve(process.cwd(), "..", "render.yaml")) {
  return validateRenderBlueprint(readFileSync(filePath, "utf8"));
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isMain) {
  const results = validateRenderBlueprintFile();
  for (const result of results) console.log(result);
}
```

- [ ] **Step 5: Add package script**

Modify `web/package.json` scripts:

```json
"validate:render": "tsx scripts/validate-render-blueprint.ts"
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
pnpm test tests/unit/render-blueprint.test.ts
```

Expected: PASS.

## Task 2: Render Blueprint and Staging Env Template

**Files:**
- Create: `render.yaml`
- Create: `web/.env.staging.example`
- Test: `web/tests/unit/render-blueprint.test.ts`

- [ ] **Step 1: Create Render Blueprint**

Create root `render.yaml`:

```yaml
databases:
  - name: resumeai-staging-db
    databaseName: resumeai
    user: resumeai
    plan: free

services:
  - type: web
    name: resumeai-staging
    runtime: node
    rootDir: web
    plan: free
    numInstances: 1
    buildCommand: pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build
    startCommand: pnpm db:push:prod && pnpm db:seed && pnpm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: APP_ENV
        value: staging
      - key: DATABASE_URL
        fromDatabase:
          name: resumeai-staging-db
          property: connectionString
      - key: SESSION_SECRET
        sync: false
      - key: LLM_PROVIDER
        value: deepseek
      - key: DEEPSEEK_API_KEY
        sync: false
      - key: DEEPSEEK_BASE_URL
        value: https://api.deepseek.com
      - key: DEEPSEEK_MODEL
        value: deepseek-chat
      - key: LLM_RATE_LIMIT_PER_MINUTE
        value: "10"
      - key: MAX_TEXT_BYTES
        value: "20000"
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
```

- [ ] **Step 2: Create staging env template**

Create `web/.env.staging.example`:

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

- [ ] **Step 3: Validate committed Blueprint**

Run:

```bash
pnpm validate:render
```

Expected: prints four `ok` lines.

## Task 3: Render Documentation

**Files:**
- Modify: `web/docs/cloud-staging-runbook.md`
- Modify: `web/docs/release-checklist.md`
- Modify: `web/README.md`

- [ ] **Step 1: Update cloud staging runbook**

Add a `## Render Blueprint Deployment` section covering:

- `render.yaml` lives at repo root.
- In Render Dashboard, use New > Blueprint, connect the repo and branch, review resources, then deploy.
- Confirm web service root is `web`.
- Confirm build command is `pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build`.
- Confirm start command is `pnpm db:push:prod && pnpm db:seed && pnpm start`.
- Fill `sync: false` secrets in Render Dashboard: `SESSION_SECRET`, `DEEPSEEK_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Run `pnpm validate:render` before pushing Blueprint changes.
- Run `STAGING_BASE_URL="https://YOUR_RENDER_STAGING_URL" pnpm smoke:staging` after deployment.
- Enable or confirm PostgreSQL backups/snapshots before inviting testers.
- Use Render rollback to return to the previous deploy if startup or smoke fails.

- [ ] **Step 2: Update release checklist**

Add checklist items:

```markdown
- Render Blueprint validation passes with `pnpm validate:render`.
- Render staging secrets marked `sync: false` have been filled in the Render dashboard.
```

- [ ] **Step 3: Update README**

Add Plan 8 summary and include `pnpm validate:render` in checks.

- [ ] **Step 4: Verify docs contain required terms**

Run:

```bash
rg -n "Plan 8|validate:render|Render Blueprint|render.yaml|sync: false|YOUR_RENDER_STAGING_URL" README.md docs
```

Expected: README and docs contain the Render staging references.

## Task 4: Full Verification and Commit

**Files:**
- All Plan 8 files.

- [ ] **Step 1: Validate Render Blueprint**

Run:

```bash
pnpm validate:render
```

Expected: exits 0 and prints four `ok` lines.

- [ ] **Step 2: Run local gates**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
E2E_PORT=3001 pnpm test:e2e
```

Expected: all exit 0.

- [ ] **Step 3: Inspect generated/ignored files**

Run:

```bash
git status --short --ignored=matching
git diff --check
```

Expected: no untracked generated files intended for commit; no whitespace errors.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add render.yaml docs/superpowers/plans/2026-07-05-render-staging-config.md web/.env.staging.example web/package.json web/pnpm-lock.yaml web/scripts/validate-render-blueprint.ts web/tests/unit/render-blueprint.test.ts web/docs/cloud-staging-runbook.md web/docs/release-checklist.md web/README.md
git commit -m "feat: add render staging config"
```

Expected: commit succeeds.
