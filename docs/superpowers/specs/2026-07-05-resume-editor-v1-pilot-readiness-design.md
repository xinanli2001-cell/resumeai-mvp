# Resume Editor V1 and Pilot Readiness Design

Date: 2026-07-05
Status: Approved by continuation request
Product area: ResumeAI MVP -> V1 editor quality

## 1. Product Frame

Plans 1-5 completed the core MVP loop: user account, personal library, JD matching, AI rewrite confirmation, resume editor, template customization, hardening, and PDF export. The next risk is not that the loop is missing; it is that a real student may still struggle to turn the first generated resume into a polished, targeted, reusable version.

Plan 6 focuses on the smallest V1 editor improvements that make the product pilot-ready:

- Users can add more saved library experiences into an existing resume after the AI rewrite flow.
- Users can add and manage custom resume sections without changing the personal library.
- Users receive lightweight page-fit guidance before exporting.
- The repo has a concrete pilot checklist for handing the app to first testers.

## 2. Goals

- Close the PRD gap in §5.7: "用户能从个人信息库添加更多经历".
- Keep resume snapshots isolated: editor additions modify only `Resume.contentSnapshot`, never `Experience` rows.
- Improve first-pilot confidence without adding payments, scoring, template marketplace, or upload parsing.
- Preserve Plan 5 PDF behavior: print output uses the same `ResumeDocument`, so new sections and library-added experiences export automatically.

## 3. Non-Goals

- No resume scoring or rating.
- No payment/subscription work.
- No template market.
- No Word/PDF template upload or parsing.
- No new LLM action, quota action, or schema migration.
- No server-side headless PDF endpoint.

## 4. Recommended Approach

Use a snapshot-only editor extension.

Library experiences are already loaded into `/resume/[id]` as read-only reference data. Plan 6 adds a pure converter that turns a library experience into a `ResumeItem` and appends it to the matching resume section. The client stores the result in local `content` state and persists through the existing `PATCH /api/resumes/[id]`.

Custom sections are also local resume snapshot edits. They use `type: "CUSTOM"` and ordinary `ResumeSection.items`, so no Prisma schema change is required.

Page-fit guidance is heuristic, not a layout engine. It estimates visible section/item/text volume and returns a clear status: fits, tight, or overflow. The UI labels it as a guide, not as a guaranteed pagination result.

## 5. User Stories

1. As a job seeker, after generating a resume from one accepted rewrite, I can add another relevant project from my library without restarting the JD flow.
2. As a job seeker, I can create a custom section such as "Awards" or "Leadership" and save it in this resume version.
3. As a job seeker, I can delete accidental custom modules or items from the resume snapshot without deleting anything from my personal library.
4. As a job seeker, before exporting PDF, I can see whether the resume looks likely to fit one page and which setting to adjust first.
5. As a pilot operator, I have a checklist for configuring, testing, backing up, and collecting feedback from the first users.

## 6. Data and Contracts

### 6.1 Resume Item Provenance

`ResumeItemSchema` gains an optional `sourceExperienceId` field:

```ts
sourceExperienceId: z.string().optional()
```

This is a JSON content contract only. It does not require a database schema migration. It lets the editor prevent duplicate library additions and show provenance for resume items.

### 6.2 Library Experience Conversion

Create `src/lib/resume/library-experience.ts` with these pure exports:

- `type LibraryExperienceForResume`
- `sectionTypeForExperience(type: string): ResumeSection["type"]`
- `resumeItemFromLibraryExperience(experience): ResumeItem`
- `appendLibraryExperience(content, experience): { content: ResumeContent; added: boolean; sectionType: ResumeSection["type"] }`

Mapping:

- `PROJECT` -> `PROJECT`
- `INTERNSHIP` -> `INTERNSHIP`
- `WORK` -> `WORK`
- `EDUCATION` -> `EDUCATION`
- `SKILL` -> `SKILL`
- anything else -> `CUSTOM`

The generated item uses:

- `id = "library-" + experience.id`
- `heading = experience.title`
- `subheading = organization + " · " + role`, excluding empty parts
- `dateRange = startDate + " - " + endDate`, excluding empty parts
- `body = rawText`
- `sourceExperienceId = experience.id`

If any existing item already has the same `sourceExperienceId`, the helper returns the original content with `added: false`.

### 6.3 Custom Sections

Custom sections use existing `ResumeSection` shape:

```ts
{
  id: "custom-" + Date.now(),
  type: "CUSTOM",
  title: "自定义模块",
  visible: true,
  items: [
    {
      id: "custom-item-" + Date.now(),
      heading: "",
      subheading: "",
      dateRange: "",
      body: ""
    }
  ]
}
```

The editor must support:

- add custom section
- delete a section from the resume snapshot
- add item to a section
- delete item from a section

Deleting here means removing it from `contentSnapshot`; it never archives or deletes library data.

### 6.4 Fit Advisor

Create `src/lib/resume/fit-advisor.ts` with:

```ts
export type FitStatus = "fits" | "tight" | "overflow";
export function analyzeResumeFit(content: ResumeContent, config: Pick<TemplateConfig, "font" | "spacing">): {
  status: FitStatus;
  visibleSections: number;
  visibleItems: number;
  estimatedUnits: number;
  message: string;
  suggestions: string[];
}
```

Heuristic:

- Count visible sections and visible items.
- Count text length across header fields, section titles, item headings, subheadings, dates, and bodies.
- Base units = visible sections * 12 + visible items * 18 + ceil(textLength / 60) * 10.
- Font adjustment = `(font.sizePt - 11) * 14`.
- Spacing adjustment = `(spacing.sectionGap - 16) * visibleSections * 0.8`.
- `estimatedUnits = round(base + font adjustment + spacing adjustment)`.
- `fits` when `estimatedUnits < 160`.
- `tight` when `estimatedUnits >= 160 && estimatedUnits < 220`.
- `overflow` when `estimatedUnits >= 220`.

Messages:

- fits: `预计适合一页`
- tight: `内容接近一页上限`
- overflow: `可能超过一页`

Suggestions:

- tight: reduce section gap, reduce font size, hide lower-priority modules.
- overflow: prioritize target-role sections, hide or shorten older items, reduce spacing/font before export.

## 7. UI Design

### Library Reference

Each experience card in the left reference panel gets a `加入简历` button. Clicking it:

- Appends the converted item to the matching resume section.
- Creates the section if the resume does not yet have that type.
- Shows `已加入简历：<title>` on success.
- Shows `该经历已在当前简历中` if duplicate.

### Content Editor

The content editor header gets an `新增自定义模块` button. Each section editor gets:

- `新增条目`
- `删除模块`

Each item editor gets:

- `删除条目`

Delete buttons operate on the resume snapshot only. They should use normal buttons, not confirmation dialogs, because the user can avoid persistence by not saving; the persisted state changes only after clicking `保存`.

### Fit Advisor

The top toolbar area shows a compact `版面检查` panel with:

- status message
- visible section/item counts
- one or two suggestions

It updates live as content and template settings change.

## 8. Testing Strategy

- Unit test the library conversion helper, including duplicate prevention and section creation.
- Unit test the fit advisor for fits/tight/overflow thresholds.
- E2E test a user who creates two library experiences, generates a resume from only one, then adds the other from the library, adds a custom section, saves, reloads, and verifies both persist.
- E2E also opens the print route and verifies the added library experience appears in the export surface.
- Existing Plan1-5 checks must remain green.

## 9. Acceptance Summary

Plan 6 is done only when:

- Formal plan and acceptance docs exist.
- The editor can add library experiences into a saved resume.
- The editor can add/delete custom sections and items.
- Page-fit guidance appears and updates from current content/template config.
- PDF print route includes newly added resume snapshot content.
- Pilot checklist exists.
- `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.
