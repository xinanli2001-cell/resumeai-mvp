# ResumeAI First-Run Library Onboarding Design

Date: 2026-07-16

## Goal

Help a new user begin the ResumeAI workflow without confronting the full empty
library form. The user should immediately understand the three valid starting
actions: import existing material, add one experience, or enter core profile
details.

## Scope

This change affects only the library's first-run presentation. It reuses the
existing import dialog, profile form, experience form, and persistence APIs.
It does not add onboarding records, new database fields, or a multi-page
wizard.

## First-Run Rule

The start panel is shown when both conditions hold:

- `profile.name` is empty after trimming.
- There are no active experiences in the user's library.

The condition is derived from server-provided data. It therefore works across
devices and disappears naturally as soon as a user saves their first profile
detail or experience.

## Experience

When first-run is true, the library displays a focused start panel before the
full workspace. It contains three equal-priority actions:

1. `粘贴已有简历`: opens the existing AI import dialog.
2. `添加第一段经历`: reveals the existing experience form and focuses its title
   field.
3. `从基本信息开始`: reveals the existing profile form and focuses the name
   field.

The panel also has `直接进入完整资料库`, which reveals the normal library without
changing stored data. This is a local convenience for the current visit only;
after a refresh, an untouched user sees the start panel again.

The normal library remains unchanged for returning users. Once a profile name
or an experience exists, the first-run panel is not rendered.

## Component Boundaries

- `LibraryClient` owns the derived first-run condition and the local
  "show full library" state.
- `ImportDialog` exposes an imperative open trigger through an optional
  callback, allowing the start action to reuse rather than duplicate import
  UI.
- The profile and experience sections accept refs so their corresponding start
  actions can reveal and focus the existing fields.

No API, database, authentication, quota, or resume-editor changes are needed.

## Acceptance Criteria

- A newly registered user sees `开始整理你的求职材料` and all three start actions.
- Each action opens or focuses the matching existing workflow.
- `直接进入完整资料库` reveals the ordinary library without a write request.
- Saving a name or adding an experience prevents the start panel on a reload.
- Existing users with a name or any experience load the full library directly.
- Existing library, import, and persistence E2E coverage stays green.
