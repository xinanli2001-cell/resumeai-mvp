import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createInvitationCode } from "../../src/lib/invitations/service";

describe("invitation service", () => {
  beforeEach(async () => {
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
});
