# Resume Editor V1 and Pilot Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the resume editor from MVP-complete to pilot-ready by letting users add library experiences into an existing resume, manage custom resume modules, see one-page fit guidance, and follow a pilot checklist.

**Architecture:** Extend the existing `web/` Next.js app without database migrations. Add pure resume helpers for library-to-resume conversion and fit analysis, then wire them into the existing client editor state and persistence path. Keep PDF export automatically covered by the shared `ResumeDocument` and existing `/resume/[id]/print` route.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Prisma 6, Zod 4, Vitest, Playwright.

---

## Prerequisites

Run from `/Users/lixinan/Desktop/简历修改工具/web`:

```bash
pnpm test && pnpm typecheck && pnpm build
```

Expected: all commands exit 0. Work on branch `plan6-editor-v1-pilot-readiness`.

## Scope

In scope:

- Add saved library experiences to an existing resume snapshot.
- Prevent duplicate additions from the same `Experience`.
- Add/delete custom resume sections and section items.
- Add a live fit advisor panel.
- Add pilot-readiness documentation.
- Add unit and e2e coverage.

Out of scope:

- Resume scoring.
- Payment/subscriptions.
- Template marketplace.
- Word/PDF upload parsing.
- New LLM calls or quota usage.
- Prisma schema migration.
- Server-side PDF rendering endpoint.

## File Structure

- Modify: `web/src/lib/resume/resume-content.ts` — add optional `sourceExperienceId` to `ResumeItemSchema`.
- Create: `web/src/lib/resume/library-experience.ts` — pure conversion and append helpers.
- Create: `web/src/lib/resume/fit-advisor.ts` — pure one-page fit heuristic.
- Modify: `web/src/app/(app)/resume/[id]/resume-client.tsx` — add UI controls and live fit advisor.
- Create: `web/tests/unit/resume-library.test.ts` — library conversion helper tests.
- Create: `web/tests/unit/resume-fit-advisor.test.ts` — fit advisor tests.
- Create: `web/tests/e2e/editor-v1.spec.ts` — pilot editor flow.
- Create: `web/docs/pilot-readiness.md` — first-user pilot checklist.
- Modify: `web/README.md` — document Plan 6 editor improvements.

## Task 1: Library Experience to Resume Snapshot

**Files:**
- Modify: `web/src/lib/resume/resume-content.ts`
- Create: `web/src/lib/resume/library-experience.ts`
- Create: `web/tests/unit/resume-library.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `web/tests/unit/resume-library.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appendLibraryExperience, resumeItemFromLibraryExperience, sectionTypeForExperience } from "../../src/lib/resume/library-experience";
import type { ResumeContent } from "../../src/lib/resume/resume-content";

const baseContent: ResumeContent = {
  header: { name: "", targetTitle: "", location: "", phone: "", email: "", linkedin: "", github: "", website: "" },
  sections: [{ id: "section-project", type: "PROJECT", title: "项目经历", visible: true, items: [] }],
};

const experience = {
  id: "exp-1",
  type: "PROJECT",
  title: "Recommendation System",
  organization: "UNSW",
  role: "Developer",
  startDate: "2025-01",
  endDate: "2025-03",
  rawText: "Built a recommendation prototype with ranking metrics.",
};

describe("library experience resume conversion", () => {
  it("maps known experience types to resume section types", () => {
    expect(sectionTypeForExperience("PROJECT")).toBe("PROJECT");
    expect(sectionTypeForExperience("INTERNSHIP")).toBe("INTERNSHIP");
    expect(sectionTypeForExperience("WORK")).toBe("WORK");
    expect(sectionTypeForExperience("EDUCATION")).toBe("EDUCATION");
    expect(sectionTypeForExperience("SKILL")).toBe("SKILL");
    expect(sectionTypeForExperience("OTHER")).toBe("CUSTOM");
  });

  it("converts one library experience into a resume item with provenance", () => {
    expect(resumeItemFromLibraryExperience(experience)).toEqual({
      id: "library-exp-1",
      heading: "Recommendation System",
      subheading: "UNSW · Developer",
      dateRange: "2025-01 - 2025-03",
      body: "Built a recommendation prototype with ranking metrics.",
      sourceExperienceId: "exp-1",
    });
  });

  it("appends to the matching section and prevents duplicate additions", () => {
    const first = appendLibraryExperience(baseContent, experience);
    expect(first.added).toBe(true);
    expect(first.content.sections[0].items).toHaveLength(1);
    expect(first.content.sections[0].items[0]?.sourceExperienceId).toBe("exp-1");

    const second = appendLibraryExperience(first.content, experience);
    expect(second.added).toBe(false);
    expect(second.content.sections[0].items).toHaveLength(1);
  });

  it("creates the section when the resume does not have that type yet", () => {
    const result = appendLibraryExperience({ ...baseContent, sections: [] }, experience);
    expect(result.added).toBe(true);
    expect(result.content.sections[0]).toMatchObject({ type: "PROJECT", title: "项目经历", visible: true });
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
pnpm test tests/unit/resume-library.test.ts
```

Expected: fails because `src/lib/resume/library-experience.ts` does not exist.

- [ ] **Step 3: Add provenance to the content schema**

Modify `web/src/lib/resume/resume-content.ts` so `ResumeItemSchema` includes:

```ts
sourceExperienceId: z.string().optional(),
```

Keep `sourceRewrittenId` unchanged.

- [ ] **Step 4: Implement the helper**

Create `web/src/lib/resume/library-experience.ts`:

```ts
import type { ResumeContent, ResumeSection } from "@/lib/resume/resume-content";

export type LibraryExperienceForResume = {
  id: string;
  type: string;
  title: string;
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  rawText?: string;
};

const sectionTitles: Record<ResumeSection["type"], string> = {
  SUMMARY: "个人简介",
  EDUCATION: "教育经历",
  PROJECT: "项目经历",
  INTERNSHIP: "实习经历",
  WORK: "工作经历",
  SKILL: "职业能力",
  CUSTOM: "自定义",
};

export function sectionTypeForExperience(type: string): ResumeSection["type"] {
  if (type === "PROJECT" || type === "INTERNSHIP" || type === "WORK" || type === "EDUCATION" || type === "SKILL") {
    return type;
  }
  return "CUSTOM";
}

function joinParts(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ");
}

function dateRange(experience: LibraryExperienceForResume) {
  return [experience.startDate, experience.endDate].map((part) => part?.trim()).filter(Boolean).join(" - ");
}

export function resumeItemFromLibraryExperience(experience: LibraryExperienceForResume) {
  return {
    id: `library-${experience.id}`,
    heading: experience.title.trim(),
    subheading: joinParts([experience.organization, experience.role]),
    dateRange: dateRange(experience),
    body: experience.rawText?.trim() ?? "",
    sourceExperienceId: experience.id,
  };
}

export function appendLibraryExperience(content: ResumeContent, experience: LibraryExperienceForResume) {
  const sectionType = sectionTypeForExperience(experience.type);
  const alreadyAdded = content.sections.some((section) =>
    section.items.some((item) => item.sourceExperienceId === experience.id),
  );
  if (alreadyAdded) return { content, added: false, sectionType };

  const item = resumeItemFromLibraryExperience(experience);
  const sectionIndex = content.sections.findIndex((section) => section.type === sectionType);
  if (sectionIndex === -1) {
    return {
      added: true,
      sectionType,
      content: {
        ...content,
        sections: [
          ...content.sections,
          {
            id: `section-${sectionType.toLowerCase()}`,
            type: sectionType,
            title: sectionTitles[sectionType],
            visible: true,
            items: [item],
          },
        ],
      },
    };
  }

  return {
    added: true,
    sectionType,
    content: {
      ...content,
      sections: content.sections.map((section, index) =>
        index === sectionIndex ? { ...section, visible: true, items: [...section.items, item] } : section,
      ),
    },
  };
}
```

- [ ] **Step 5: Verify Task 1**

Run:

```bash
pnpm test tests/unit/resume-library.test.ts && pnpm typecheck
```

Expected: both pass.

## Task 2: Editor Controls for Library Additions and Custom Modules

**Files:**
- Modify: `web/src/app/(app)/resume/[id]/resume-client.tsx`
- Create: `web/tests/e2e/editor-v1.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `web/tests/e2e/editor-v1.spec.ts` with a flow that:

1. Registers a user.
2. Creates two experiences: `ABSA Project` and `Volunteer Leadership`.
3. Runs JD matching.
4. Unchecks `Volunteer Leadership` before generating rewrite.
5. Confirms the remaining rewrite and enters `/resume/[id]`.
6. Clicks `加入简历` on the `Volunteer Leadership` card.
7. Adds a custom section named `Awards`.
8. Adds one item with body `Dean's List recognition.`
9. Saves, reloads, and verifies both additions persisted.
10. Opens `/resume/[id]/print` and verifies `Volunteer Leadership` appears.

Use selectors that match the UI labels introduced in Step 3:

```ts
await page.getByRole("button", { name: "加入简历 Volunteer Leadership" }).click();
await page.getByRole("button", { name: "新增自定义模块" }).click();
await page.getByLabel("模块标题").last().fill("Awards");
await page.getByLabel("条目正文").last().fill("Dean's List recognition.");
```

- [ ] **Step 2: Verify the e2e fails**

Run:

```bash
pnpm test:e2e tests/e2e/editor-v1.spec.ts
```

Expected: fails because the editor does not yet have the new controls.

- [ ] **Step 3: Import the helper and add editor state functions**

In `web/src/app/(app)/resume/[id]/resume-client.tsx`, import:

```ts
import { appendLibraryExperience } from "@/lib/resume/library-experience";
```

Add these functions inside `ResumeClient`:

```ts
function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addLibraryExperience(experience: Library["experiences"][number]) {
  setContent((current) => {
    const result = appendLibraryExperience(current, experience);
    setMessage(result.added ? `已加入简历：${experience.title}` : "该经历已在当前简历中");
    return result.content;
  });
}

function addCustomSection() {
  const sectionId = uniqueId("custom");
  setContent((current) => ({
    ...current,
    sections: [
      ...current.sections,
      {
        id: sectionId,
        type: "CUSTOM",
        title: "自定义模块",
        visible: true,
        items: [{ id: uniqueId("custom-item"), heading: "", subheading: "", dateRange: "", body: "" }],
      },
    ],
  }));
  setMessage("已新增自定义模块");
}

function removeSection(sectionId: string) {
  setContent((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== sectionId) }));
}

function addSectionItem(sectionId: string) {
  setContent((current) => ({
    ...current,
    sections: current.sections.map((section) =>
      section.id === sectionId
        ? { ...section, items: [...section.items, { id: uniqueId("item"), heading: "", subheading: "", dateRange: "", body: "" }] }
        : section,
    ),
  }));
}

function removeSectionItem(sectionId: string, itemId: string) {
  setContent((current) => ({
    ...current,
    sections: current.sections.map((section) =>
      section.id === sectionId ? { ...section, items: section.items.filter((item) => item.id !== itemId) } : section,
    ),
  }));
}
```

- [ ] **Step 4: Add the UI controls**

In each library experience card, add:

```tsx
<button
  type="button"
  onClick={() => addLibraryExperience(experience)}
  className="mt-3 rounded border border-[#d8c3ad] bg-white px-3 py-2 text-xs font-semibold text-[#0f172a]"
  aria-label={`加入简历 ${experience.title}`}
>
  加入简历
</button>
```

In the content editor section header, change the heading block to:

```tsx
<div className="flex items-center justify-between gap-3">
  <h2 className="text-base font-semibold">内容编辑</h2>
  <button type="button" onClick={addCustomSection} className="rounded bg-[#0f172a] px-3 py-2 text-sm font-semibold text-white">
    新增自定义模块
  </button>
</div>
```

In each section editor, add buttons for:

```tsx
<button type="button" onClick={() => addSectionItem(section.id)}>新增条目</button>
<button type="button" onClick={() => removeSection(section.id)}>删除模块</button>
```

In each item editor, add:

```tsx
<button type="button" onClick={() => removeSectionItem(section.id, item.id)}>删除条目</button>
```

Use the existing border/button style from neighboring controls.

- [ ] **Step 5: Verify Task 2**

Run:

```bash
pnpm test:e2e tests/e2e/editor-v1.spec.ts && pnpm typecheck
```

Expected: both pass.

## Task 3: Fit Advisor and Pilot Documentation

**Files:**
- Create: `web/src/lib/resume/fit-advisor.ts`
- Create: `web/tests/unit/resume-fit-advisor.test.ts`
- Modify: `web/src/app/(app)/resume/[id]/resume-client.tsx`
- Create: `web/docs/pilot-readiness.md`
- Modify: `web/README.md`

- [ ] **Step 1: Write the failing fit advisor test**

Create `web/tests/unit/resume-fit-advisor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeResumeFit } from "../../src/lib/resume/fit-advisor";
import type { ResumeContent } from "../../src/lib/resume/resume-content";
import type { TemplateConfig } from "../../src/lib/template/template-config";

function contentWithBody(body: string): ResumeContent {
  return {
    header: { name: "A", targetTitle: "Engineer", location: "", phone: "", email: "", linkedin: "", github: "", website: "" },
    sections: [{ id: "s1", type: "PROJECT", title: "项目经历", visible: true, items: [{ id: "i1", heading: "Project", subheading: "", dateRange: "", body }] }],
  };
}

const config: Pick<TemplateConfig, "font" | "spacing"> = {
  font: { family: "system-ui", sizePt: 11 },
  spacing: { sectionGap: 16, lineHeight: 1.4 },
};

describe("analyzeResumeFit", () => {
  it("returns fits for compact resumes", () => {
    const result = analyzeResumeFit(contentWithBody("Short impact statement."), config);
    expect(result.status).toBe("fits");
    expect(result.message).toBe("预计适合一页");
  });

  it("returns overflow with concrete suggestions for long resumes", () => {
    const result = analyzeResumeFit(contentWithBody("Long ".repeat(220)), config);
    expect(result.status).toBe("overflow");
    expect(result.suggestions.join(" ")).toContain("隐藏或缩短");
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
pnpm test tests/unit/resume-fit-advisor.test.ts
```

Expected: fails because `src/lib/resume/fit-advisor.ts` does not exist.

- [ ] **Step 3: Implement the fit advisor**

Create `web/src/lib/resume/fit-advisor.ts` using the contract from the design spec. Ensure it exports `FitStatus` and `analyzeResumeFit`.

- [ ] **Step 4: Show the fit advisor in the editor**

In `resume-client.tsx`, import:

```ts
import { analyzeResumeFit } from "@/lib/resume/fit-advisor";
```

Add:

```ts
const fit = useMemo(() => analyzeResumeFit(content, config), [content, config]);
```

Render a compact panel in the top toolbar section:

```tsx
<div className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-4 py-3 text-sm">
  <p className="font-semibold">版面检查：{fit.message}</p>
  <p className="text-[#565e74]">
    可见模块 {fit.visibleSections} 个 · 条目 {fit.visibleItems} 个
  </p>
  <p className="mt-1 text-[#565e74]">{fit.suggestions[0]}</p>
</div>
```

- [ ] **Step 5: Add pilot documentation**

Create `web/docs/pilot-readiness.md` with:

- Pilot setup checklist.
- Test user script from registration to PDF export.
- Feedback questions for first users.
- Operational checks: `.env`, mock vs DeepSeek, backup, health check, release gates.
- Known non-goals: scoring, payments, template upload.

Update `web/README.md` with a short Plan 6 section linking to `docs/pilot-readiness.md`.

- [ ] **Step 6: Verify Task 3**

Run:

```bash
pnpm test tests/unit/resume-fit-advisor.test.ts && pnpm typecheck && pnpm build
```

Expected: all pass.

## Task 4: Full Acceptance Verification

**Files:**
- All files changed by Tasks 1-3.

- [ ] **Step 1: Run full automated gates**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all exit 0.

- [ ] **Step 2: Check no out-of-scope changes**

Run:

```bash
git diff -- package.json pnpm-lock.yaml prisma/schema.prisma
```

Expected: no diff.

- [ ] **Step 3: Check Plan 6 artifacts exist**

Run:

```bash
test -f ../docs/superpowers/specs/2026-07-05-resume-editor-v1-pilot-readiness-design.md
test -f ../docs/superpowers/plans/2026-07-05-resume-editor-v1-pilot-readiness.md
test -f ../docs/superpowers/acceptance/2026-07-05-plan6-editor-v1-pilot-readiness-acceptance.md
test -f docs/pilot-readiness.md
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

Run:

```bash
git add ../docs/superpowers/specs/2026-07-05-resume-editor-v1-pilot-readiness-design.md ../docs/superpowers/plans/2026-07-05-resume-editor-v1-pilot-readiness.md ../docs/superpowers/acceptance/2026-07-05-plan6-editor-v1-pilot-readiness-acceptance.md .
git commit -m "feat: improve resume editor pilot readiness"
```

Expected: commit succeeds.
