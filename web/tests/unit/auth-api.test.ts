import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { resetEnvForTests } from "../../src/lib/config/env";
import { POST as register } from "../../src/app/api/auth/register/route";

describe("registration route", () => {
  const originalRegistrationMode = process.env.REGISTRATION_MODE;

  beforeEach(async () => {
    process.env.REGISTRATION_MODE = "open";
    resetEnvForTests();
    await db.invitationRedemption.deleteMany();
    await db.invitationCode.deleteMany();
    await db.usageLog.deleteMany();
    await db.experience.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    process.env.REGISTRATION_MODE = originalRegistrationMode;
    resetEnvForTests();
    await db.$disconnect();
  });

  function registrationRequest(input: {
    email: string;
    password?: string;
    invitationCode?: string;
  }) {
    return new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ password: "Secret123!", ...input }),
    });
  }

  async function createStoredInvitation(input: {
    code: string;
    maxUses?: number;
    usedCount?: number;
    bonusQuota?: number;
    active?: boolean;
  }) {
    return db.invitationCode.create({
      data: {
        code: input.code,
        label: "Registration test",
        maxUses: input.maxUses ?? 2,
        usedCount: input.usedCount ?? 0,
        bonusQuota: input.bonusQuota ?? 5,
        active: input.active ?? true,
      },
    });
  }

  it("creates a user with an initialized profile", async () => {
    const response = await register(registrationRequest({ email: "new@example.com" }));

    expect(response.status).toBe(201);
    const user = await db.user.findUniqueOrThrow({
      where: { email: "new@example.com" },
      include: { profile: true },
    });
    expect(user.profile?.contactEmail).toBe("new@example.com");
    expect(user.profile?.languages).toEqual([]);
  });

  it("rejects registration without a code in invite-only mode", async () => {
    process.env.REGISTRATION_MODE = "invite_only";
    resetEnvForTests();

    const response = await register(registrationRequest({ email: "closed@example.com" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "邀请码为必填项" });
    await expect(db.user.count({ where: { email: "closed@example.com" } })).resolves.toBe(0);
  });

  it("atomically creates the account and grants quota for a valid code", async () => {
    await createStoredInvitation({ code: "BETA-ACCESS", maxUses: 1, bonusQuota: 7 });
    process.env.REGISTRATION_MODE = "invite_only";
    resetEnvForTests();

    const response = await register(
      registrationRequest({ email: "invited@example.com", invitationCode: " beta-access " }),
    );

    expect(response.status).toBe(201);
    const user = await db.user.findUniqueOrThrow({
      where: { email: "invited@example.com" },
      include: { profile: true, invitationRedemptions: true },
    });
    expect(user.profile?.contactEmail).toBe("invited@example.com");
    expect(user.quotaLimit).toBe(27);
    expect(user.invitationRedemptions).toHaveLength(1);
    expect(user.invitationRedemptions[0]?.bonusQuota).toBe(7);
    await expect(
      db.invitationCode.findUniqueOrThrow({ where: { code: "BETA-ACCESS" } }),
    ).resolves.toMatchObject({ usedCount: 1 });
  });

  it("rejects an unavailable supplied code without creating account state", async () => {
    await createStoredInvitation({ code: "USED-UP", maxUses: 1, usedCount: 1 });

    const response = await register(
      registrationRequest({ email: "rollback@example.com", invitationCode: "USED-UP" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "邀请码无效或不可用" });
    await expect(db.user.count({ where: { email: "rollback@example.com" } })).resolves.toBe(0);
    await expect(db.profile.count({ where: { contactEmail: "rollback@example.com" } })).resolves.toBe(0);
    await expect(db.invitationRedemption.count()).resolves.toBe(0);
    await expect(
      db.invitationCode.findUniqueOrThrow({ where: { code: "USED-UP" } }),
    ).resolves.toMatchObject({ usedCount: 1 });
  });

  it("rejects a nonexistent supplied code with the same generic response", async () => {
    const response = await register(
      registrationRequest({ email: "invalid@example.com", invitationCode: "DOES-NOT-EXIST" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "邀请码无效或不可用" });
    await expect(db.user.count({ where: { email: "invalid@example.com" } })).resolves.toBe(0);
    await expect(db.profile.count({ where: { contactEmail: "invalid@example.com" } })).resolves.toBe(0);
  });

  it("rolls back reservation and all account state after a post-reservation failure", async () => {
    await createStoredInvitation({ code: "ROLLBACK-REGISTRATION", maxUses: 1, bonusQuota: 7 });
    await db.$executeRawUnsafe(`
      CREATE TRIGGER force_invited_user_failure
      BEFORE INSERT ON "User"
      WHEN NEW.email = 'post-reservation@example.com'
      BEGIN
        SELECT RAISE(ABORT, 'forced invited user failure');
      END;
    `);

    try {
      await expect(
        register(
          registrationRequest({
            email: "post-reservation@example.com",
            invitationCode: "ROLLBACK-REGISTRATION",
          }),
        ),
      ).rejects.toThrow();
    } finally {
      await db.$executeRawUnsafe("DROP TRIGGER IF EXISTS force_invited_user_failure");
    }

    await expect(
      db.invitationCode.findUniqueOrThrow({ where: { code: "ROLLBACK-REGISTRATION" } }),
    ).resolves.toMatchObject({ usedCount: 0 });
    await expect(
      db.user.count({ where: { email: "post-reservation@example.com" } }),
    ).resolves.toBe(0);
    await expect(
      db.profile.count({ where: { contactEmail: "post-reservation@example.com" } }),
    ).resolves.toBe(0);
    await expect(db.invitationRedemption.count()).resolves.toBe(0);
  });
});
