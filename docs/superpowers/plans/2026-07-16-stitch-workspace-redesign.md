# Stitch Workspace Redesign Plan

## Objective

Replace the current card-based resume editor with the approved Stitch "International Career Precision" workspace while preserving the shipped data and export workflows.

## Scope

1. Replace the application shell with a compact blue navigation rail and responsive fallback.
2. Rebuild `/resume/[id]` as a four-part workspace: editor toolbar, asset library, A4 canvas, and inspector.
3. Keep existing actions and labels for experience insertion, section editing, template configuration, saving, custom templates, and PDF export.
4. Make the central preview a real A4-like surface without changing the print route's chrome-free behavior.
5. Apply the approved cobalt/cool-blue visual system to the shell and resume list.

## Acceptance Checks

- E2E confirms `信息库内容`, `内容`, `样式`, and `.resume-document` are visible in the editor after a real rewrite flow.
- Existing editor, PDF export, AI flow, and foundation tests still pass.
- Desktop screenshot shows a compact rail, asset panel, central paper canvas, and right inspector without overlapping text.
- Mobile screenshot preserves access to the editor controls without horizontal page breakage.
- No resume score is added; the existing fit advisor remains a neutral layout warning.

## Implementation Order

1. Add the failing workspace-surface assertion to the existing resume flow E2E.
2. Build the application shell and shared visual tokens.
3. Recompose `ResumeClient` around the approved workspace while retaining handlers and accessible labels.
4. Adjust the reusable document renderer for editor A4 presentation only; keep print styles authoritative for export.
5. Update the resume list to the same visual system.
6. Run targeted then complete verification, inspect desktop/mobile screenshots, and correct any layout or behavior regressions.
