import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createInvitationCode } from "../../src/lib/invitations/service";

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  const databasePath = databaseUrl?.slice("file:".length).split("?")[0];
  if (!databaseUrl?.startsWith("file:") || !databasePath?.endsWith(".test.db")) {
    throw new Error("Invitation service tests require an explicitly named test SQLite database");
  }
}

describe("invitation service test database guard", () => {
  it("rejects the developer dev database", () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = "file:./dev.db";
      expect(() => assertSafeTestDatabase()).toThrow("explicitly named test SQLite database");
    } finally {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});

describe("invitation service", () => {
  beforeEach(async () => {
    assertSafeTestDatabase();
    await db.invitationRedemption.deleteMany();
    await db.invitationCode.deleteMany();
    await db.usageLog.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("persists a new invitation code with its configured capacity and bonus", async () => {
    const created = await createInvitationCode({
      label: "July beta friends",
      maxUses: 3,
      bonusQuota: 5,
    });

    const invitation = await db.invitationCode.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(invitation).toMatchObject({
      label: "July beta friends",
      maxUses: 3,
      usedCount: 0,
      bonusQuota: 5,
      active: true,
    });
  });

  it("rejects an empty label and non-positive quota configuration", async () => {
    await expect(
      createInvitationCode({ label: "", maxUses: 3, bonusQuota: 5 }),
    ).rejects.toThrow("Invitation label is required");
    await expect(
      createInvitationCode({ label: "Beta", maxUses: 0, bonusQuota: 5 }),
    ).rejects.toThrow("maxUses must be a positive integer");
    await expect(
      createInvitationCode({ label: "Beta", maxUses: 3, bonusQuota: 0 }),
    ).rejects.toThrow("bonusQuota must be a positive integer");
  });
});
