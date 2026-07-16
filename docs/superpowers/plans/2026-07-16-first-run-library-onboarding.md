# First-Run Library Onboarding Implementation Plan

> **For Codex:** Execute this plan in order with a test-first loop. Keep the
> existing library experience unchanged for returning users.

**Goal:** Give users with an empty materials library a focused first step instead
of immediately presenting a large empty form.

**Architecture:** Derive first-run status from the library data already loaded
by the server page: a user is new when their trimmed profile name is empty and
they have no active experience blocks. The client owns transient reveal state
and focus management; it does not add schema, API, or persistence changes.

**Tech stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Playwright.

---

## 1. Add behavioral coverage before implementation

**Files:**
- Create: `web/tests/e2e/library-onboarding.spec.ts`

1. Register a fresh user and navigate to `/library`.
2. Assert the first-run heading and the three primary actions are visible.
3. Click `从基本信息开始`; assert the normal form is revealed and the name
   input receives focus.
4. Save a profile name, reload, and assert the onboarding heading is absent.
5. In a separate fresh-user scenario, click `添加第一段经历`; assert the title
   input receives focus, save an experience, reload, and assert onboarding is
   absent.
6. In a third fresh-user scenario, click `粘贴已有简历`; assert the existing
   import dialog is opened. Confirm abandoning import returns to the
   onboarding state.

Run the focused test and confirm it fails because the onboarding UI does not
yet exist:

```bash
cd web && pnpm exec playwright test tests/e2e/library-onboarding.spec.ts
```

## 2. Extract the first-run presentation component

**Files:**
- Create: `web/src/app/(app)/library/first-run-library-panel.tsx`

1. Build a focused page section with the heading `开始整理你的求职材料`.
2. Render three explicit action controls: paste an existing resume, add the
   first experience, and start from profile details.
3. Include `直接进入完整资料库` as a secondary action which only changes the
   current client visit.
4. Keep the layout responsive and use stable full-width rows so long Chinese
   labels do not cause overlap on narrow screens.
5. Accept event callbacks from `LibraryClient`; do not move library mutation
   logic into this component.

## 3. Make the import dialog externally openable

**Files:**
- Modify: `web/src/app/(app)/library/import-dialog.tsx`

1. Add optional controlled `open` and `onOpenChange` props while preserving
   the existing uncontrolled behavior for any current caller.
2. Route every existing open, close, cancel, and post-save state transition
   through one local setter so a controlled parent remains in sync.
3. Keep parsing, previewing, and saving imported blocks unchanged.

## 4. Wire first-run state, reveal actions, and focus into the library

**Files:**
- Modify: `web/src/app/(app)/library/library-client.tsx`

1. Derive `hasStartedLibrary` from `profile.name.trim()` or a non-empty
   experience list.
2. Keep a local `showFullLibrary` override for the current visit. Display the
   first-run panel only when the user has not started and has not selected the
   skip action.
3. Add controlled import-dialog state so `粘贴已有简历` opens the existing
   import flow directly from onboarding.
4. Add refs for the profile-name and experience-title fields. On the two
   reveal actions, show the normal workspace and focus the matching field on
   the next animation frame.
5. Pass the refs through the reusable field helper without altering existing
   field sizing fixes.
6. Preserve the current full library layout for users who already have a name
   or any experience. Do not change API endpoints, data payloads, or archive
   behavior.

## 5. Verify desktop and mobile behavior

Run the focused suite, then all automated checks:

```bash
cd web
pnpm exec playwright test tests/e2e/library-onboarding.spec.ts
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Start the local server in mock-LLM mode, capture Playwright screenshots of the
fresh-user onboarding and the revealed library at desktop and mobile widths,
and inspect them for text overlap, clipped controls, and focusable fields.

## 6. Publish and validate the staging path

1. Review the diff and `git diff --check`.
2. Commit only onboarding implementation and test files; leave the user-owned
   `stitch_resumeai_workspace.zip` untracked.
3. Push `codex/plan8-render-staging-config` and wait for Render auto-deploy.
4. Run:

```bash
cd web
STAGING_BASE_URL='https://resumeai-staging.onrender.com' pnpm smoke:staging
```

5. Report the resulting staging URL and the test/deploy result.
