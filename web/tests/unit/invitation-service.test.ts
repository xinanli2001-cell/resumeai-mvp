import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { randomBytesMock } = vi.hoisted(() => ({ randomBytesMock: vi.fn() }));

vi.mock("node:crypto", () => ({ randomBytes: randomBytesMock }));

import { db } from "../../src/lib/db";
import {
  deactivateInvitationCode,
  InvitationError,
  type InvitationQuotaSummary,
  normalizeInvitationCode,
  redeemInvitationCode,
  createInvitationCode,
} from "../../src/lib/invitations/service";

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

  async function createUser(email: string, quotaLimit = 20, quotaUsed = 0) {
    return db.user.create({
      data: { email, passwordHash: "hash", quotaLimit, quotaUsed },
    });
  }

  async function createStoredInvitation(input: {
    code: string;
    maxUses?: number;
    usedCount?: number;
    bonusQuota?: number;
    active?: boolean;
    expiresAt?: Date | null;
  }) {
    return db.invitationCode.create({
      data: {
        code: input.code,
        label: "Test invitation",
        maxUses: input.maxUses ?? 2,
        usedCount: input.usedCount ?? 0,
        bonusQuota: input.bonusQuota ?? 5,
        active: input.active ?? true,
        expiresAt: input.expiresAt,
      },
    });
  }

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

  it("normalizes invitation codes before lookup and returns the updated quota summary", async () => {
    const user = await createUser("friend@example.com", 20, 3);
    await createStoredInvitation({ code: "FRIEND-2026" });

    expect(normalizeInvitationCode(" friend-2026 ")).toBe("FRIEND-2026");

    await expect(
      redeemInvitationCode({ userId: user.id, rawCode: " friend-2026 " }),
    ).resolves.toEqual({ quotaLimit: 25, quotaUsed: 3, remaining: 22 });

    await expect(db.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      quotaLimit: 25,
      quotaUsed: 3,
    });
    await expect(db.invitationCode.findUniqueOrThrow({ where: { code: "FRIEND-2026" } })).resolves.toMatchObject({
      usedCount: 1,
    });
    await expect(db.invitationRedemption.count()).resolves.toBe(1);
  });

  it.each([
    ["an empty code", "  ", {}, "INVALID_CODE"],
    ["a missing code", "MISSING", {}, "INVALID_CODE"],
    ["an inactive code", "INACTIVE", { active: false }, "UNAVAILABLE"],
    ["an expired code", "EXPIRED", { expiresAt: new Date("2026-01-01T00:00:00.000Z") }, "UNAVAILABLE"],
    ["an exhausted code", "EXHAUSTED", { maxUses: 1, usedCount: 1 }, "UNAVAILABLE"],
  ] as const)("rejects %s without changing entitlement state", async (_description, rawCode, invitationInput, code) => {
    const user = await createUser(`failure-${rawCode.trim() || "empty"}@example.com`);
    if (rawCode.trim() && rawCode !== "MISSING") {
      await createStoredInvitation({ code: rawCode, ...invitationInput });
    }

    await expect(redeemInvitationCode({ userId: user.id, rawCode })).rejects.toMatchObject({
      name: "InvitationError",
      code,
    } satisfies Partial<InvitationError>);

    await expect(db.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      quotaLimit: 20,
      quotaUsed: 0,
    });
    await expect(db.invitationRedemption.count()).resolves.toBe(0);
    if (rawCode.trim() && rawCode !== "MISSING") {
      await expect(db.invitationCode.findUniqueOrThrow({ where: { code: rawCode } })).resolves.toMatchObject({
        usedCount: ("usedCount" in invitationInput ? invitationInput.usedCount : 0) ?? 0,
      });
    }
  });

  it("guards the capacity reservation with the same expiry timestamp used for eligibility", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const transactionSpy = vi.spyOn(db, "$transaction");
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-1" }),
      },
      invitationCode: {
        findUnique: vi.fn().mockResolvedValue({
          id: "invitation-1",
          active: true,
          expiresAt: new Date("2026-07-16T12:01:00.000Z"),
          usedCount: 0,
          maxUses: 1,
          bonusQuota: 5,
        }),
        updateMany,
      },
      invitationRedemption: {
        findUnique: vi.fn(),
      },
    };

    vi.useFakeTimers();
    vi.setSystemTime(now);
    transactionSpy.mockImplementation(
      (async (callback: (tx: typeof transaction) => Promise<InvitationQuotaSummary>) =>
        callback(transaction)) as never,
    );

    try {
      await expect(
        redeemInvitationCode({ userId: "user-1", rawCode: "EXPIRY-CAS" }),
      ).rejects.toMatchObject({ code: "UNAVAILABLE" } satisfies Partial<InvitationError>);

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: "invitation-1",
          active: true,
          usedCount: 0,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { usedCount: { increment: 1 } },
      });
    } finally {
      transactionSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("returns unavailable to one caller when two reservations race on the same snapshot", async () => {
    const transactionSpy = vi.spyOn(db, "$transaction");
    let usedCount = 0;
    let arrivals = 0;
    let releaseBarrier: (() => void) | undefined;
    const bothAtReservation = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const makeTransaction = (userId: string) => ({
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: userId }),
        update: vi.fn().mockResolvedValue({ quotaLimit: 25, quotaUsed: 0 }),
      },
      invitationCode: {
        findUnique: vi.fn().mockImplementation(async () => ({
          id: "invitation-1",
          active: true,
          expiresAt: null,
          usedCount,
          maxUses: 1,
          bonusQuota: 5,
        })),
        updateMany: vi.fn().mockImplementation(async ({ where }: { where: { usedCount: number } }) => {
          arrivals += 1;
          if (arrivals === 2) releaseBarrier?.();
          await bothAtReservation;
          if (where.usedCount !== usedCount) return { count: 0 };
          usedCount += 1;
          return { count: 1 };
        }),
      },
      invitationRedemption: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: `redemption-${userId}` }),
      },
    });
    const transactions = [makeTransaction("user-1"), makeTransaction("user-2")];
    let transactionIndex = 0;
    transactionSpy.mockImplementation(
      (async (callback: (tx: (typeof transactions)[number]) => Promise<InvitationQuotaSummary>) =>
        callback(transactions[transactionIndex++]!)) as never,
    );

    try {
      const results = await Promise.allSettled([
        redeemInvitationCode({ userId: "user-1", rawCode: "FINAL-USE" }),
        redeemInvitationCode({ userId: "user-2", rawCode: "FINAL-USE" }),
      ]);

      expect(arrivals).toBe(2);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(InvitationError);
      expect(rejected[0]?.reason).toMatchObject({ code: "UNAVAILABLE" });
      expect(usedCount).toBe(1);
      expect(transactions.reduce((count, tx) => count + tx.invitationRedemption.create.mock.calls.length, 0)).toBe(1);
      expect(transactions.reduce((count, tx) => count + tx.user.update.mock.calls.length, 0)).toBe(1);
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it("classifies the same user's losing reservation race as already redeemed", async () => {
    const transactionSpy = vi.spyOn(db, "$transaction");
    let usedCount = 0;
    let reservationAttempts = 0;
    let reservationArrivals = 0;
    let redemptionCreated = false;
    let releaseReservationBarrier: (() => void) | undefined;
    let releaseRedemptionCommit: (() => void) | undefined;
    const bothAtReservation = new Promise<void>((resolve) => {
      releaseReservationBarrier = resolve;
    });
    const redemptionCommitted = new Promise<void>((resolve) => {
      releaseRedemptionCommit = resolve;
    });
    const makeTransaction = () => ({
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "same-user" }),
        update: vi.fn().mockResolvedValue({ quotaLimit: 25, quotaUsed: 0 }),
      },
      invitationCode: {
        findUnique: vi.fn().mockImplementation(async () => ({
          id: "invitation-1",
          active: true,
          expiresAt: null,
          usedCount,
          maxUses: 2,
          bonusQuota: 5,
        })),
        updateMany: vi.fn().mockImplementation(async () => {
          reservationArrivals += 1;
          if (reservationArrivals === 2) releaseReservationBarrier?.();
          await bothAtReservation;
          const attempt = reservationAttempts;
          reservationAttempts += 1;
          if (attempt === 0) {
            usedCount += 1;
            return { count: 1 };
          }
          await redemptionCommitted;
          return { count: 0 };
        }),
      },
      invitationRedemption: {
        findUnique: vi.fn().mockImplementation(async () =>
          redemptionCreated ? { id: "redemption-1" } : null,
        ),
        create: vi.fn().mockImplementation(async () => {
          redemptionCreated = true;
          releaseRedemptionCommit?.();
          return { id: "redemption-1" };
        }),
      },
    });
    const transactions = [makeTransaction(), makeTransaction()];
    let transactionIndex = 0;
    transactionSpy.mockImplementation(
      (async (callback: (tx: (typeof transactions)[number]) => Promise<InvitationQuotaSummary>) =>
        callback(transactions[transactionIndex++]!)) as never,
    );

    try {
      const results = await Promise.allSettled([
        redeemInvitationCode({ userId: "same-user", rawCode: "DOUBLE-SUBMIT" }),
        redeemInvitationCode({ userId: "same-user", rawCode: "DOUBLE-SUBMIT" }),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(InvitationError);
      expect(rejected[0]?.reason).toMatchObject({ code: "ALREADY_REDEEMED" });
      expect(usedCount).toBe(1);
      expect(transactions.reduce((count, tx) => count + tx.user.update.mock.calls.length, 0)).toBe(1);
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it("rejects a duplicate redemption without a second quota grant", async () => {
    const user = await createUser("duplicate@example.com");
    await createStoredInvitation({ code: "DUPLICATE", maxUses: 1, bonusQuota: 5 });

    await redeemInvitationCode({ userId: user.id, rawCode: "duplicate" });
    await expect(redeemInvitationCode({ userId: user.id, rawCode: "DUPLICATE" })).rejects.toMatchObject({
      code: "ALREADY_REDEEMED",
    } satisfies Partial<InvitationError>);

    await expect(db.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ quotaLimit: 25 });
    await expect(db.invitationCode.findUniqueOrThrow({ where: { code: "DUPLICATE" } })).resolves.toMatchObject({ usedCount: 1 });
    await expect(db.invitationRedemption.count()).resolves.toBe(1);
  });

  it("rejects a missing user without reserving invitation capacity", async () => {
    await createStoredInvitation({ code: "USER-REQUIRED" });

    await expect(
      redeemInvitationCode({ userId: "missing-user", rawCode: "USER-REQUIRED" }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" } satisfies Partial<InvitationError>);

    await expect(db.invitationCode.findUniqueOrThrow({ where: { code: "USER-REQUIRED" } })).resolves.toMatchObject({
      usedCount: 0,
    });
    await expect(db.invitationRedemption.count()).resolves.toBe(0);
  });

  it("rolls back the capacity reservation when redemption creation fails", async () => {
    const user = await createUser("rollback@example.com");
    await createStoredInvitation({ code: "ROLLBACK" });
    await db.$executeRawUnsafe(`
      CREATE TRIGGER force_invitation_redemption_failure
      BEFORE INSERT ON "InvitationRedemption"
      BEGIN
        SELECT RAISE(ABORT, 'forced redemption failure');
      END;
    `);

    try {
      await expect(redeemInvitationCode({ userId: user.id, rawCode: "ROLLBACK" })).rejects.toThrow();
    } finally {
      await db.$executeRawUnsafe("DROP TRIGGER IF EXISTS force_invitation_redemption_failure");
    }

    await expect(db.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ quotaLimit: 20 });
    await expect(db.invitationCode.findUniqueOrThrow({ where: { code: "ROLLBACK" } })).resolves.toMatchObject({ usedCount: 0 });
    await expect(db.invitationRedemption.count()).resolves.toBe(0);
  });

  it("deactivates a code so it can no longer be redeemed", async () => {
    const user = await createUser("deactivated@example.com");
    const invitation = await createStoredInvitation({ code: "DEACTIVATE" });

    await expect(deactivateInvitationCode(invitation.id)).resolves.toMatchObject({ active: false });
    await expect(redeemInvitationCode({ userId: user.id, rawCode: "DEACTIVATE" })).rejects.toMatchObject({
      code: "UNAVAILABLE",
    } satisfies Partial<InvitationError>);
  });

  it("allows exactly one concurrent redemption of the final available use", async () => {
    const [firstUser, secondUser] = await Promise.all([
      createUser("concurrent-first@example.com"),
      createUser("concurrent-second@example.com"),
    ]);
    await createStoredInvitation({ code: "FINAL-USE", maxUses: 1 });

    const results = await Promise.allSettled([
      redeemInvitationCode({ userId: firstUser.id, rawCode: "FINAL-USE" }),
      redeemInvitationCode({ userId: secondUser.id, rawCode: "FINAL-USE" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(InvitationError);
    expect(rejected[0]?.reason).toMatchObject({ code: "UNAVAILABLE" });
    await expect(db.invitationCode.findUniqueOrThrow({ where: { code: "FINAL-USE" } })).resolves.toMatchObject({ usedCount: 1 });
    await expect(db.invitationRedemption.count()).resolves.toBe(1);
  });
});
