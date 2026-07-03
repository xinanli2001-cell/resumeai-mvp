import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { assertCanConsume, recordUsage } from "../../src/lib/quota/quota-service";

describe("quota service", () => {
  beforeEach(async () => {
    await db.usageLog.deleteMany();
    await db.experience.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("allows admins to consume without increasing quota used", async () => {
    const admin = await db.user.create({
      data: { email: "admin-quota@example.com", passwordHash: "hash", role: "ADMIN", quotaLimit: 1 },
    });

    await expect(assertCanConsume(admin.id, 100)).resolves.toBeUndefined();
    await recordUsage({ userId: admin.id, actionType: "rewrite", costUnits: 100, status: "SUCCESS" });

    const updated = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(updated.quotaUsed).toBe(0);
  });

  it("increments user quota and writes a usage log on success", async () => {
    const user = await db.user.create({
      data: { email: "quota-user@example.com", passwordHash: "hash", quotaLimit: 3, quotaUsed: 1 },
    });

    await expect(assertCanConsume(user.id, 2)).resolves.toBeUndefined();
    await recordUsage({ userId: user.id, actionType: "rewrite", costUnits: 2, status: "SUCCESS" });

    const updated = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { usageLogs: true },
    });
    expect(updated.quotaUsed).toBe(3);
    expect(updated.usageLogs).toHaveLength(1);
  });

  it("rejects users who exceed quota", async () => {
    const user = await db.user.create({
      data: { email: "over@example.com", passwordHash: "hash", quotaLimit: 2, quotaUsed: 2 },
    });

    await expect(assertCanConsume(user.id, 1)).rejects.toThrow("Quota exceeded");
  });
});
