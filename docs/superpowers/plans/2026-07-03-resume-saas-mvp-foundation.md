# Resume SaaS MVP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working foundation for the resume SaaS: app scaffold, authentication, user-isolated personal information library, quota tracking, and minimal admin backend.

**Architecture:** Create a new `web/` Next.js application in this workspace. Use Prisma as the data boundary, server actions/API routes for mutations, and role-based guards for user/admin areas. This plan intentionally stops before AI JD matching, rewrite generation, resume editor, templates, and PDF export; those should be separate implementation plans after the foundation is stable.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Prisma, SQLite for local development, PostgreSQL-compatible Prisma schema for deployment, Vitest, Playwright, Zod, bcryptjs.

---

## Scope Split

The approved PRD covers several independent subsystems. Implement it as four plans:

1. **MVP Foundation**: app scaffold, auth, database, personal information library, quota, minimal admin. This document.
2. **AI Matching and Rewrite**: LLM provider abstraction, JD parsing, recommendation, STAR rewrite confirmation.
3. **Resume Editor and Templates**: left library / right resume editor, template customization, bilingual output, PDF export.
4. **Deployment and Hardening**: production config, backups, monitoring, privacy workflows, release checklist.

Do not start Plan 2 until this plan has a passing local smoke flow.

## File Structure

Create these files under `/Users/lixinan/Desktop/简历修改工具/web`:

- `package.json`: scripts and dependencies.
- `.env.example`: documented local environment variables.
- `prisma/schema.prisma`: database models for users, profile, experiences, quotas, usage logs.
- `prisma/seed.ts`: local admin and sample user seed.
- `src/lib/db.ts`: Prisma client singleton.
- `src/lib/auth/password.ts`: password hashing and verification.
- `src/lib/auth/session.ts`: signed session cookie helpers.
- `src/lib/auth/guards.ts`: user/admin route guards.
- `src/lib/quota/quota-service.ts`: quota checking and usage recording.
- `src/lib/profile/profile-service.ts`: profile CRUD.
- `src/lib/experience/experience-service.ts`: experience CRUD.
- `src/app/(public)/login/page.tsx`: login page.
- `src/app/(public)/register/page.tsx`: registration page.
- `src/app/(app)/layout.tsx`: authenticated app shell.
- `src/app/(app)/library/page.tsx`: personal information library page.
- `src/app/(admin)/admin/page.tsx`: minimal admin dashboard.
- `src/app/api/auth/register/route.ts`: registration endpoint.
- `src/app/api/auth/login/route.ts`: login endpoint.
- `src/app/api/auth/logout/route.ts`: logout endpoint.
- `src/app/api/profile/route.ts`: profile read/update endpoint.
- `src/app/api/experiences/route.ts`: experience list/create endpoint.
- `src/app/api/experiences/[id]/route.ts`: experience update/archive endpoint.
- `src/app/api/admin/users/route.ts`: admin user/quota endpoint.
- `tests/unit/auth.test.ts`: password/session tests.
- `tests/unit/quota.test.ts`: quota behavior tests.
- `tests/unit/profile-experience.test.ts`: ownership and CRUD tests.
- `tests/e2e/foundation.spec.ts`: register/login/library/admin smoke.

## Data Model

Use this Prisma model shape in `prisma/schema.prisma`.

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  USER
  ADMIN
}

enum ExperienceType {
  PROJECT
  INTERNSHIP
  WORK
  EDUCATION
  SKILL
}

enum ExperienceStatus {
  ACTIVE
  ARCHIVED
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String
  role         UserRole     @default(USER)
  quotaLimit   Int          @default(20)
  quotaUsed    Int          @default(0)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  profile      Profile?
  experiences  Experience[]
  usageLogs    UsageLog[]
}

model Profile {
  id                String   @id @default(cuid())
  userId            String   @unique
  name              String   @default("")
  location          String   @default("")
  targetTitle       String   @default("")
  summary           String   @default("")
  phone             String   @default("")
  contactEmail      String   @default("")
  linkedin          String   @default("")
  github            String   @default("")
  website           String   @default("")
  workAuthorization String   @default("")
  languages         Json     @default("[]")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Experience {
  id               String           @id @default(cuid())
  userId           String
  type             ExperienceType
  title            String
  organization     String           @default("")
  role             String           @default("")
  startDate        String           @default("")
  endDate          String           @default("")
  rawText          String           @default("")
  structuredFields Json             @default("{}")
  skills           Json             @default("[]")
  tags             Json             @default("[]")
  metrics          Json             @default("[]")
  status           ExperienceStatus @default(ACTIVE)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type, status])
}

model UsageLog {
  id                String   @id @default(cuid())
  userId            String
  actionType        String
  relatedObjectType String   @default("")
  relatedObjectId   String   @default("")
  costUnits         Int
  status            String
  createdAt         DateTime @default(now())
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, actionType, createdAt])
}
```

## Task 1: Scaffold Next.js App

**Files:**
- Create: `web/package.json`
- Create: `web/.env.example`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/globals.css`

- [ ] **Step 1: Create the app shell**

Run:

```bash
mkdir -p web
cd web
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Expected: Next.js creates `src/app`, `package.json`, Tailwind config, and TypeScript config.

- [ ] **Step 2: Install foundation dependencies**

Run:

```bash
pnpm add @prisma/client bcryptjs zod jose
pnpm add -D prisma vitest @vitejs/plugin-react jsdom playwright tsx
```

Expected: dependencies are added to `web/package.json`.

- [ ] **Step 3: Add scripts**

Modify `web/package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 4: Add environment example**

Create `web/.env.example`:

```dotenv
DATABASE_URL="file:./dev.db"
SESSION_SECRET="replace-with-at-least-32-random-characters"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="ChangeMe123!"
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add web
git commit -m "chore: scaffold resume saas web app"
```

If this workspace is not a git repository, run `git init` first and commit the PRD plus this plan in the initial commit.

## Task 2: Database and Seed

**Files:**
- Create: `web/prisma/schema.prisma`
- Create: `web/prisma/seed.ts`
- Create: `web/src/lib/db.ts`

- [ ] **Step 1: Add Prisma schema**

Create `web/prisma/schema.prisma` using the full schema in the Data Model section.

- [ ] **Step 2: Add Prisma client singleton**

Create `web/src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 3: Add seed script**

Create `web/prisma/seed.ts`:

```ts
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", quotaLimit: 999999, passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      quotaLimit: 999999,
      profile: { create: { name: "Admin", contactEmail: adminEmail } },
    },
  });

  await db.user.upsert({
    where: { email: "student@example.com" },
    update: {},
    create: {
      email: "student@example.com",
      passwordHash: await bcrypt.hash("Student123!", 12),
      quotaLimit: 20,
      profile: {
        create: {
          name: "Demo Student",
          location: "Sydney",
          targetTitle: "AI Engineer Intern",
          contactEmail: "student@example.com",
        },
      },
      experiences: {
        create: [
          {
            type: "PROJECT",
            title: "Aspect-Based Sentiment Analysis",
            role: "Project Lead",
            rawText: "Built ABSA workflow with data cleaning, model evaluation, and error analysis.",
            skills: ["Python", "BERT", "RoBERTa"],
            tags: ["NLP", "Machine Learning"],
          },
        ],
      },
    },
  });
}

main()
  .then(async () => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 4: Run migration and seed**

Run:

```bash
cp .env.example .env
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
```

Expected: Prisma creates SQLite database and seeds admin plus sample user.

- [ ] **Step 5: Commit**

Run:

```bash
git add web/prisma web/src/lib/db.ts
git commit -m "feat: add database schema and seed users"
```

## Task 3: Authentication Services

**Files:**
- Create: `web/src/lib/auth/password.ts`
- Create: `web/src/lib/auth/session.ts`
- Create: `web/src/lib/auth/guards.ts`
- Create: `web/tests/unit/auth.test.ts`

- [ ] **Step 1: Write unit tests**

Create `web/tests/unit/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password";
import { signSessionValue, verifySessionValue } from "../../src/lib/auth/session";

describe("password helpers", () => {
  it("verifies a hashed password", async () => {
    const hash = await hashPassword("Secret123!");
    await expect(verifyPassword("Secret123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("Wrong123!", hash)).resolves.toBe(false);
  });
});

describe("session helpers", () => {
  it("round trips a signed session", async () => {
    process.env.SESSION_SECRET = "12345678901234567890123456789012";
    const value = await signSessionValue({ userId: "u1", role: "ADMIN" });
    await expect(verifySessionValue(value)).resolves.toEqual({ userId: "u1", role: "ADMIN" });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test tests/unit/auth.test.ts
```

Expected: FAIL because auth helper files do not exist.

- [ ] **Step 3: Implement password helpers**

Create `web/src/lib/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Implement session helpers**

Create `web/src/lib/auth/session.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

export type SessionRole = "USER" | "ADMIN";
export type SessionPayload = { userId: string; role: SessionRole };

const SESSION_COOKIE = "resume_session";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export async function signSessionValue(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionValue(value: string): Promise<SessionPayload> {
  const result = await jwtVerify(value, secretKey());
  const userId = result.payload.userId;
  const role = result.payload.role;
  if (typeof userId !== "string" || (role !== "USER" && role !== "ADMIN")) {
    throw new Error("Invalid session payload");
  }
  return { userId, role };
}
```

- [ ] **Step 5: Implement route guards**

Create `web/src/lib/auth/guards.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionCookieName, verifySessionValue } from "./session";

export async function currentUser() {
  const cookieStore = await cookies();
  const value = cookieStore.get(sessionCookieName())?.value;
  if (!value) return null;
  try {
    const session = await verifySessionValue(value);
    return db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true, quotaLimit: true, quotaUsed: true },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/library");
  return user;
}
```

- [ ] **Step 6: Verify tests**

Run:

```bash
pnpm test tests/unit/auth.test.ts
pnpm typecheck
```

Expected: PASS and typecheck exits 0.

- [ ] **Step 7: Commit**

Run:

```bash
git add web/src/lib/auth web/tests/unit/auth.test.ts
git commit -m "feat: add password and session helpers"
```

## Task 4: Auth API and Public Pages

**Files:**
- Create: `web/src/app/api/auth/register/route.ts`
- Create: `web/src/app/api/auth/login/route.ts`
- Create: `web/src/app/api/auth/logout/route.ts`
- Create: `web/src/app/(public)/login/page.tsx`
- Create: `web/src/app/(public)/register/page.tsx`

- [ ] **Step 1: Implement registration route**

Create `web/src/app/api/auth/register/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const parsed = RegisterSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid registration input" }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      profile: { create: { contactEmail: parsed.data.email } },
    },
    select: { id: true, email: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
```

- [ ] **Step 2: Implement login route**

Create `web/src/app/api/auth/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { sessionCookieName, signSessionValue } from "@/lib/auth/session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid login input" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });
  response.cookies.set(sessionCookieName(), await signSessionValue({ userId: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
```

- [ ] **Step 3: Implement logout route**

Create `web/src/app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName());
  return response;
}
```

- [ ] **Step 4: Create simple login/register pages**

Create `web/src/app/(public)/login/page.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Login failed");
      return;
    }
    router.push("/library");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">登录</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input name="email" type="email" required placeholder="邮箱" className="w-full rounded border px-3 py-2" />
        <input name="password" type="password" required placeholder="密码" className="w-full rounded border px-3 py-2" />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full rounded bg-black px-4 py-2 text-white">登录</button>
      </form>
    </main>
  );
}
```

Create `web/src/app/(public)/register/page.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const register = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!register.ok) {
      const body = await register.json();
      setError(body.error ?? "Registration failed");
      return;
    }
    const login = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) {
      setError("Registered, but automatic login failed");
      return;
    }
    router.push("/library");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">注册</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input name="email" type="email" required placeholder="邮箱" className="w-full rounded border px-3 py-2" />
        <input name="password" type="password" required minLength={8} placeholder="至少 8 位密码" className="w-full rounded border px-3 py-2" />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full rounded bg-black px-4 py-2 text-white">创建账号</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Verify auth API**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add 'web/src/app/(public)' web/src/app/api/auth
git commit -m "feat: add registration and login flow"
```

## Task 5: Personal Information Library Services

**Files:**
- Create: `web/src/lib/profile/profile-service.ts`
- Create: `web/src/lib/experience/experience-service.ts`
- Create: `web/tests/unit/profile-experience.test.ts`
- Create: `web/src/app/api/profile/route.ts`
- Create: `web/src/app/api/experiences/route.ts`
- Create: `web/src/app/api/experiences/[id]/route.ts`

- [ ] **Step 1: Write service tests**

Create `web/tests/unit/profile-experience.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeExperienceInput } from "../../src/lib/experience/experience-service";

describe("normalizeExperienceInput", () => {
  it("keeps experience blocks as the smallest reusable unit", () => {
    const result = normalizeExperienceInput({
      type: "PROJECT",
      title: "ABSA",
      rawText: "Built a sentiment analysis project from March to May.",
      skills: ["Python", "BERT"],
      tags: ["NLP"],
    });

    expect(result).toMatchObject({
      type: "PROJECT",
      title: "ABSA",
      rawText: "Built a sentiment analysis project from March to May.",
      skills: ["Python", "BERT"],
      tags: ["NLP"],
      status: "ACTIVE",
    });
  });
});
```

- [ ] **Step 2: Implement profile service**

Create `web/src/lib/profile/profile-service.ts`:

```ts
import { z } from "zod";
import { db } from "@/lib/db";

export const ProfileInputSchema = z.object({
  name: z.string().default(""),
  location: z.string().default(""),
  targetTitle: z.string().default(""),
  summary: z.string().default(""),
  phone: z.string().default(""),
  contactEmail: z.string().email().or(z.literal("")).default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  website: z.string().default(""),
  workAuthorization: z.string().default(""),
  languages: z.array(z.string()).default([]),
});

export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export async function getProfile(userId: string) {
  return db.profile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const data = ProfileInputSchema.parse(input);
  return db.profile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
```

- [ ] **Step 3: Implement experience service**

Create `web/src/lib/experience/experience-service.ts`:

```ts
import { ExperienceStatus, ExperienceType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const ExperienceInputSchema = z.object({
  type: z.nativeEnum(ExperienceType),
  title: z.string().min(1),
  organization: z.string().default(""),
  role: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  rawText: z.string().default(""),
  structuredFields: z.record(z.unknown()).default({}),
  skills: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
});

export type ExperienceInput = z.infer<typeof ExperienceInputSchema>;

export function normalizeExperienceInput(input: ExperienceInput) {
  const parsed = ExperienceInputSchema.parse(input);
  return {
    ...parsed,
    title: parsed.title.trim(),
    organization: parsed.organization.trim(),
    role: parsed.role.trim(),
    rawText: parsed.rawText.trim(),
    skills: parsed.skills.map((item) => item.trim()).filter(Boolean),
    tags: parsed.tags.map((item) => item.trim()).filter(Boolean),
    metrics: parsed.metrics.map((item) => item.trim()).filter(Boolean),
    status: ExperienceStatus.ACTIVE,
  };
}

export async function listExperiences(userId: string) {
  return db.experience.findMany({
    where: { userId, status: ExperienceStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createExperience(userId: string, input: ExperienceInput) {
  return db.experience.create({ data: { userId, ...normalizeExperienceInput(input) } });
}

export async function updateExperience(userId: string, id: string, input: ExperienceInput) {
  const result = await db.experience.updateMany({
    where: { id, userId },
    data: normalizeExperienceInput(input),
  });
  if (result.count === 0) throw new Error("Experience not found");
  return db.experience.findFirstOrThrow({ where: { id, userId } });
}

export async function archiveExperience(userId: string, id: string) {
  const result = await db.experience.updateMany({
    where: { id, userId },
    data: { status: ExperienceStatus.ARCHIVED },
  });
  if (result.count === 0) throw new Error("Experience not found");
  return { id, status: ExperienceStatus.ARCHIVED };
}
```

If `updateExperience` or `archiveExperience` finds no owned row, throw `Error("Experience not found")`.

- [ ] **Step 4: Implement API routes**

Routes must call `requireUser()` and never accept `userId` from the request body.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test tests/unit/profile-experience.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add web/src/lib/profile web/src/lib/experience web/src/app/api/profile web/src/app/api/experiences web/tests/unit/profile-experience.test.ts
git commit -m "feat: add profile and experience services"
```

## Task 6: Information Library UI

**Files:**
- Create: `web/src/app/(app)/layout.tsx`
- Create: `web/src/app/(app)/library/page.tsx`
- Create: `web/src/app/(app)/library/library-client.tsx`

- [ ] **Step 1: Implement authenticated layout**

Use `requireUser()` in `layout.tsx`. Render navigation links for `信息库`, future `JD 匹配`, future `简历编辑`, and admin link only for admins.

- [ ] **Step 2: Implement library page**

Server page loads profile and active experiences for current user. Pass them to `library-client.tsx`.

- [ ] **Step 3: Implement client editor**

The page must expose sections:

- 基本信息
- 联系方式
- 求职属性
- 教育经历
- 项目经历
- 实习经历
- 工作经历
- 职业能力

Create/edit uses API routes from Task 5. Experience cards must display type, title, organization, role, dates, skills, tags, and raw text.

- [ ] **Step 4: Verify manually**

Run:

```bash
pnpm dev
```

Open `http://localhost:3000`, register a user, log in, create one project and one internship.

Expected: created entries remain after page refresh and do not appear under another user.

- [ ] **Step 5: Commit**

Run:

```bash
git add 'web/src/app/(app)'
git commit -m "feat: add personal information library UI"
```

## Task 7: Quota and Usage Service

**Files:**
- Create: `web/src/lib/quota/quota-service.ts`
- Create: `web/tests/unit/quota.test.ts`

- [ ] **Step 1: Write quota tests**

Create tests for:

- Admin can always consume.
- User with `quotaUsed < quotaLimit` can consume.
- User with `quotaUsed >= quotaLimit` is rejected.
- Successful consume creates a usage log.

- [ ] **Step 2: Implement quota service**

Create:

```ts
import { db } from "@/lib/db";

export async function assertCanConsume(userId: string, costUnits: number) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "ADMIN") return;
  if (costUnits < 1) throw new Error("costUnits must be positive");
  if (user.quotaUsed + costUnits > user.quotaLimit) throw new Error("Quota exceeded");
}

export async function recordUsage(input: {
  userId: string;
  actionType: string;
  costUnits: number;
  status: "SUCCESS" | "FAILED";
  relatedObjectType?: string;
  relatedObjectId?: string;
}) {
  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
  const log = await db.usageLog.create({
    data: {
      userId: input.userId,
      actionType: input.actionType,
      relatedObjectType: input.relatedObjectType ?? "",
      relatedObjectId: input.relatedObjectId ?? "",
      costUnits: input.costUnits,
      status: input.status,
    },
  });
  if (input.status === "SUCCESS" && user.role !== "ADMIN") {
    await db.user.update({
      where: { id: input.userId },
      data: { quotaUsed: { increment: input.costUnits } },
    });
  }
  return log;
}
```

If quota is exceeded, throw `Error("Quota exceeded")`.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test tests/unit/quota.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add web/src/lib/quota web/tests/unit/quota.test.ts
git commit -m "feat: add quota and usage tracking"
```

## Task 8: Minimal Admin Backend

**Files:**
- Create: `web/src/app/(admin)/admin/page.tsx`
- Create: `web/src/app/(admin)/admin/admin-client.tsx`
- Create: `web/src/app/api/admin/users/route.ts`

- [ ] **Step 1: Implement admin users API**

`GET /api/admin/users` returns users with id, email, role, quotaLimit, quotaUsed, createdAt. `PATCH /api/admin/users` accepts `{ userId, role, quotaLimit }`. It must call `requireAdmin()`.

- [ ] **Step 2: Implement admin page**

Render:

- User list.
- Role selector: USER / ADMIN.
- Quota limit input.
- Quota used display.
- Save button.

- [ ] **Step 3: Verify**

Run dev server. Log in as seeded admin. Open `/admin`. Change sample user's quota. Log in as sample user and confirm quota display changes if exposed in layout.

- [ ] **Step 4: Commit**

Run:

```bash
git add 'web/src/app/(admin)' web/src/app/api/admin
git commit -m "feat: add minimal admin dashboard"
```

## Task 9: Foundation Smoke Test

**Files:**
- Create: `web/tests/e2e/foundation.spec.ts`
- Create: `web/playwright.config.ts`

- [ ] **Step 1: Add Playwright config**

Create `web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 2: Add e2e test**

Create `web/tests/e2e/foundation.spec.ts` with this flow:

1. Register a new user.
2. Log in.
3. Open `/library`.
4. Add basic profile fields.
5. Add a project experience.
6. Refresh and verify data persists.
7. Log out.
8. Log in as admin.
9. Open `/admin`.
10. Verify registered user appears.

- [ ] **Step 3: Run all checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all commands pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add web/tests/e2e web/playwright.config.ts
git commit -m "test: add foundation smoke coverage"
```

## Self-Review

- Spec coverage in this plan:
  - Covered: accounts, user data isolation, admin unlimited quota, free quota tracking, personal information library, basic profile/contact fields, reusable experience modules, minimal admin backend.
  - Not covered by design: AI text import, JD parsing/recommendation, STAR rewrite confirmation, bilingual output, packaging mode, resume editor, templates, PDF export. These are intentionally assigned to later plans because they are independent subsystems.
- Placeholder scan:
  - No unresolved placeholder markers are present.
  - No scoring module is included.
  - Any step with code either names exact files and behavior or gives concrete code.
- Type consistency:
  - Roles use `USER` and `ADMIN`.
  - Experience types use `PROJECT`, `INTERNSHIP`, `WORK`, `EDUCATION`, `SKILL`.
  - Experience status uses `ACTIVE` and `ARCHIVED`.
