# Resume SaaS Plan 5: PDF Export Implementation Plan

> **For agentic workers (Codex included):** Executable directly, no extra discovery. REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`). Implement in order, verify each task, commit after each task.

**Goal:** Add PDF export to the resume editor. This was deferred in Plans 3–4; the product owner has now approved it (2026-07-04). A user viewing a saved resume can export it to PDF. The exported document reuses the existing `Resume.contentSnapshot` + `Template.config` so the PDF matches the on-screen editor preview exactly, including bilingual content already carried from the rewrite stage.

**Approach (decided):** Browser print-to-PDF via a dedicated, chrome-free print route (`/resume/[id]/print`) + print CSS + `window.print()`. This adds **no runtime dependency**, keeps output identical to the editor preview by sharing one render component, and is fully verifiable offline (the e2e uses Playwright `page.pdf()` on the print route to assert a real PDF is produced). Server-side one-click PDF (headless chromium `page.pdf()` behind a route) is a possible future upgrade but is intentionally NOT built here to avoid a heavy production runtime dependency.

**Architecture:** Extract the resume rendering currently inlined in `resume-client.tsx` into a shared presentational component `ResumeDocument` (pure: `(content, config) → markup`). The editor preview and the print route both render `ResumeDocument`, so they cannot drift. The print route lives in a new `(print)` route group with a minimal layout (no sidebar/header) and print-optimized CSS. Ownership is enforced server-side (`requireUser` + `getResume`).

**Tech Stack (unchanged):** Next.js App Router (`next@16`, React 19), TypeScript, Tailwind 4, Prisma 6, Zod 4, Vitest, Playwright. **No new dependency.**

> **Next.js version warning (from `web/AGENTS.md`):** `next@16.2.10` has breaking changes vs. older training data. Read `web/node_modules/next/dist/docs/` before writing route-group/layout/page code and follow existing files (`src/app/(app)/...`) as the source of truth.

---

## Prerequisites (verify before Task 1)

Plans 1–4 complete and green:

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm install && pnpm test && pnpm typecheck && pnpm build
```

All exit 0. Then branch:

```bash
git checkout -b plan5-pdf-export
```

## Scope

**In scope:** shared `ResumeDocument` render component; a chrome-free print route rendering it with A4 print CSS; an "导出 PDF" action in the editor that opens the print route and triggers the browser print dialog; e2e proving a real PDF is producible.

**Out of scope:** server-side headless-chromium PDF endpoint (future upgrade), resume scoring, any change to the resume/template data model, payments. No schema change is needed in this plan.

## File Structure (files this plan creates / changes)

Under `/Users/lixinan/Desktop/简历修改工具/web`:

- Create: `src/components/resume/resume-document.tsx` — shared presentational resume renderer.
- Create: `src/lib/resume/render.ts` — pure render helpers (section ordering, heading class, visible-section filter) — unit-testable in the node test env.
- Create: `src/app/(print)/layout.tsx` — minimal print layout (no app shell).
- Create: `src/app/(print)/resume/[id]/print/page.tsx` — server page: `requireUser` + `getResume`, renders `ResumeDocument`.
- Create: `src/app/(print)/resume/[id]/print/print-client.tsx` — triggers `window.print()` + a manual "打印 / 保存为 PDF" button.
- Create: `src/app/(print)/print.css` (or a scoped stylesheet) — `@page { size: A4; margin }`, print-only layout.
- Modify: `src/app/(app)/resume/[id]/resume-client.tsx` — render preview via `ResumeDocument`; add "导出 PDF" button that opens `/resume/[id]/print`.
- Create: `tests/unit/resume-render.test.ts` — helper correctness.
- Create: `tests/e2e/pdf-export.spec.ts` — print route renders + Playwright `page.pdf()` produces a `%PDF`.
- Modify: `web/README.md` — document PDF export via the print route.

## Task 1: Extract shared render helpers + `ResumeDocument`

**Files:**
- Create: `web/src/lib/resume/render.ts`
- Create: `web/src/components/resume/resume-document.tsx`
- Create: `web/tests/unit/resume-render.test.ts`
- Modify: `web/src/app/(app)/resume/[id]/resume-client.tsx`

- [ ] **Step 1: Write the render-helper test** (node env, pure functions, no DOM). Assert:
- `orderedSectionsForRender(content, config)` returns sections ordered by `config.sectionOrder`, with any sections whose type is not in the order appended in their original order (mirrors the current editor logic in `resume-client.tsx`).
- Hidden sections (`visible === false`) are excluded from the render list.
- `headingClass(config)` reflects `heading.style` (underline/bar/plain) and `uppercase`.

```ts
import { describe, expect, it } from "vitest";
import { orderedSectionsForRender } from "../../src/lib/resume/render";

const content = {
  header: { name: "A", targetTitle: "", location: "", phone: "", email: "", linkedin: "", github: "", website: "" },
  sections: [
    { id: "s1", type: "PROJECT", title: "项目", visible: true, items: [] },
    { id: "s2", type: "EDUCATION", title: "教育", visible: true, items: [] },
    { id: "s3", type: "SKILL", title: "技能", visible: false, items: [] },
  ],
};

describe("orderedSectionsForRender", () => {
  it("orders by config.sectionOrder and drops hidden sections", () => {
    const ordered = orderedSectionsForRender(content, { sectionOrder: ["EDUCATION", "PROJECT"] });
    expect(ordered.map((s) => s.type)).toEqual(["EDUCATION", "PROJECT"]); // SKILL hidden, dropped
  });
  it("appends types not present in sectionOrder", () => {
    const ordered = orderedSectionsForRender(content, { sectionOrder: [] });
    expect(ordered.map((s) => s.id)).toEqual(["s1", "s2"]); // original order, hidden dropped
  });
});
```

- [ ] **Step 2: Implement `render.ts`** — extract the ordering/visibility logic that currently lives inline in `resume-client.tsx` (the `orderedSections` useMemo and heading styling) into pure functions:

```ts
import type { ResumeContent } from "@/lib/resume/resume-content";
import type { TemplateConfig } from "@/lib/template/template-config";

export function orderedSectionsForRender(
  content: ResumeContent,
  config: Pick<TemplateConfig, "sectionOrder">,
) {
  const visible = content.sections.filter((s) => s.visible);
  const order = config.sectionOrder.length ? config.sectionOrder : visible.map((s) => s.type);
  return [...visible].sort((a, b) => {
    const ia = order.indexOf(a.type);
    const ib = order.indexOf(b.type);
    return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
  });
}

export function headingClass(config: Pick<TemplateConfig, "heading">): string {
  const parts = [`heading-${config.heading.style}`];
  if (config.heading.uppercase) parts.push("uppercase");
  return parts.join(" ");
}
```

Keep behavior identical to the existing editor. If the editor's current tie-break differs, match the editor (the editor is the reference), and update the editor to import these helpers so there is one implementation.

- [ ] **Step 3: Implement `ResumeDocument`** — a presentational component taking `{ content: ResumeContent; config: TemplateConfig }` and rendering header + ordered sections + items, applying the same inline `previewStyle` (font family/size, line-height, color) and heading styling used by the editor today. It must contain NO editing controls and NO data fetching — pure display. It renders bilingual `body` text as-is (the content already carries whatever language the rewrite produced).

- [ ] **Step 4: Refactor the editor to use `ResumeDocument`** — in `resume-client.tsx`, replace the inline preview markup with `<ResumeDocument content={content} config={config} />`, and replace the inline ordering/heading logic with the `render.ts` helpers. The editing controls stay in `resume-client.tsx`; only the *preview* rendering is delegated. Verify the editor still looks the same.

- [ ] **Step 5: Verify + commit**

```bash
pnpm test tests/unit/resume-render.test.ts && pnpm typecheck && pnpm build
git add web/src/lib/resume/render.ts web/src/components/resume "web/src/app/(app)/resume/[id]/resume-client.tsx" web/tests/unit/resume-render.test.ts
git commit -m "refactor: extract shared resume document renderer"
```

## Task 2: Print route + print CSS

**Files:**
- Create: `web/src/app/(print)/layout.tsx`
- Create: `web/src/app/(print)/resume/[id]/print/page.tsx`
- Create: `web/src/app/(print)/resume/[id]/print/print-client.tsx`
- Create: `web/src/app/(print)/print.css` (import it from the print layout)

- [ ] **Step 1: Minimal print layout** — `(print)/layout.tsx` renders a bare shell (no sidebar/header) and imports the print stylesheet. It is a route group, so URLs are unaffected: `(print)/resume/[id]/print/page.tsx` serves `/resume/[id]/print`. Do NOT reuse `(app)/layout.tsx` (which renders the sidebar).

- [ ] **Step 2: Print page (server component)** — `requireUser()`, load the resume via `getResume(user.id, id)` (404/redirect if not owned), and render `<ResumeDocument content={...} config={...} />` inside a print container plus the `print-client` for auto-print. Ownership must be enforced server-side; never trust the URL alone for data access.

- [ ] **Step 3: Print CSS** — `@page { size: A4; margin: 14mm; }`, white background, the resume container sized for A4 width, and `@media screen` showing a subtle "使用系统打印对话框选择‘另存为 PDF’" hint that is hidden in `@media print`. Ensure no app chrome leaks in.

- [ ] **Step 4: Print client** — a small `"use client"` component that calls `window.print()` on mount (guarded so it runs once) and also renders a visible "打印 / 保存为 PDF" button as a manual fallback. The button is `@media print`-hidden.

- [ ] **Step 5: Verify + commit**

```bash
pnpm typecheck && pnpm build
git add "web/src/app/(print)"
git commit -m "feat: add chrome-free resume print route with a4 print css"
```

## Task 3: Wire the editor "导出 PDF" action

**Files:**
- Modify: `web/src/app/(app)/resume/[id]/resume-client.tsx`

- [ ] **Step 1: Add the export button** — an "导出 PDF" button in the editor toolbar. On click it opens `/resume/[id]/print` (new tab or same tab). Recommend saving first (or warn if there are unsaved edits) so the print route reflects the latest saved content, since the print page reads persisted data via `getResume`. A simple, clear approach: disable "导出 PDF" while there are unsaved changes, or auto-save then open the print route.

- [ ] **Step 2: Manual verification**

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm dev
```

Open a saved resume, click "导出 PDF" → the print route shows only the resume (no sidebar), the browser print dialog appears, and "另存为 PDF" produces a correct one-page-styled document matching the editor preview. Confirm switching template before export changes the PDF styling but not the text.

- [ ] **Step 3: Commit**

```bash
git add "web/src/app/(app)/resume/[id]/resume-client.tsx"
git commit -m "feat: add export pdf action to resume editor"
```

## Task 4: End-to-end PDF export verification

**Files:**
- Create: `web/tests/e2e/pdf-export.spec.ts`
- Modify: `web/README.md`

- [ ] **Step 1: Add the e2e** (mock provider, offline). Flow:

1. Register + log in; run the import → JD → rewrite path; confirm ≥1 block; create a resume; land in the editor.
2. Navigate to `/resume/[id]/print` and assert the resume content renders and the app sidebar is NOT present (chrome-free).
3. Produce a real PDF and assert it is valid:

```ts
// In chromium, generate the PDF from the print route and assert the header bytes.
const pdf = await page.pdf({ format: "A4", printBackground: true });
expect(pdf.length).toBeGreaterThan(1000);
expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
```

(Playwright's `page.pdf()` runs in headless chromium, which the existing config uses — no new dependency.)

- [ ] **Step 2: Full suite**

```bash
cd /Users/lixinan/Desktop/简历修改工具/web
pnpm test && pnpm typecheck && pnpm build && pnpm test:e2e
```

Expected: all pass.

- [ ] **Step 3: Update README** — document that PDF export opens a print-optimized route and uses the browser "save as PDF"; note the server-side one-click render is a possible future upgrade.

- [ ] **Step 4: Commit**

```bash
git add web/tests/e2e/pdf-export.spec.ts web/README.md
git commit -m "test: add end-to-end pdf export coverage"
```

## Self-Review

- Spec coverage: PDF export (PRD §3.1 / §5.7 "导出 PDF"), reusing `Resume.contentSnapshot` + `Template.config`, bilingual carried through, editor preview and PDF share one renderer (no drift).
- Not covered by design: server-side one-click PDF endpoint (future upgrade, documented), scoring, schema changes (none needed).
- Placeholder scan: no `TBD`/`TODO`; exact files and concrete behavior/code throughout.
- Consistency: one render implementation (`render.ts` + `ResumeDocument`) used by editor and print route; print route enforces `requireUser` + ownership server-side; no new dependency; template switch changes styling only, never content; tests use mock provider + Playwright's built-in chromium — offline, no network.
