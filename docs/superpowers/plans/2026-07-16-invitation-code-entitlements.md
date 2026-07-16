# Invitation Code Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable invitation codes that can gate closed-beta registration and grant additional AI rewrite quota to new or existing users.

**Architecture:** Invitation capacity and user entitlement changes live in a transaction-backed service. Registration, Settings, and the existing admin UI call small authenticated route handlers around that service. `REGISTRATION_MODE` controls only whether a code is required at sign-up; successful redemption always increases `User.quotaLimit` while existing quota enforcement remains unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma SQLite/PostgreSQL schema generation, Zod, Vitest, Playwright.

---

### Task 1: Add invitation persistence and registration-mode configuration

**Files:**
- Modify: `web/prisma/schema.prisma`
- Create: `web/prisma/migrations/<timestamp>_plan9_invitation_codes/migration.sql`
- Modify: `web/src/lib/config/env.ts`
- Modify: `web/tests/unit/env-config.test.ts`
- Test: `web/tests/unit/invitation-service.test.ts`

- [ ] **Step 1: Write failing schema/config tests**

Create `tests/unit/invitation-service.test.ts` with a database cleanup that
deletes `InvitationRedemption`, `InvitationCode`, `UsageLog`, `Profile`, and
`User` in relation-safe order. Import the future `createInvitationCode` and
assert a created code persists `maxUses`, `usedCount = 0`, `bonusQuota`, and
`active = true`. Add environment tests for `REGISTRATION_MODE` defaulting to
`open` and accepting `invite_only`.

```ts
it("defaults registration mode to open", () => {
  process.env.REGISTRATION_MODE = undefined;
  resetEnvForTests();
  expect(loadEnv().REGISTRATION_MODE).toBe("open");
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
cd web
pnpm exec vitest run tests/unit/invitation-service.test.ts tests/unit/env-config.test.ts
```

Expected: FAIL because invitation models, service exports, and
`REGISTRATION_MODE` do not exist.

- [ ] **Step 3: Add Prisma models and validated environment field**

Add these model fields and relations in `prisma/schema.prisma`:

```prisma
model InvitationCode {
  id          String                 @id @default(cuid())
  code        String                 @unique
  label       String
  maxUses     Int
  usedCount   Int                    @default(0)
  bonusQuota  Int
  active      Boolean                @default(true)
  expiresAt   DateTime?
  createdAt   DateTime               @default(now())
  updatedAt   DateTime               @updatedAt
  redemptions InvitationRedemption[]
}

model InvitationRedemption {
  id               String         @id @default(cuid())
  invitationCodeId String
  userId           String
  bonusQuota       Int
  redeemedAt       DateTime       @default(now())
  invitationCode   InvitationCode @relation(fields: [invitationCodeId], references: [id], onDelete: Restrict)
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([invitationCodeId, userId])
  @@index([userId, redeemedAt])
}
```

Add `invitationRedemptions InvitationRedemption[]` to `User`. Add
`REGISTRATION_MODE: z.enum(["open", "invite_only"]).default("open")` to
`RawEnvSchema`. Generate the SQLite migration through the existing command:

```bash
pnpm db:migrate --name plan9_invitation_codes
```

- [ ] **Step 4: Re-run focused tests and confirm GREEN**

Run the command from Step 2. Expected: invitation storage and environment
configuration tests PASS.

- [ ] **Step 5: Commit persistence foundation**

```bash
git add web/prisma web/src/lib/config/env.ts web/tests/unit/env-config.test.ts web/tests/unit/invitation-service.test.ts
git commit -m "feat: add invitation code persistence"
```

### Task 2: Build the transactional invitation service

**Files:**
- Create: `web/src/lib/invitations/service.ts`
- Modify: `web/tests/unit/invitation-service.test.ts`

- [ ] **Step 1: Add failing redemption tests**

Add tests which create a normal user and a code, then assert that redemption
increments `quotaLimit` and `usedCount` exactly once. Add tests for duplicate
redemption, inactive code, expired code, and exhausted capacity; every failure
must leave quota, usage count, and redemption count unchanged.

```ts
await redeemInvitationCode({ userId: user.id, rawCode: " friend-2026 " });
expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).quotaLimit).toBe(25);
await expect(redeemInvitationCode({ userId: user.id, rawCode: "FRIEND-2026" }))
  .rejects.toMatchObject({ code: "ALREADY_REDEEMED" });
```

- [ ] **Step 2: Run the invitation-service test and confirm RED**

Run: `cd web && pnpm exec vitest run tests/unit/invitation-service.test.ts`

Expected: FAIL because `redeemInvitationCode` and its typed domain errors do
not exist.

- [ ] **Step 3: Implement code generation, validation, and atomic redemption**

Export `normalizeInvitationCode`, `createInvitationCode`,
`redeemInvitationCode`, and `deactivateInvitationCode` from
`src/lib/invitations/service.ts`. Normalize codes to trimmed uppercase values.
Generate codes with `crypto.randomBytes(6).toString("base64url").toUpperCase()`
and retry on a unique-key conflict.

In `redeemInvitationCode`, run all work in `db.$transaction`. Read the code,
reject missing/inactive/expired codes and prior redemption, then reserve a use
with an optimistic guarded update:

```ts
const reserved = await tx.invitationCode.updateMany({
  where: { id: invitation.id, active: true, usedCount: invitation.usedCount },
  data: { usedCount: { increment: 1 } },
});
if (reserved.count !== 1 || invitation.usedCount >= invitation.maxUses) {
  throw new InvitationError("UNAVAILABLE");
}
```

After reservation, create `InvitationRedemption` with the captured
`bonusQuota` and update the user with `quotaLimit: { increment: bonusQuota }`.
Throwing any domain or Prisma uniqueness error rolls back the whole transaction.

- [ ] **Step 4: Add a concurrent-final-use test and run GREEN**

Create a code with `maxUses: 1`, redeem it with two different users through
`Promise.allSettled`, then assert exactly one fulfilled result, one redemption,
and `usedCount === 1`. Run:

```bash
cd web
pnpm exec vitest run tests/unit/invitation-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the service**

```bash
git add web/src/lib/invitations/service.ts web/tests/unit/invitation-service.test.ts
git commit -m "feat: add transactional invitation redemption"
```

### Task 3: Enforce registration mode and expose authenticated redemption

**Files:**
- Modify: `web/src/app/api/auth/register/route.ts`
- Create: `web/src/app/api/invitations/redeem/route.ts`
- Create: `web/src/app/api/invitations/me/route.ts`
- Modify: `web/tests/unit/auth-api.test.ts`
- Create: `web/tests/unit/invitation-api.test.ts`

- [ ] **Step 1: Write failing route tests**

Add registration tests with `resetEnvForTests()` around each environment change:

```ts
process.env.REGISTRATION_MODE = "invite_only";
await expect(register(requestWithoutCode)).resolves.toHaveProperty("status", 403);
await expect(register(requestWithValidCode)).resolves.toHaveProperty("status", 201);
```

Add authenticated redemption route tests by mocking `requireUser` using the
existing Vitest route-test pattern. Assert a valid code returns quota summary,
and a duplicate code returns `409` without an extra grant.

- [ ] **Step 2: Run route tests and confirm RED**

Run:

```bash
cd web
pnpm exec vitest run tests/unit/auth-api.test.ts tests/unit/invitation-api.test.ts
```

Expected: FAIL because registration accepts no invitation data and invitation
routes do not exist.

- [ ] **Step 3: Implement narrow route handlers**

Extend `RegisterSchema` with `invitationCode: z.string().max(80).optional()`.
For invite-only mode, return `403` with `邀请码为必填项` when normalization is
empty. For any supplied code, create the user/profile and call the service in
the same transaction through a `createUserWithInvitation` service entrypoint;
invalid codes return a generic `邀请码无效或不可用` response and create no user.

`POST /api/invitations/redeem` requires `requireUser`, validates one code, maps
duplicate redemption to `409`, and returns `{ quotaLimit, quotaUsed, remaining
}`. `GET /api/invitations/me` requires `requireUser` and returns the same quota
summary plus the signed-in user's redemption timestamps and bonus amounts only.

- [ ] **Step 4: Run route tests and confirm GREEN**

Run the command from Step 2. Expected: PASS with invite-only enforcement,
open-mode optional codes, and authenticated redemption behavior covered.

- [ ] **Step 5: Commit registration and redemption APIs**

```bash
git add web/src/app/api/auth/register/route.ts web/src/app/api/invitations web/tests/unit/auth-api.test.ts web/tests/unit/invitation-api.test.ts web/src/lib/invitations/service.ts
git commit -m "feat: redeem invitation codes at registration"
```

### Task 4: Add registration and Settings redemption interfaces

**Files:**
- Modify: `web/src/app/(public)/register/page.tsx`
- Modify: `web/src/app/(app)/settings/settings-client.tsx`
- Create: `web/tests/e2e/invitation-redemption.spec.ts`
- Modify: `web/playwright.config.ts`

- [ ] **Step 1: Write failing Playwright behavior**

Create `tests/e2e/invitation-redemption.spec.ts` covering an open-mode user who
registers with a valid code, opens Settings, redeems a second valid code, sees
the quota result, and receives a duplicate-code error on a second attempt.
Add a separate test that registers without a code in open mode.

```ts
await page.getByLabel("邀请码").fill("FRIEND-2026");
await page.getByRole("button", { name: "兑换邀请码" }).click();
await expect(page.getByText("已获得 5 次改写额度")).toBeVisible();
```

- [ ] **Step 2: Run the focused E2E test and confirm RED**

Run: `cd web && pnpm exec playwright test tests/e2e/invitation-redemption.spec.ts`

Expected: FAIL because neither page presents an invitation code control.

- [ ] **Step 3: Implement accessible form controls without changing auth flow**

Keep the existing registration submit/login sequence. Add a labeled
`邀请码（可选）` input in open mode and a required `邀请码` input with invite-only
supporting copy in invite-only mode. Send its value as `invitationCode` in the
existing register request.

In `SettingsClient`, add a dedicated unframed settings section with one input,
one `兑换邀请码` command button, busy/error/success state, and the current
remaining rewrite quota. Fetch `GET /api/invitations/me` on mount and refresh
the summary after successful redemption. Do not display code values or other
users' data.

Set `REGISTRATION_MODE: "open"` explicitly in Playwright's web-server
environment so all existing registration tests retain their current behavior.

- [ ] **Step 4: Run focused E2E and inspect responsive layout**

Run:

```bash
cd web
pnpm exec playwright test tests/e2e/invitation-redemption.spec.ts
```

Start the local mock-LLM server and inspect registration and Settings at desktop
and 375px widths. Expected: controls fit their panels, no overlap, and the
redeem command remains reachable.

- [ ] **Step 5: Commit user-facing redemption UI**

```bash
git add web/src/app/\(public\)/register/page.tsx web/src/app/\(app\)/settings/settings-client.tsx web/tests/e2e/invitation-redemption.spec.ts web/playwright.config.ts
git commit -m "feat: add invitation redemption controls"
```

### Task 5: Add administrator invitation management

**Files:**
- Create: `web/src/app/api/admin/invitations/route.ts`
- Create: `web/src/app/api/admin/invitations/[id]/route.ts`
- Modify: `web/src/app/(admin)/admin/page.tsx`
- Modify: `web/src/app/(admin)/admin/admin-client.tsx`
- Create: `web/tests/unit/admin-invitations-api.test.ts`
- Modify: `web/tests/e2e/foundation.spec.ts`

- [ ] **Step 1: Write failing admin authorization and creation tests**

Add route tests proving a non-admin receives the existing redirect/forbidden
behavior and an admin can create a code with `{ label, maxUses, bonusQuota,
expiresAt? }`, list its zero usage, then deactivate it. Add an E2E admin test
that creates a code, copies the visible generated string, and sees its active
status.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
cd web
pnpm exec vitest run tests/unit/admin-invitations-api.test.ts
pnpm exec playwright test tests/e2e/foundation.spec.ts
```

Expected: FAIL because admin invitation routes and controls do not exist.

- [ ] **Step 3: Implement admin-only API and panel**

Require `requireAdmin()` in every admin invitation handler. `GET` returns code
metadata plus recent redemption email/time records. `POST` validates label,
positive max uses, positive bonus quota, and optional future expiration before
calling `createInvitationCode`. `PATCH /api/admin/invitations/[id]` accepts only
`{ active: boolean }` and never deletes a code.

Load invitation records in `AdminPage` and pass serialized timestamps to
`AdminClient`. Add a full-width `邀请码` panel before Activity, with a compact
creation form, copy button for each generated code, capacity display, recent
redemptions, and an activate/deactivate toggle. Keep table overflow behavior
for narrow viewports.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the commands from Step 2. Expected: PASS for authorization, creation,
deactivation, and visible admin management behavior.

- [ ] **Step 5: Commit admin management**

```bash
git add web/src/app/api/admin/invitations web/src/app/\(admin\)/admin web/tests/unit/admin-invitations-api.test.ts web/tests/e2e/foundation.spec.ts
git commit -m "feat: manage invitation codes in admin"
```

### Task 6: Update release controls and close acceptance

**Files:**
- Modify: `web/.env.staging.example`
- Modify: `web/docs/pilot-readiness.md`
- Modify: `web/docs/cloud-staging-runbook.md`
- Modify: `web/docs/release-checklist.md`
- Create: `docs/superpowers/acceptance/2026-07-16-invitation-code-entitlements-acceptance.md`

- [ ] **Step 1: Document the new environment and operator workflow**

Add `REGISTRATION_MODE="invite_only"` for beta and `REGISTRATION_MODE="open"`
for public registration to the staging example and runbooks. Document creating
the first code as an administrator, granting a customer extra quota, disabling
a compromised code, and checking redemption history. State that codes never
expose a real API key or bypass normal rate limits.

- [ ] **Step 2: Write acceptance criteria before final verification**

Create the acceptance document covering every design criterion: capacity,
atomicity, duplicate prevention, registration mode, Settings redemption, admin
authorization, quota persistence, rollback-safe migration, and exclusions.

- [ ] **Step 3: Run all automated verification**

Run:

```bash
cd web
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
STAGING_BASE_URL="https://resumeai-staging.onrender.com" pnpm smoke:staging
```

Expected: all commands exit 0. Inspect desktop and mobile screenshots for the
registration, Settings, and admin invitation controls.

- [ ] **Step 4: Publish staging and perform operator smoke**

Run `git diff --check`, stage only invitation-code implementation, tests,
documentation, and migration files, then push
`codex/plan8-render-staging-config`. In Render, set
`REGISTRATION_MODE=invite_only` only when the first active code exists; run a
registration attempt with and without a code, then restore `open` after public
launch rehearsal.

- [ ] **Step 5: Commit release artifacts**

```bash
git add web/.env.staging.example web/docs docs/superpowers/acceptance/2026-07-16-invitation-code-entitlements-acceptance.md
git commit -m "docs: add invitation code release gates"
```
