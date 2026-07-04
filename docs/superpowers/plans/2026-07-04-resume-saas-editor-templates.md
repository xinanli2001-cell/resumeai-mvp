# Resume SaaS Plan 3: Resume Editor and Templates Implementation Plan

> **For agentic workers (Codex included):** This plan is written to be executed directly with no extra discovery. REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Implement in order, run each task's verification, and commit after each task.

**Goal:** On top of the Plan 1 foundation and Plan 2 AI loop, build the resume editor and template system. A user turns a confirmed rewrite session into an editable resume: left side shows the personal library for reference, right side is the resume editor/preview. The user reorders and shows/hides modules, edits text, switches between system templates, and saves customizations as "my template". Bilingual output is carried from the rewrite stage. This plan connects Plan 2 → Plan 3 by making the rewrite-confirmation page's "进入简历编辑" button create a resume and navigate to it.

**PDF export is explicitly NOT in this plan.** Per product owner decision (2026-07-04), PDF export is deferred to a later plan. Do not add any PDF library, print route, or export button in Plan 3. The editor persists and previews resumes on screen only.

**Architecture:** Extend the existing `web/` Next.js app. Add two Prisma models (`Resume`, `Template`) plus a `ResumeStatus` enum. Resume content lives in a resolved `contentSnapshot` (JSON) so later library edits do not retroactively change a saved resume — the same snapshot discipline used for rewrites in Plan 2. Template presentation lives in `Template.config` (JSON) and must never mutate resume content. Assembly of a resume from a rewrite session is a **pure, unit-testable function**. No LLM calls and no quota consumption occur anywhere in this plan.

**Tech Stack (unchanged):** Next.js App Router (`next@16`, React 19), TypeScript, Tailwind CSS 4, Prisma 6 + SQLite (dev), Zod 4, Vitest, Playwright. **No new dependency is required.**

> **Next.js version warning (from `web/AGENTS.md`):** this is `next@16.2.10` with breaking changes vs. older training data. Read the relevant guide under `web/node_modules/next/dist/docs/` before writing route/page code, and follow existing files in `web/src/app` (async `cookies()`, route-handler signatures, server/client split) as the source of truth.

---

## Prerequisites (verify before Task 1)

Plan 1 and Plan 2 are complete. Confirm the baseline is green:

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

All must exit 0. Then branch:

```bash
git checkout -b plan3-editor-templates
```

## Scope: what Plan 3 does and does NOT include

**In scope (PRD Task 6, §5.7, §5.8):**

- Create a resume from a confirmed rewrite session (only ACCEPTED/EDITED blocks flow in).
- Resume editor: left = personal library (reference), right = resume editor/preview.
- Module (section) reordering and show/hide.
- Inline text editing of resume content.
- 2 system templates; switch template on a resume.
- In-platform template customization (module order, font, size, spacing, color, heading style, header style).
- Save customization as "my template"; reuse it across resumes.
- Bilingual: one `Resume` + `language` field (zh/en/bilingual), text carried from the rewrite stage.
- Save and reload a resume version (content persists across refresh).

**Out of scope (do NOT build here):**

- **PDF export (deferred by product decision).** No print route, no export button, no PDF dependency.
- Resume scoring (the product has NO scoring entry, ever).
- Payments/subscriptions, template marketplace, Word/PDF template upload recognition.
- Deployment/hardening (Plan 4).

## Data Model additions

Append to `web/prisma/schema.prisma`. Add the listed back-relations to the existing `User` and `RewriteSession` models. Do not modify existing fields.

```prisma
enum ResumeStatus {
  DRAFT
  FINALIZED
}

model Template {
  id             String   @id @default(cuid())
  ownerUserId    String?  // null => system template
  name           String
  baseTemplateId String?  // the system/user template this was derived from
  config         Json     @default("{}")
  isSystem       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  owner          User?    @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  resumes        Resume[]

  @@index([ownerUserId])
}

model Resume {
  id              String       @id @default(cuid())
  userId          String
  sessionId       String?      // origin RewriteSession, nullable (SetNull preserves the resume)
  title           String       @default("")
  language        String       @default("zh") // "zh" | "en" | "bilingual"
  templateId      String?
  contentSnapshot Json         @default("{}")
  status          ResumeStatus @default(DRAFT)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  session         RewriteSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  template        Template?       @relation(fields: [templateId], references: [id], onDelete: SetNull)

  @@index([userId, status])
}
```

Add to the existing `User` model:

```prisma
  templates Template[]
  resumes   Resume[]
```

Add to the existing `RewriteSession` model:

```prisma
  resumes Resume[]
```

**Design notes:**
- `Resume.contentSnapshot` is the resolved, editable resume state (see the shape below). It is a snapshot: editing the library or the source rewrite session later does NOT change a saved resume. `sessionId` uses `SetNull` so deleting the session preserves the resume.
- `Template.config` is presentation-only. Switching a template updates `Resume.templateId`, never `contentSnapshot`.
- `Template.ownerUserId == null && isSystem == true` marks a system template (seeded, not user-owned).

## Canonical JSON shapes (target contracts for Codex)

Define these as Zod schemas in `src/lib/resume/resume-content.ts` and `src/lib/template/template-config.ts`. All persisted/patched JSON must validate against them.

**`ResumeContent` (`Resume.contentSnapshot`):**

```ts
// src/lib/resume/resume-content.ts
import { z } from "zod";

export const ResumeItemSchema = z.object({
  id: z.string(),                    // stable id for reorder/edit
  heading: z.string().default(""),   // e.g. project/company/role title
  subheading: z.string().default(""),// e.g. organization + role
  dateRange: z.string().default(""),
  body: z.string().default(""),      // the confirmed rewrite text (STAR)
  sourceRewrittenId: z.string().optional(), // provenance back to RewrittenExperience
});

export const ResumeSectionSchema = z.object({
  id: z.string(),
  type: z.enum(["SUMMARY", "EDUCATION", "PROJECT", "INTERNSHIP", "WORK", "SKILL", "CUSTOM"]),
  title: z.string(),                 // section heading, e.g. "项目经历"
  visible: z.boolean().default(true),
  items: z.array(ResumeItemSchema).default([]),
});

export const ResumeHeaderSchema = z.object({
  name: z.string().default(""),
  targetTitle: z.string().default(""),
  location: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  website: z.string().default(""),
});

export const ResumeContentSchema = z.object({
  header: ResumeHeaderSchema,
  sections: z.array(ResumeSectionSchema).default([]),
});
export type ResumeContent = z.infer<typeof ResumeContentSchema>;
```

**`TemplateConfig` (`Template.config`):**

```ts
// src/lib/template/template-config.ts
import { z } from "zod";

export const TemplateConfigSchema = z.object({
  sectionOrder: z.array(z.string()).default([]), // section types, controls render order
  font: z.object({
    family: z.string().default("system-ui"),
    sizePt: z.number().default(11),
  }).default({}),
  spacing: z.object({
    sectionGap: z.number().default(16),
    lineHeight: z.number().default(1.4),
  }).default({}),
  color: z.object({
    primary: z.string().default("#0f172a"),
    text: z.string().default("#0b1c30"),
  }).default({}),
  heading: z.object({
    style: z.enum(["underline", "bar", "plain"]).default("bar"),
    uppercase: z.boolean().default(false),
  }).default({}),
  header: z.object({
    align: z.enum(["left", "center"]).default("left"),
    showContactIcons: z.boolean().default(false),
  }).default({}),
});
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;
```

## File Structure (files this plan creates)

Under `/Users/lixinan/Desktop/简历修改工具/web`:

- `src/lib/resume/resume-content.ts`: `ResumeContent` Zod schema + types.
- `src/lib/resume/resume-service.ts`: pure assembly + resume CRUD (create-from-session, get, update).
- `src/lib/template/template-config.ts`: `TemplateConfig` Zod schema + types.
- `src/lib/template/template-service.ts`: list/get/save-as-my-template; system-template helpers.
- `src/app/api/resumes/route.ts`: `POST` create from session, `GET` list.
- `src/app/api/resumes/[id]/route.ts`: `GET` detail, `PATCH` update (content + template).
- `src/app/api/templates/route.ts`: `GET` list (system + owned), `POST` save-as-my-template.
- `src/app/(app)/resumes/page.tsx`: user's resume list.
- `src/app/(app)/resume/[id]/page.tsx` + `resume-client.tsx`: the editor (left library / right editor+preview).
- `tests/unit/resume-service.test.ts`: assembly correctness + snapshot isolation.
- `tests/unit/template-service.test.ts`: system templates + save-as + ownership.
- `tests/e2e/resume-flow.spec.ts`: session → create resume → reorder/hide → switch template → save → persists.

Also modify:
- `web/prisma/schema.prisma` (models above).
- `web/prisma/seed.ts` (seed 2 system templates).
- `web/src/app/(app)/rewrite/[id]/rewrite-client.tsx` (wire "进入简历编辑" to create a resume).
- `web/src/app/(app)/layout.tsx` (activate the `简历编辑` nav link → `/resumes`).
- `web/README.md` (document the new pages and that PDF export is deferred).

---

## Task 1: Schema, template config, and system-template seed

**Files:**
- Modify: `web/prisma/schema.prisma`
- Create: `web/src/lib/template/template-config.ts`
- Modify: `web/prisma/seed.ts`

- [ ] **Step 1: Add `ResumeStatus`, `Template`, `Resume` and back-relations** (see Data Model additions).

- [ ] **Step 2: Add the `TemplateConfig` schema** (see Canonical JSON shapes).

- [ ] **Step 3: Seed two system templates**

In `prisma/seed.ts`, upsert two `isSystem: true` templates with stable ids so seeds are idempotent:
- `system-zh-compact` — name "中文紧凑", config: `heading.style="bar"`, `header.align="left"`, `font.sizePt=10.5`.
- `system-en-classic` — name "English Classic", config: `heading.style="underline"`, `header.align="center"`, `font.sizePt=11`.

Use `db.template.upsert({ where: { id }, ... })` with explicit `id` values so re-seeding does not duplicate.

- [ ] **Step 4: Regenerate client and recreate local DB**

The local `scripts/sqlite-migrate.ts` only initializes a fresh database. The dev DB holds only sample data, so recreate it:

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm db:generate
rm -f prisma/dev.db
pnpm db:migrate --name plan3_editor_templates
pnpm db:seed
```

Expected: migration written; DB has all Plan 1/2/3 tables; two system templates seeded.

- [ ] **Step 5: Verify + commit**

```bash
pnpm db:generate && pnpm typecheck
git add web/prisma/schema.prisma web/prisma/migrations web/prisma/seed.ts web/src/lib/template/template-config.ts
git commit -m "feat: add resume and template schema with system templates"
```

## Task 2: Resume assembly + service

**Files:**
- Create: `web/src/lib/resume/resume-content.ts`
- Create: `web/src/lib/resume/resume-service.ts`
- Create: `web/tests/unit/resume-service.test.ts`

- [ ] **Step 1: Add the `ResumeContent` schema** (see Canonical JSON shapes).

- [ ] **Step 2: Write the assembly test (pure, no DB)**

Create `web/tests/unit/resume-service.test.ts`. The pure assembler takes a profile + confirmed blocks and returns `ResumeContent`. Assert:
- Only ACCEPTED and EDITED blocks become items; PENDING and REJECTED are excluded.
- An EDITED block's item `body` uses `userEditedText`; an ACCEPTED block uses `rewrittenText`.
- Each item carries `sourceRewrittenId` provenance.
- The header is populated from the profile.

```ts
import { describe, expect, it } from "vitest";
import { assembleResumeContent } from "../../src/lib/resume/resume-service";

const profile = {
  name: "Demo Student", targetTitle: "ML Intern", location: "Sydney",
  phone: "", contactEmail: "s@example.com", linkedin: "", github: "", website: "",
};

const blocks = [
  { id: "r1", decision: "ACCEPTED", rewrittenText: "STAR accepted", userEditedText: "",
    originalSnapshot: { type: "PROJECT", title: "ABSA", organization: "Uni", role: "Lead", startDate: "2024-03", endDate: "2024-05" } },
  { id: "r2", decision: "EDITED", rewrittenText: "ai draft", userEditedText: "my edited text",
    originalSnapshot: { type: "INTERNSHIP", title: "Intern", organization: "Co", role: "SWE", startDate: "", endDate: "" } },
  { id: "r3", decision: "REJECTED", rewrittenText: "nope", userEditedText: "",
    originalSnapshot: { type: "PROJECT", title: "X", organization: "", role: "", startDate: "", endDate: "" } },
  { id: "r4", decision: "PENDING", rewrittenText: "", userEditedText: "",
    originalSnapshot: { type: "WORK", title: "Y", organization: "", role: "", startDate: "", endDate: "" } },
];

describe("assembleResumeContent", () => {
  it("includes only confirmed blocks and uses the right text source", () => {
    const content = assembleResumeContent(profile, blocks);
    const items = content.sections.flatMap((s) => s.items);
    const ids = items.map((i) => i.sourceRewrittenId);
    expect(ids).toContain("r1");
    expect(ids).toContain("r2");
    expect(ids).not.toContain("r3");
    expect(ids).not.toContain("r4");
    expect(items.find((i) => i.sourceRewrittenId === "r1")?.body).toBe("STAR accepted");
    expect(items.find((i) => i.sourceRewrittenId === "r2")?.body).toBe("my edited text");
    expect(content.header.name).toBe("Demo Student");
  });
});
```

- [ ] **Step 3: Implement the resume service**

`assembleResumeContent(profile, blocks)` is a **pure** function: group confirmed blocks by `originalSnapshot.type` into sections (SUMMARY from profile.summary if present, then EDUCATION/PROJECT/INTERNSHIP/WORK/SKILL), build items with `body = decision === "EDITED" ? userEditedText : rewrittenText`, and populate the header from the profile. Section titles use Chinese labels (基本信息 is the header, 教育经历/项目经历/实习经历/工作经历/职业能力/个人简介 for sections). Give every section and item a stable `id`.

DB-touching functions (all ownership-checked, no quota, no LLM):

```ts
// Load profile + confirmed blocks from the session, assemble, pick a default template
// (first system template) if none provided, and create a Resume. Requires canProceed.
createResumeFromSession(userId, sessionId, opts?: { templateId?: string; title?: string }): Promise<{ resumeId: string }>;

listResumes(userId): Promise<ResumeSummary[]>;
getResume(userId, id): Promise<ResumeDetail>; // includes content + template config

// PATCH: may update contentSnapshot (reorder/visibility/text) and/or templateId.
// Switching templateId must NOT change contentSnapshot.
updateResume(userId, id, patch: { content?: ResumeContent; templateId?: string; title?: string; status?: "DRAFT" | "FINALIZED" }): Promise<ResumeDetail>;
```

Validate `content` with `ResumeContentSchema.parse` and `templateId` against a template the user may use (system or owned) before saving.

- [ ] **Step 4: Verify + commit**

```bash
pnpm test tests/unit/resume-service.test.ts && pnpm typecheck
git add web/src/lib/resume web/tests/unit/resume-service.test.ts
git commit -m "feat: add resume assembly and service"
```

## Task 3: Template service

**Files:**
- Create: `web/src/lib/template/template-service.ts`
- Create: `web/tests/unit/template-service.test.ts`

- [ ] **Step 1: Write the template-service test** (real DB + `deleteMany` cleanup like `tests/unit/quota.test.ts`; note: do not delete seeded system templates in a way that breaks other tests — create system rows in the test setup instead). Assert:
- `listTemplates(userId)` returns system templates plus that user's own templates, and NOT another user's templates.
- `saveAsMyTemplate` creates an owned, non-system template referencing its `baseTemplateId`.
- `getTemplate` allows a system template or the user's own, and rejects another user's template.

- [ ] **Step 2: Implement the template service**

```ts
listTemplates(userId): Promise<Template[]>;             // where: isSystem OR ownerUserId = userId
getTemplateForUser(userId, id): Promise<Template>;      // system or owned; else throw "Template not found"
saveAsMyTemplate(userId, input: { name: string; baseTemplateId?: string; config: TemplateConfig }): Promise<Template>;
```

Validate `config` with `TemplateConfigSchema.parse`. `saveAsMyTemplate` always sets `isSystem: false` and `ownerUserId: userId` (never trust the body for ownership).

- [ ] **Step 3: Verify + commit**

```bash
pnpm test tests/unit/template-service.test.ts && pnpm typecheck
git add web/src/lib/template web/tests/unit/template-service.test.ts
git commit -m "feat: add template service with my-template save"
```

## Task 4: API routes

**Files:**
- Create: `web/src/app/api/resumes/route.ts`
- Create: `web/src/app/api/resumes/[id]/route.ts`
- Create: `web/src/app/api/templates/route.ts`

- [ ] **Step 1: Resumes collection route**

`POST /api/resumes`: `requireUser`, body `{ sessionId, templateId?, title? }`, call `createResumeFromSession`. If `canProceed` is false, return 409 `{ error: "No confirmed experience" }`. Returns `{ resumeId }`.
`GET /api/resumes`: `requireUser`, return `listResumes(user.id)`.

- [ ] **Step 2: Resume item route**

`GET /api/resumes/[id]`: `requireUser`, return `getResume(user.id, id)` (404 if not owned).
`PATCH /api/resumes/[id]`: `requireUser`, body `{ content?, templateId?, title?, status? }`, call `updateResume`. Returns the updated resume. No quota consumed.

- [ ] **Step 3: Templates route**

`GET /api/templates`: `requireUser`, return `listTemplates(user.id)`.
`POST /api/templates`: `requireUser`, body `{ name, baseTemplateId?, config }`, call `saveAsMyTemplate`. Returns the created template.

All routes: never accept `userId` from the body; validate with Zod; ownership enforced in services.

- [ ] **Step 4: Verify + commit**

```bash
pnpm typecheck && pnpm build
git add web/src/app/api/resumes web/src/app/api/templates
git commit -m "feat: add resume and template api routes"
```

## Task 5: Resume editor UI + wiring

**Files:**
- Create: `web/src/app/(app)/resumes/page.tsx`
- Create: `web/src/app/(app)/resume/[id]/page.tsx`
- Create: `web/src/app/(app)/resume/[id]/resume-client.tsx`
- Modify: `web/src/app/(app)/rewrite/[id]/rewrite-client.tsx`
- Modify: `web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Resume list page**

`/resumes`: server page lists the user's resumes (title, language, updatedAt) with links into the editor.

- [ ] **Step 2: Resume editor**

`/resume/[id]` (`resume-client.tsx`), left/right layout:
- **Left**: the personal library (profile + active experiences), read-only reference (reuse existing library data via a server load; do not let the editor mutate library data).
- **Right**: resume editor/preview rendering `contentSnapshot` styled by the selected `Template.config`. Controls:
  - Reorder sections (move up/down is sufficient; drag-drop optional).
  - Show/hide a section (`visible` toggle).
  - Inline-edit item `heading`/`subheading`/`dateRange`/`body` and section `title`.
  - Template selector populated from `GET /api/templates` (system + my templates); switching updates preview styling only.
  - Template customization panel editing `TemplateConfig` (font/size/spacing/color/heading/header/section order) with live preview.
  - "保存" → `PATCH /api/resumes/[id]` with the edited `content` (+ `templateId`).
  - "保存为我的模板" → `POST /api/templates` with the current `config`.
- **No export/PDF button** (deferred). If a placeholder is desired, render a disabled control labeled "PDF 导出（后续版本）".

- [ ] **Step 3: Wire Plan 2 → Plan 3**

In `rewrite-client.tsx`, make the (previously disabled) "进入简历编辑" button — enabled only when `canProceed` — call `POST /api/resumes` with `{ sessionId }` and navigate to `/resume/[resumeId]`.

- [ ] **Step 4: Activate nav**

In `layout.tsx`, replace the `简历编辑` `<span>` with `<Link href="/resumes">`.

- [ ] **Step 5: Manual verification (mock provider, no key needed)**

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm dev
```

As the seeded student user: run the Plan 2 flow to a confirmed session, click "进入简历编辑", then reorder a section, hide a section, edit text, switch template, save, and refresh — the changes persist. Confirm switching template does not alter the text content.

- [ ] **Step 6: Commit**

```bash
git add "web/src/app/(app)/resumes" "web/src/app/(app)/resume" "web/src/app/(app)/rewrite/[id]/rewrite-client.tsx" "web/src/app/(app)/layout.tsx"
git commit -m "feat: add resume editor and connect rewrite to editor"
```

## Task 6: End-to-end resume flow smoke test

**Files:**
- Create: `web/tests/e2e/resume-flow.spec.ts`
- Modify: `web/README.md`

- [ ] **Step 1: Add the e2e test** (mock provider, offline). Flow:

1. Register + log in a fresh user.
2. Import a free-text experience and confirm it into the library (Plan 2 path).
3. Enter a JD, generate a rewrite session, confirm at least one block.
4. Click "进入简历编辑" → lands on `/resume/[id]`.
5. Reorder a section and hide another; edit an item's text; switch template; save.
6. Reload the editor and assert the reordered/hidden/edited state persisted.
7. Assert no PDF/export control performs a download (there is none).

- [ ] **Step 2: Run the full suite**

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all four pass.

- [ ] **Step 3: Update README** — document `/resumes`, `/resume/[id]`, template customization + my-templates, that resumes are content snapshots, and that PDF export is deferred to a later plan.

- [ ] **Step 4: Commit**

```bash
git add web/tests/e2e/resume-flow.spec.ts web/README.md
git commit -m "test: add end-to-end resume editor smoke coverage"
```

## Self-Review

- Spec coverage in this plan:
  - Covered: left library / right resume editor (PRD §5.7), module reorder + show/hide, inline editing, save resume version, 2 system templates, in-platform template customization + my-templates + reuse (PRD §5.8), bilingual via `Resume.language`, content snapshot isolation from library edits (PRD §5.2/§5.8), Plan 2 → Plan 3 wiring.
  - Not covered by design (deferred/later plans): **PDF export (explicitly deferred by product decision)**, deployment/hardening (Plan 4), payments, template marketplace, Word/PDF upload recognition. No resume scoring anywhere.
- Placeholder scan: no `TBD`/`TODO`; every task names exact files and concrete behavior, code, or contracts. The only intentional placeholder is a disabled "PDF 导出（后续版本）" control, which does nothing by design.
- Consistency check:
  - New enum `ResumeStatus` = DRAFT/FINALIZED. Section types = SUMMARY/EDUCATION/PROJECT/INTERNSHIP/WORK/SKILL/CUSTOM.
  - `contentSnapshot` and `Template.config` validated by `ResumeContentSchema` / `TemplateConfigSchema`.
  - Template switch updates `templateId` only, never `contentSnapshot`.
  - Confirmed-block rule matches Plan 2: ACCEPTED → `rewrittenText`, EDITED → `userEditedText`, PENDING/REJECTED excluded.
  - No LLM calls, no quota consumption, no network in tests.
  - Ownership: every service/route checks `userId`/`requireUser`; `userId`/ownership never taken from a request body.
