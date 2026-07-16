import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { randomBytesMock } = vi.hoisted(() => ({ randomBytesMock: vi.fn() }));

vi.mock("node:crypto", () => ({ randomBytes: randomBytesMock }));

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
    randomBytesMock.mockReset();
    randomBytesMock.mockReturnValue(Buffer.from("default-invitation-code"));
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

  it("retries a generated code collision and persists the next unique code", async () => {
    const collidingBytes = Buffer.from("collision");
    const recoveredBytes = Buffer.from("recovered");
    const collidingCode = collidingBytes.toString("base64url").toUpperCase();
    const recoveredCode = recoveredBytes.toString("base64url").toUpperCase();
    await db.invitationCode.create({
      data: {
        code: collidingCode,
        label: "Existing code",
        maxUses: 1,
        bonusQuota: 1,
      },
    });
    randomBytesMock
      .mockReturnValueOnce(collidingBytes)
      .mockReturnValueOnce(recoveredBytes);

    const invitation = await createInvitationCode({
      label: "Fresh code",
      maxUses: 2,
      bonusQuota: 3,
    });

    expect(invitation.code).toBe(recoveredCode);
    expect(randomBytesMock).toHaveBeenCalledTimes(2);
  });

  it("throws a typed actionable error after generated code collisions are exhausted", async () => {
    const collidingBytes = Buffer.from("always-collides");
    await db.invitationCode.create({
      data: {
        code: collidingBytes.toString("base64url").toUpperCase(),
        label: "Existing code",
        maxUses: 1,
        bonusQuota: 1,
      },
    });
    randomBytesMock.mockReturnValue(collidingBytes);

    await expect(
      createInvitationCode({ label: "Fresh code", maxUses: 2, bonusQuota: 3 }),
    ).rejects.toMatchObject({
      name: "InvitationCodeCreationError",
      code: "CODE_GENERATION_EXHAUSTED",
      message: "Unable to generate a unique invitation code. Please try again.",
    });
    expect(randomBytesMock).toHaveBeenCalledTimes(5);
  });
});
