# Pilot Readiness Checklist

Use this checklist before handing ResumeAI to first testers.

## Setup

- Install dependencies with `pnpm install`.
- Copy `.env.example` to `.env`.
- Keep `LLM_PROVIDER="mock"` for offline demos and automated tests.
- Use `LLM_PROVIDER="openai"` only when `OPENAI_API_KEY` is configured for multimodal resume imports.
- Deploy closed-beta staging with `REGISTRATION_MODE="invite_only"` from the
  start. Sign in as the seeded administrator and create the first active code
  before inviting testers. Use `open` only when public registration is
  explicitly approved.
- Rebuild a clean local database with:

```bash
rm -f prisma/dev.db
pnpm db:migrate --name plan3_editor_templates
pnpm db:seed
```

## Release Gates

Run these before every pilot build:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

All four commands must pass.

## Test User Script

1. Register a new account.
2. Fill name, target role, and contact email.
3. Add at least two experiences to the personal library.
4. Paste a target JD in `/match`.
5. Generate rewrites and confirm at least one block.
6. Open the resume editor.
7. Add one additional library experience into the resume.
8. Add one custom section for awards, leadership, or certifications.
9. Check the live page-fit guidance.
10. Save and reload the resume.
11. Export through `导出 PDF` and choose "保存为 PDF" in the browser print dialog.

## Feedback Questions

- Did you understand why each experience was recommended?
- Did the AI rewrite feel truthful enough to edit and use?
- Could you find how to add another saved experience after entering the editor?
- Was the page-fit guidance clear enough before exporting?
- What was the first point where you felt unsure or slowed down?

## Operations

- Check `GET /api/health` before a test session.
- Run `pnpm db:backup` before resetting pilot data.
- Keep seed admin credentials out of public demos.
- Do not log raw resumes, passwords, cookies, or API keys.

### Invitation operator workflow

1. Sign in with the staging administrator and open `/admin`.
2. Create a labelled code with a small capacity, the intended quota grant, and
   an optional expiry; copy that code to the approved tester only.
3. To grant an existing customer extra quota, ask them to redeem an active code
   in Settings. Confirm their available quota increases and persists after a
   reload.
4. If a code is shared accidentally, deactivate it immediately in `/admin`.
   Existing grants remain recorded, while later redemption attempts are blocked.
5. Review each code's recent redemption emails and times before issuing a
   replacement or increasing access.

Invitation codes are entitlement tokens only. They never reveal an LLM API key,
and they do not bypass normal authentication, input limits, or LLM rate limits.

## Non-Goals for Pilot

- No resume scoring.
- No payment or subscription flow.
- No template marketplace.
- No Word/PDF template upload parsing.
- No Cover Letter or interview material generation.
