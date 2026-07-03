# Resume SaaS Plan 2: AI Matching and Rewrite Implementation Plan

> **For agentic workers (Codex included):** This plan is written to be executed directly with no extra discovery. REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implement in order, run each task's verification, and commit after each task.

**Goal:** On top of the Plan 1 foundation, add the LLM layer and complete the middle of the product loop: free-text import → structured breakdown confirmation → JD parsing + experience recommendation → per-experience-block STAR rewrite confirmation. The terminal state of this plan is a working **rewrite-confirmation page**. The resume editor, templates, and PDF export remain **Plan 3** and must not be started here.

**Architecture:** Extend the existing `web/` Next.js app. Add three new Prisma models (`JobDescription`, `RewriteSession`, `RewrittenExperience`) plus supporting enums. Introduce a replaceable, testable `LLMProvider` abstraction with two implementations: a **DeepSeek** provider (OpenAI-compatible HTTP, production) and a **deterministic mock** provider (tests and no-key local dev). Experience↔JD matching is **deterministic** (keyword/skill overlap scoring) and does not call the LLM, so recommendations are explainable and unit-testable. Every LLM action costs **1 quota unit** and reuses the Plan 1 `assertCanConsume` / `recordUsage` services.

**Tech Stack (unchanged from Plan 1):** Next.js App Router (`next@16`, React 19), TypeScript, Tailwind CSS 4, Prisma 6 + SQLite (dev), Zod 4, Vitest, Playwright. **No new runtime dependency is required** — the DeepSeek provider uses the built-in `fetch`. Do not add the `openai` SDK.

> **Next.js version warning (from `web/AGENTS.md`):** this is `next@16.2.10` with breaking changes vs. older training data. Before writing any route/page code, read the relevant guide under `web/node_modules/next/dist/docs/`. Follow existing files in `web/src/app` as the source of truth for conventions (async `cookies()`, route handler signatures, server/client component split).

---

## Prerequisites (verify before Task 1)

Plan 1 is complete and on branch history. Confirm the baseline is green:

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

All four must exit 0. If they do not, stop — Plan 2 assumes a working Plan 1 foundation. Do a fresh branch for this plan:

```bash
git checkout -b plan2-ai-matching-rewrite
```

## Scope: what Plan 2 does and does NOT include

**In scope (PRD Tasks 3, 4, 5):**

- Free-text import → LLM structured breakdown → user confirmation form (unconfirmed data never auto-saved).
- JD input, LLM parsing (requirements / skills / keywords / language), persistence.
- Deterministic experience recommendation with explainable match reasons; user can add/remove selections including non-recommended experiences.
- Per-experience-block STAR rewrite with a default "reasonable completion" mode and an independent, default-off "packaging" mode (truthfulness warning before enabling).
- Chinese / English / bilingual output.
- Rewrite-confirmation page: original vs. rewrite vs. match reason vs. pending claims, with confirm / edit / reject per block.
- Quota consumption + usage logging for every LLM call.

**Out of scope (do NOT build here — later plans):** resume editor, template customization, "my templates", PDF export, resume scoring (the product has NO scoring entry, ever), payments/subscriptions, Word/PDF template upload recognition.

## New environment variables

Append to `web/.env.example` (and document in README). All have safe defaults so the app runs mock-only with zero secrets:

```dotenv
# LLM provider selection: "deepseek" or "mock".
# If unset or set to "mock", or if DEEPSEEK_API_KEY is empty, the mock provider is used.
LLM_PROVIDER="mock"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
```

**Provider selection rule (single source of truth in `createProvider()`):** use the DeepSeek provider only when `LLM_PROVIDER === "deepseek"` AND `DEEPSEEK_API_KEY` is non-empty. Otherwise use the mock provider. This guarantees tests and CI never make network calls.

## Data Model additions

Append these enums and models to `web/prisma/schema.prisma`, and add the listed back-relations to the existing `User` and `Experience` models. Do not modify existing fields.

```prisma
enum RewriteMode {
  DEFAULT
  PACKAGING
}

enum LanguageMode {
  ZH
  EN
  BILINGUAL
}

enum RewriteSessionStatus {
  DRAFT
  READY
  COMPLETED
}

enum RewriteDecision {
  PENDING
  ACCEPTED
  EDITED
  REJECTED
}

model JobDescription {
  id                 String           @id @default(cuid())
  userId             String
  title              String           @default("")
  company            String           @default("")
  rawText            String
  parsedRequirements Json             @default("[]")
  parsedSkills       Json             @default("[]")
  parsedKeywords     Json             @default("[]")
  language           String           @default("")
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  user               User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  rewriteSessions    RewriteSession[]

  @@index([userId, createdAt])
}

model RewriteSession {
  id                    String                @id @default(cuid())
  userId                String
  jdId                  String
  selectedExperienceIds Json                  @default("[]")
  mode                  RewriteMode           @default(DEFAULT)
  languageMode          LanguageMode          @default(ZH)
  status                RewriteSessionStatus  @default(DRAFT)
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  user                  User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  jd                    JobDescription        @relation(fields: [jdId], references: [id], onDelete: Cascade)
  rewrittenExperiences  RewrittenExperience[]

  @@index([userId, status])
}

model RewrittenExperience {
  id                 String          @id @default(cuid())
  sessionId          String
  sourceExperienceId String?
  originalSnapshot   Json
  matchReason        String          @default("")
  matchScore         Int             @default(0)
  rewrittenText      String          @default("")
  pendingClaims      Json            @default("[]")
  userEditedText     String          @default("")
  decision           RewriteDecision @default(PENDING)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  session            RewriteSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sourceExperience   Experience?     @relation(fields: [sourceExperienceId], references: [id], onDelete: SetNull)

  @@index([sessionId])
}
```

Add to the existing `User` model:

```prisma
  jobDescriptions JobDescription[]
  rewriteSessions RewriteSession[]
```

Add to the existing `Experience` model:

```prisma
  rewrittenExperiences RewrittenExperience[]
```

**Design note (why `sourceExperienceId` is nullable + `SetNull`):** PRD §5.2 requires resume history to keep a snapshot so later library edits do not pollute past resumes. `originalSnapshot` stores a JSON copy of the experience at rewrite time, and `SetNull` (not `Cascade`) means deleting the source experience preserves the rewritten record and its snapshot rather than destroying history.

## File Structure (files this plan creates)

Under `/Users/lixinan/Desktop/简历修改工具/web`:

- `src/lib/llm/types.ts`: shared LLM result types + Zod schemas (`ImportResult`, `JdParseResult`, `RewriteResult`), and the `LLMProvider` interface.
- `src/lib/llm/mock.ts`: deterministic mock provider.
- `src/lib/llm/deepseek.ts`: DeepSeek OpenAI-compatible provider (via `fetch`).
- `src/lib/llm/provider.ts`: `createProvider()` selector + a `getProvider()` singleton.
- `src/lib/import/import-service.ts`: free-text → structured breakdown (LLM), returns a draft; never writes to DB.
- `src/lib/jd/jd-service.ts`: JD parse (LLM) + persistence.
- `src/lib/match/match-service.ts`: deterministic experience scoring/recommendation (no LLM).
- `src/lib/rewrite/rewrite-service.ts`: create session, generate rewrites (LLM), record decisions, gate progression.
- `src/app/api/import/route.ts`: `POST` free-text breakdown (quota-consuming).
- `src/app/api/jd/route.ts`: `POST` parse+save JD, `GET` list JDs (quota-consuming on parse).
- `src/app/api/match/route.ts`: `POST` returns recommendations for a JD (deterministic, no quota).
- `src/app/api/rewrite/route.ts`: `POST` create session + generate rewrites (quota-consuming per block).
- `src/app/api/rewrite/[id]/route.ts`: `GET` session detail, `PATCH` a block decision (confirm/edit/reject).
- `src/app/(app)/library/import-dialog.tsx`: import UI wired into the library page.
- `src/app/(app)/match/page.tsx` + `match-client.tsx`: JD input + recommendation UI.
- `src/app/(app)/rewrite/[id]/page.tsx` + `rewrite-client.tsx`: rewrite-confirmation UI.
- `tests/unit/llm-mock.test.ts`: mock provider determinism.
- `tests/unit/match-service.test.ts`: scoring + recommendation correctness.
- `tests/unit/import-service.test.ts`: breakdown draft + pending-claim marking.
- `tests/unit/rewrite-service.test.ts`: session creation, quota gating, decision transitions.
- `tests/e2e/ai-flow.spec.ts`: import → JD → recommend → rewrite-confirm smoke (mock provider).

Also modify: `web/prisma/schema.prisma`, `web/.env.example`, `web/README.md`, `web/src/app/(app)/layout.tsx` (activate the `JD 匹配` nav link), `web/prisma/seed.ts` (optional: add a sample JD).

---

## Task 1: Schema, enums, and local migration

**Files:**
- Modify: `web/prisma/schema.prisma`
- Modify: `web/.env.example`

- [ ] **Step 1: Add enums, models, and back-relations**

Apply the full Data Model additions above. Add the two back-relations to `User` and the one to `Experience`.

- [ ] **Step 2: Add env vars**

Append the four LLM env vars (see "New environment variables") to `web/.env.example`.

- [ ] **Step 3: Regenerate client and apply migration locally**

The local `scripts/sqlite-migrate.ts` only initializes a *fresh* database (it skips when a `User` table already exists). For local dev, the reliable path is to recreate the dev database from the updated schema. The dev DB holds only sample seed data, so this is safe:

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm db:generate
rm -f prisma/dev.db
pnpm db:migrate --name plan2_ai_matching_rewrite
pnpm db:seed
```

Expected: `prisma/migrations/*_plan2_ai_matching_rewrite/migration.sql` is written, the SQLite DB is recreated with all tables (old + new), and seed succeeds.

- [ ] **Step 4: Verify**

```bash
pnpm db:generate
pnpm typecheck
```

Expected: Prisma client types include `JobDescription`, `RewriteSession`, `RewrittenExperience`, and the new enums; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add web/prisma/schema.prisma web/.env.example web/prisma/migrations
git commit -m "feat: add jd, rewrite session, and rewritten experience schema"
```

## Task 2: LLM provider abstraction (types + mock + selector)

**Files:**
- Create: `web/src/lib/llm/types.ts`
- Create: `web/src/lib/llm/mock.ts`
- Create: `web/src/lib/llm/provider.ts`
- Create: `web/tests/unit/llm-mock.test.ts`

- [ ] **Step 1: Define result types, Zod schemas, and the provider interface**

Create `web/src/lib/llm/types.ts`:

```ts
import { z } from "zod";

// ---- Import (free-text breakdown) ----
export const StructuredExperienceSchema = z.object({
  type: z.enum(["PROJECT", "INTERNSHIP", "WORK", "EDUCATION", "SKILL"]),
  title: z.string().default(""),
  organization: z.string().default(""),
  role: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  summary: z.string().default(""),
  responsibilities: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  // Fields the model could not confirm from the source text. Never fabricate;
  // list them here so the UI can render them as "待确认".
  pendingClaims: z.array(z.string()).default([]),
});
export type StructuredExperience = z.infer<typeof StructuredExperienceSchema>;

export const ImportResultSchema = z.object({
  experiences: z.array(StructuredExperienceSchema).default([]),
});
export type ImportResult = z.infer<typeof ImportResultSchema>;

// ---- JD parsing ----
export const JdParseResultSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  language: z.enum(["zh", "en", "mixed"]).default("mixed"),
  requirements: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});
export type JdParseResult = z.infer<typeof JdParseResultSchema>;

// ---- Rewrite ----
export const RewriteResultSchema = z.object({
  // STAR-structured rewrite. When languageMode is BILINGUAL, include both.
  rewrittenText: z.string().default(""),
  pendingClaims: z.array(z.string()).default([]),
});
export type RewriteResult = z.infer<typeof RewriteResultSchema>;

export type RewriteMode = "DEFAULT" | "PACKAGING";
export type LanguageMode = "ZH" | "EN" | "BILINGUAL";

export interface RewriteRequest {
  experience: {
    type: string;
    title: string;
    organization: string;
    role: string;
    rawText: string;
    skills: string[];
    tags: string[];
    metrics: string[];
  };
  jd: JdParseResult;
  mode: RewriteMode;
  languageMode: LanguageMode;
}

export interface LLMProvider {
  readonly name: "deepseek" | "mock";
  extractStructuredExperience(rawText: string): Promise<ImportResult>;
  parseJobDescription(rawText: string): Promise<JdParseResult>;
  rewriteExperience(request: RewriteRequest): Promise<RewriteResult>;
}
```

- [ ] **Step 2: Implement the deterministic mock provider**

Create `web/src/lib/llm/mock.ts`. It must be **pure and deterministic** (no randomness, no network, no clock) so tests are stable. Derive output from the input text.

```ts
import type {
  ImportResult,
  JdParseResult,
  LLMProvider,
  RewriteRequest,
  RewriteResult,
} from "./types";

function words(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9一-鿿+#.]+/i)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2),
    ),
  );
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock" as const;

  async extractStructuredExperience(rawText: string): Promise<ImportResult> {
    const firstLine = rawText.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "Imported Experience";
    const skills = words(rawText).slice(0, 5);
    return {
      experiences: [
        {
          type: "PROJECT",
          title: firstLine.slice(0, 80),
          organization: "",
          role: "",
          startDate: "",
          endDate: "",
          summary: rawText.trim().slice(0, 280),
          responsibilities: [],
          achievements: [],
          skills,
          tags: skills.slice(0, 2),
          // Deterministically flag anything the mock cannot know for sure.
          pendingClaims: ["organization", "startDate", "endDate"],
        },
      ],
    };
  }

  async parseJobDescription(rawText: string): Promise<JdParseResult> {
    const tokens = words(rawText);
    return {
      title: rawText.split(/\r?\n/)[0]?.trim().slice(0, 80) ?? "",
      company: "",
      language: /[一-鿿]/.test(rawText) ? "zh" : "en",
      requirements: rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .slice(0, 8),
      skills: tokens.slice(0, 8),
      keywords: tokens.slice(0, 12),
    };
  }

  async rewriteExperience(request: RewriteRequest): Promise<RewriteResult> {
    const { experience, mode, languageMode } = request;
    const tag = mode === "PACKAGING" ? "[packaged]" : "[default]";
    const zh = `${tag} 情境：${experience.title}。行动：基于 ${experience.skills.join("、") || "相关技能"} 推进工作。结果：交付可衡量成果。`;
    const en = `${tag} Situation: ${experience.title}. Action: drove the work using ${experience.skills.join(", ") || "relevant skills"}. Result: delivered measurable outcomes.`;
    const rewrittenText =
      languageMode === "ZH" ? zh : languageMode === "EN" ? en : `${zh}\n\n${en}`;
    return {
      rewrittenText,
      // Mock never invents metrics; unconfirmed quantification is surfaced.
      pendingClaims: experience.metrics.length === 0 ? ["quantified impact"] : [],
    };
  }
}
```

- [ ] **Step 3: Implement the selector**

Create `web/src/lib/llm/provider.ts`:

```ts
import { DeepSeekLLMProvider } from "./deepseek";
import { MockLLMProvider } from "./mock";
import type { LLMProvider } from "./types";

export function createProvider(): LLMProvider {
  const useDeepSeek =
    process.env.LLM_PROVIDER === "deepseek" && Boolean(process.env.DEEPSEEK_API_KEY);
  return useDeepSeek ? new DeepSeekLLMProvider() : new MockLLMProvider();
}

let cached: LLMProvider | undefined;
export function getProvider(): LLMProvider {
  if (!cached) cached = createProvider();
  return cached;
}
```

> Note: `provider.ts` imports `./deepseek`, so implement Task 3 in the same pass, or add a temporary stub. Recommended: do Task 2 and Task 3 together, commit once at the end of Task 3.

- [ ] **Step 4: Write mock determinism tests**

Create `web/tests/unit/llm-mock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "../../src/lib/llm/mock";

const provider = new MockLLMProvider();

describe("MockLLMProvider", () => {
  it("is deterministic for the same input", async () => {
    const a = await provider.extractStructuredExperience("Built an NLP pipeline with BERT.");
    const b = await provider.extractStructuredExperience("Built an NLP pipeline with BERT.");
    expect(a).toEqual(b);
  });

  it("marks unknown fields as pending claims, never fabricating them", async () => {
    const result = await provider.extractStructuredExperience("Sentiment analysis project");
    expect(result.experiences[0].pendingClaims).toContain("organization");
  });

  it("honors language mode in rewrite output", async () => {
    const base = {
      experience: { type: "PROJECT", title: "ABSA", organization: "", role: "", rawText: "x", skills: ["Python"], tags: [], metrics: [] },
      jd: { title: "", company: "", language: "en" as const, requirements: [], skills: [], keywords: [] },
      mode: "DEFAULT" as const,
    };
    const zh = await provider.rewriteExperience({ ...base, languageMode: "ZH" });
    const en = await provider.rewriteExperience({ ...base, languageMode: "EN" });
    const bi = await provider.rewriteExperience({ ...base, languageMode: "BILINGUAL" });
    expect(zh.rewrittenText).toMatch(/情境/);
    expect(en.rewrittenText).toMatch(/Situation/);
    expect(bi.rewrittenText).toMatch(/情境/);
    expect(bi.rewrittenText).toMatch(/Situation/);
  });

  it("labels packaging output distinctly", async () => {
    const req = {
      experience: { type: "PROJECT", title: "ABSA", organization: "", role: "", rawText: "x", skills: [], tags: [], metrics: [] },
      jd: { title: "", company: "", language: "en" as const, requirements: [], skills: [], keywords: [] },
      languageMode: "EN" as const,
    };
    const def = await provider.rewriteExperience({ ...req, mode: "DEFAULT" });
    const pkg = await provider.rewriteExperience({ ...req, mode: "PACKAGING" });
    expect(def.rewrittenText).toContain("[default]");
    expect(pkg.rewrittenText).toContain("[packaged]");
  });
});
```

- [ ] **Step 5: Verify (after Task 3 provides `deepseek.ts`)**

```bash
pnpm test tests/unit/llm-mock.test.ts
```

Expected: PASS.

## Task 3: DeepSeek provider (production)

**Files:**
- Create: `web/src/lib/llm/deepseek.ts`

- [ ] **Step 1: Implement the DeepSeek provider over `fetch`**

DeepSeek exposes an OpenAI-compatible Chat Completions API. Use `response_format: { type: "json_object" }` and validate every response with the Zod schemas from `types.ts`. On network error, non-2xx, or schema-validation failure, throw — callers treat a thrown provider error as a failed LLM action (usage logged as `FAILED`, quota not consumed).

Create `web/src/lib/llm/deepseek.ts`:

```ts
import {
  ImportResultSchema,
  JdParseResultSchema,
  RewriteResultSchema,
  type ImportResult,
  type JdParseResult,
  type LLMProvider,
  type RewriteRequest,
  type RewriteResult,
} from "./types";

type ChatMessage = { role: "system" | "user"; content: string };

export class DeepSeekLLMProvider implements LLMProvider {
  readonly name = "deepseek" as const;

  private async chatJson(messages: ChatMessage[]): Promise<unknown> {
    const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
    const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned an empty response");
    return JSON.parse(content);
  }

  async extractStructuredExperience(rawText: string): Promise<ImportResult> {
    const raw = await this.chatJson([
      {
        role: "system",
        content:
          "You convert a candidate's raw experience text into structured resume data. " +
          "Return JSON matching: { experiences: [{ type, title, organization, role, startDate, endDate, summary, responsibilities[], achievements[], skills[], tags[], pendingClaims[] }] }. " +
          "type is one of PROJECT, INTERNSHIP, WORK, EDUCATION, SKILL. " +
          "NEVER invent facts. Any field you cannot derive from the text must be left empty and its name added to pendingClaims.",
      },
      { role: "user", content: rawText },
    ]);
    return ImportResultSchema.parse(raw);
  }

  async parseJobDescription(rawText: string): Promise<JdParseResult> {
    const raw = await this.chatJson([
      {
        role: "system",
        content:
          "Extract structured requirements from a job description. " +
          "Return JSON: { title, company, language (zh|en|mixed), requirements[], skills[], keywords[] }. " +
          "skills and keywords should be concise, deduplicated, lowercase where reasonable.",
      },
      { role: "user", content: rawText },
    ]);
    return JdParseResultSchema.parse(raw);
  }

  async rewriteExperience(request: RewriteRequest): Promise<RewriteResult> {
    const truthfulness =
      request.mode === "PACKAGING"
        ? "Packaging mode: you may strengthen phrasing and emphasize impact and job relevance, " +
          "but you must NOT fabricate companies, certificates, projects, hard metrics, or any unconfirmed fact."
        : "Default mode: you may suggest reasonable methodology/tech-stack framing, " +
          "but anything not supported by the source must be listed in pendingClaims, not asserted.";
    const language =
      request.languageMode === "ZH"
        ? "Write the rewrite in Chinese."
        : request.languageMode === "EN"
          ? "Write the rewrite in English."
          : "Write the rewrite in Chinese first, then an English version, separated by a blank line.";

    const raw = await this.chatJson([
      {
        role: "system",
        content:
          "Rewrite one complete experience block using STAR (Situation, Task, Action, Result). " +
          "Return JSON: { rewrittenText, pendingClaims[] }. " +
          `${truthfulness} ${language}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          jd: request.jd,
          experience: request.experience,
        }),
      },
    ]);
    return RewriteResultSchema.parse(raw);
  }
}
```

- [ ] **Step 2: Verify Task 2 + Task 3 together**

```bash
pnpm test tests/unit/llm-mock.test.ts
pnpm typecheck
```

Expected: PASS, typecheck exits 0. No network calls occur (tests use `MockLLMProvider` directly).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/llm web/tests/unit/llm-mock.test.ts
git commit -m "feat: add replaceable llm provider with deepseek and mock"
```

## Task 4: Free-text import and AI breakdown

**Files:**
- Create: `web/src/lib/import/import-service.ts`
- Create: `web/src/app/api/import/route.ts`
- Create: `web/src/app/(app)/library/import-dialog.tsx`
- Create: `web/tests/unit/import-service.test.ts`
- Modify: `web/src/app/(app)/library/library-client.tsx` (mount the import dialog)

- [ ] **Step 1: Write the import service test**

Create `web/tests/unit/import-service.test.ts`. It uses the mock provider (inject it, do not rely on env). It must assert:
- The service returns a **draft** and writes **nothing** to the database.
- Fields the model could not confirm appear in `pendingClaims`.

```ts
import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "../../src/lib/llm/mock";
import { breakdownFreeText } from "../../src/lib/import/import-service";
import { db } from "../../src/lib/db";

describe("breakdownFreeText", () => {
  it("returns an editable draft without persisting anything", async () => {
    const before = await db.experience.count();
    const draft = await breakdownFreeText("Built an ABSA project with BERT.", new MockLLMProvider());
    const after = await db.experience.count();

    expect(after).toBe(before);
    expect(draft.experiences).toHaveLength(1);
    expect(draft.experiences[0].pendingClaims.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement the import service**

`breakdownFreeText(rawText, provider)` calls `provider.extractStructuredExperience` and returns the parsed `ImportResult`. It does **not** touch the DB and does **not** consume quota (quota is charged at the route boundary so the service stays pure and testable). Signature:

```ts
import type { ImportResult, LLMProvider } from "@/lib/llm/types";

export async function breakdownFreeText(
  rawText: string,
  provider: LLMProvider,
): Promise<ImportResult> {
  const text = rawText.trim();
  if (!text) throw new Error("rawText is required");
  return provider.extractStructuredExperience(text);
}
```

- [ ] **Step 3: Implement the import API route**

Create `web/src/app/api/import/route.ts`. It must: `requireUser()`, validate input with Zod, `assertCanConsume(user.id, 1)`, call the service with `getProvider()`, then `recordUsage({ actionType: "import", costUnits: 1, status })`. On provider failure, record `FAILED` (no quota consumed) and return 502. Never accept `userId` from the body. Confirmed drafts are saved later through the **existing** `POST /api/experiences` route — the import route itself never writes experiences.

Contract:
- Request: `{ rawText: string }`
- 200: `{ draft: ImportResult }`
- 400 invalid input, 402 `{ error: "Quota exceeded" }`, 502 on LLM failure.

- [ ] **Step 4: Implement the import dialog UI**

Create `import-dialog.tsx`: a textarea + "AI 拆解" button that calls `POST /api/import`, renders the returned draft as an **editable** form with each experience's fields, shows `pendingClaims` as clearly-labeled "待确认" chips, and on "保存到信息库" calls the existing `POST /api/experiences` per confirmed block. Nothing is saved until the user confirms. Mount it in `library-client.tsx` under a "粘贴文本导入" entry.

- [ ] **Step 5: Verify**

```bash
pnpm test tests/unit/import-service.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/import web/src/app/api/import "web/src/app/(app)/library" web/tests/unit/import-service.test.ts
git commit -m "feat: add free-text import with ai breakdown confirmation"
```

## Task 5: JD parsing and deterministic recommendation

**Files:**
- Create: `web/src/lib/jd/jd-service.ts`
- Create: `web/src/lib/match/match-service.ts`
- Create: `web/src/app/api/jd/route.ts`
- Create: `web/src/app/api/match/route.ts`
- Create: `web/tests/unit/match-service.test.ts`

- [ ] **Step 1: Write the match-service test (deterministic, no LLM)**

Create `web/tests/unit/match-service.test.ts`. Assert:
- An experience whose skills/tags overlap the JD skills scores higher than one with no overlap.
- The returned `matchReason` names at least one concrete matched skill/keyword.
- Zero-overlap experiences are still returned (so the user can manually pick non-recommended items) but flagged `recommended: false`.

```ts
import { describe, expect, it } from "vitest";
import { scoreExperiences } from "../../src/lib/match/match-service";

const jd = {
  title: "ML Intern",
  company: "",
  language: "en" as const,
  requirements: ["build ML models"],
  skills: ["python", "bert", "pytorch"],
  keywords: ["nlp", "python", "bert", "pytorch", "model"],
};

describe("scoreExperiences", () => {
  it("ranks overlapping experiences above non-overlapping ones", () => {
    const ranked = scoreExperiences(
      [
        { id: "a", title: "ABSA", rawText: "sentiment analysis", skills: ["Python", "BERT"], tags: ["NLP"] },
        { id: "b", title: "Cafe job", rawText: "made coffee", skills: ["Latte art"], tags: ["service"] },
      ],
      jd,
    );
    expect(ranked[0].id).toBe("a");
    expect(ranked[0].recommended).toBe(true);
    expect(ranked[0].matchReason).toMatch(/python|bert/i);
    const b = ranked.find((r) => r.id === "b");
    expect(b?.recommended).toBe(false);
    expect(b).toBeDefined(); // non-recommended still selectable
  });
});
```

- [ ] **Step 2: Implement the deterministic match service**

`scoreExperiences(experiences, jd)` computes, per experience, the overlap between a normalized token set (skills + tags + title + rawText) and the JD's `skills ∪ keywords`. Score = count of matched JD skills (weighted x2) + matched keywords (x1). `recommended = score > 0`. `matchReason` lists the matched skills/keywords (e.g., `"命中技能: python, bert"`). Sort by score desc, stable by original order. Pure function, no DB, no LLM.

```ts
import type { JdParseResult } from "@/lib/llm/types";

export interface MatchCandidate {
  id: string;
  title: string;
  rawText: string;
  skills: string[];
  tags: string[];
}

export interface MatchResult extends MatchCandidate {
  score: number;
  matchedSkills: string[];
  matchedKeywords: string[];
  matchReason: string;
  recommended: boolean;
}

function normalize(values: string[]): Set<string> {
  return new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean));
}

export function scoreExperiences(experiences: MatchCandidate[], jd: JdParseResult): MatchResult[] {
  const jdSkills = normalize(jd.skills);
  const jdKeywords = normalize(jd.keywords);

  return experiences
    .map((exp, index) => {
      const haystack = normalize([...exp.skills, ...exp.tags, exp.title, ...exp.rawText.split(/\s+/)]);
      const matchedSkills = [...jdSkills].filter((s) => haystack.has(s));
      const matchedKeywords = [...jdKeywords].filter((k) => haystack.has(k) && !jdSkills.has(k));
      const score = matchedSkills.length * 2 + matchedKeywords.length;
      const reasonParts: string[] = [];
      if (matchedSkills.length) reasonParts.push(`命中技能: ${matchedSkills.join(", ")}`);
      if (matchedKeywords.length) reasonParts.push(`命中关键词: ${matchedKeywords.join(", ")}`);
      return {
        ...exp,
        score,
        matchedSkills,
        matchedKeywords,
        matchReason: reasonParts.join("；") || "无直接命中，可手动选择",
        recommended: score > 0,
        _index: index,
      };
    })
    .sort((a, b) => b.score - a.score || a._index - b._index)
    .map(({ _index, ...rest }) => rest);
}
```

- [ ] **Step 3: Implement the JD service and routes**

`jd-service.ts`: `parseAndSaveJd(userId, rawText, provider)` calls `provider.parseJobDescription`, then persists a `JobDescription` row (storing `parsedRequirements`/`parsedSkills`/`parsedKeywords`/`language`). Returns the saved row.

`POST /api/jd`: `requireUser`, validate `{ rawText }`, `assertCanConsume(user.id, 1)`, parse+save via `getProvider()`, `recordUsage({ actionType: "jd_parse", costUnits: 1, ... })`. `GET /api/jd`: list the user's JDs.

`POST /api/match`: `requireUser`, input `{ jdId }`, load the JD (ownership-checked) and the user's active experiences, return `scoreExperiences(...)`. **Deterministic — no quota consumed, no LLM.**

- [ ] **Step 4: Verify**

```bash
pnpm test tests/unit/match-service.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/jd web/src/lib/match web/src/app/api/jd web/src/app/api/match web/tests/unit/match-service.test.ts
git commit -m "feat: add jd parsing and deterministic experience recommendation"
```

## Task 6: Rewrite session, generation, and decisions

**Files:**
- Create: `web/src/lib/rewrite/rewrite-service.ts`
- Create: `web/src/app/api/rewrite/route.ts`
- Create: `web/src/app/api/rewrite/[id]/route.ts`
- Create: `web/tests/unit/rewrite-service.test.ts`

- [ ] **Step 1: Write the rewrite-service test**

Create `web/tests/unit/rewrite-service.test.ts` using the mock provider and the real DB (with `deleteMany` cleanup in `beforeEach`, matching `tests/unit/quota.test.ts`). Assert:
- Creating a session with N selected experiences generates N `RewrittenExperience` rows, each `decision = PENDING`, each with an `originalSnapshot`.
- A normal user with insufficient quota is rejected **before** any rewrite is generated (`assertCanConsume` gates the whole batch).
- `recordDecision` transitions a block to ACCEPTED / EDITED / REJECTED, and EDITED stores `userEditedText`.
- `canProceed(sessionId)` is true only when at least one block is ACCEPTED or EDITED.

- [ ] **Step 2: Implement the rewrite service**

Key functions (all ownership-checked by `userId`):

```ts
// Creates the session + one RewrittenExperience per selected experience.
// Charges 1 quota unit PER experience block. assertCanConsume is called once
// for the full batch cost BEFORE generating, so an over-quota user gets nothing
// generated and nothing charged. recordUsage runs per block after each success.
createRewriteSession(userId, input: {
  jdId: string;
  selectedExperienceIds: string[];
  mode: "DEFAULT" | "PACKAGING";
  languageMode: "ZH" | "EN" | "BILINGUAL";
}, provider): Promise<{ sessionId: string }>;

getRewriteSession(userId, sessionId): Promise<SessionDetail>; // jd + blocks with original + rewrite

recordDecision(userId, blockId, input: {
  decision: "ACCEPTED" | "EDITED" | "REJECTED";
  userEditedText?: string;
}): Promise<RewrittenExperience>;

canProceed(userId, sessionId): Promise<boolean>; // >=1 ACCEPTED or EDITED
```

Implementation notes:
- `originalSnapshot` = a JSON copy of the source experience at generation time (title, org, role, dates, rawText, skills, tags, metrics).
- Store `matchScore` / `matchReason` from `scoreExperiences` so the confirmation page can show why each block was selected. (Call `scoreExperiences` for the selected set using the JD; do not re-call the LLM.)
- Quota: compute `cost = selectedExperienceIds.length`; `await assertCanConsume(userId, cost)` once up front. Then for each block, call `provider.rewriteExperience(...)`; on success `recordUsage({ actionType: "rewrite", costUnits: 1, status: "SUCCESS", relatedObjectType: "RewrittenExperience", relatedObjectId })`; on provider failure record `FAILED` for that block and continue (that block keeps empty rewrite text + a failure marker). Admins bypass quota via the existing service logic.
- Set session `status = READY` after generation.

- [ ] **Step 3: Implement the routes**

`POST /api/rewrite`: `requireUser`, validate `{ jdId, selectedExperienceIds[], mode, languageMode }`, call `createRewriteSession(user.id, input, getProvider())`. On `Quota exceeded` return 402. Returns `{ sessionId }`.

`GET /api/rewrite/[id]`: `requireUser`, return `getRewriteSession(user.id, id)` (404 if not owned).

`PATCH /api/rewrite/[id]`: `requireUser`, body `{ blockId, decision, userEditedText? }`, call `recordDecision`. Returns the updated block. (Deciding does not consume quota.)

- [ ] **Step 4: Verify**

```bash
pnpm test tests/unit/rewrite-service.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rewrite web/src/app/api/rewrite web/tests/unit/rewrite-service.test.ts
git commit -m "feat: add star rewrite session generation and decisions"
```

## Task 7: Matching and rewrite-confirmation UI

**Files:**
- Create: `web/src/app/(app)/match/page.tsx`
- Create: `web/src/app/(app)/match/match-client.tsx`
- Create: `web/src/app/(app)/rewrite/[id]/page.tsx`
- Create: `web/src/app/(app)/rewrite/[id]/rewrite-client.tsx`
- Modify: `web/src/app/(app)/layout.tsx` (turn the `JD 匹配` span into a `Link` to `/match`)

- [ ] **Step 1: JD matching page**

`/match` (`match-client.tsx`): JD textarea + "解析并匹配" (calls `POST /api/jd` then `POST /api/match`). Render parsed JD keywords/skills as chips. Render the candidate list with **recommended items highlighted** and their `matchReason` shown; recommended items are pre-checked but non-recommended items are still selectable. Add mode toggle (`默认` / `包装模式`) — **packaging defaults off and shows a truthfulness warning before it can be enabled** — and a language selector (`中文` / `英文` / `双语`). "生成改写" calls `POST /api/rewrite` and navigates to `/rewrite/[sessionId]`.

- [ ] **Step 2: Rewrite-confirmation page**

`/rewrite/[id]` (`rewrite-client.tsx`): server page loads `getRewriteSession`. Render a JD summary header + the session's mode/language. For each block, an audit card showing: match reason, original snapshot, STAR rewrite, `pendingClaims` as "待确认" chips, packaging-mode indicator, and **确认 / 编辑 / 拒绝** actions (PATCH per block). Editing reveals a textarea saved as `userEditedText` (decision EDITED). A "进入简历编辑" button is **disabled until `canProceed` is true** (≥1 ACCEPTED/EDITED); its target route belongs to Plan 3, so for now it may link to a placeholder or be disabled with a "Plan 3" note. Clearly distinguish "AI 原始建议" from the user-confirmed version.

- [ ] **Step 3: Activate nav**

In `layout.tsx`, replace the `JD 匹配` `<span>` with `<Link href="/match">`. Leave `简历编辑` as a disabled span (Plan 3).

- [ ] **Step 4: Manual verification (mock provider, no key needed)**

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm dev
```

As the seeded student user: open `/library`, use "粘贴文本导入", confirm a block into the library; open `/match`, paste a JD, generate; on `/rewrite/[id]` confirm/edit/reject blocks; verify the proceed button enables only after ≥1 confirmation.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(app)/match" "web/src/app/(app)/rewrite" "web/src/app/(app)/layout.tsx"
git commit -m "feat: add jd matching and rewrite confirmation pages"
```

## Task 8: End-to-end AI flow smoke test

**Files:**
- Create: `web/tests/e2e/ai-flow.spec.ts`

- [ ] **Step 1: Add the e2e test**

The Playwright `webServer` runs `pnpm dev` with no `DEEPSEEK_API_KEY`, so the app runs on the **mock provider** — deterministic and offline. The flow:

1. Register + log in a fresh user.
2. In `/library`, import free text → confirm one block into the library.
3. In `/match`, paste a JD → parse → see recommendations highlighted → keep the recommended selection → choose language → generate.
4. On `/rewrite/[id]`, confirm at least one block; verify the proceed button becomes enabled.
5. Reject another block; verify it is marked rejected.

- [ ] **Step 2: Run the full suite**

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all four pass.

- [ ] **Step 3: Update README**

Document: the four LLM env vars, that leaving `DEEPSEEK_API_KEY` empty runs the mock provider, the per-action quota cost (1 unit each: import / jd_parse / rewrite-per-block), and the new pages (`/match`, `/rewrite/[id]`).

- [ ] **Step 4: Commit**

```bash
git add web/tests/e2e/ai-flow.spec.ts web/README.md
git commit -m "test: add end-to-end ai matching and rewrite smoke coverage"
```

## Self-Review

- Spec coverage in this plan:
  - Covered: free-text import + AI breakdown with pending-claim marking and confirm-before-save (PRD §5.3), JD parsing + explainable recommendation with recommended-highlight and manual non-recommended selection (PRD §5.4), per-experience-block STAR rewrite with default/packaging modes and bilingual output (PRD §5.5), rewrite-confirmation page with confirm/edit/reject and progression gate (PRD §5.6), quota + usage logging for every LLM action (PRD §5.9), replaceable LLM provider (PRD §8.3).
  - Not covered by design (assigned to Plan 3+): resume editor left/right layout, template customization, "my templates", PDF export, deployment/hardening. No resume scoring anywhere.
- Placeholder scan: no `TBD`/`TODO` markers; every task names exact files and concrete behavior or code. The only intentional forward-reference is the "进入简历编辑" target, explicitly deferred to Plan 3.
- Consistency check:
  - Enums: `RewriteMode` = DEFAULT/PACKAGING; `LanguageMode` = ZH/EN/BILINGUAL; `RewriteDecision` = PENDING/ACCEPTED/EDITED/REJECTED; `RewriteSessionStatus` = DRAFT/READY/COMPLETED.
  - Quota action types: `import`, `jd_parse`, `rewrite` — 1 unit each; matching consumes no quota.
  - Provider selection is centralized in `createProvider()`; tests always use `MockLLMProvider` and never hit the network.
  - Ownership: every service/route checks `userId`/`requireUser`/`requireAdmin`; `userId` is never accepted from a request body.
