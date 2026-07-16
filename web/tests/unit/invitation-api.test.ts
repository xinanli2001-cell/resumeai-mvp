import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));

vi.mock("../../src/lib/auth/guards", () => ({ requireUser: requireUserMock }));

import { db } from "../../src/lib/db";
import { GET as getInvitationSummary } from "../../src/app/api/invitations/me/route";
import { POST as redeemInvitation } from "../../src/app/api/invitations/redeem/route";

describe("authenticated invitation routes", () => {
  beforeEach(async () => {
    requireUserMock.mockReset();
    await db.invitationRedemption.deleteMany();
    await db.invitationCode.deleteMany();
    await db.usageLog.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function createUserAndInvitation() {
    const user = await db.user.create({
      data: {
        email: "settings-invite@example.com",
        passwordHash: "hash",
        quotaLimit: 20,
        quotaUsed: 3,
      },
    });
    const invitation = await db.invitationCode.create({
      data: {
        code: "SETTINGS-BONUS",
        label: "Private admin label",
        maxUses: 2,
        bonusQuota: 5,
      },
    });
    requireUserMock.mockResolvedValue({
      id: user.id,
      email: user.email,
      role: user.role,
      quotaLimit: user.quotaLimit,
      quotaUsed: user.quotaUsed,
    });
    return { user, invitation };
  }

  function redeemRequest(code: string) {
    return new Request("http://localhost/api/invitations/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  it("redeems a valid code and returns the updated quota summary", async () => {
    await createUserAndInvitation();

    const response = await redeemInvitation(redeemRequest(" settings-bonus "));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      quotaLimit: 25,
      quotaUsed: 3,
      remaining: 22,
    });
  });

  it("returns validation error for malformed JSON", async () => {
    await createUserAndInvitation();
    const request = new Request("http://localhost/api/invitations/redeem", {
      method: "POST",
      body: "{",
    });

    const response = await redeemInvitation(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请输入有效邀请码" });
  });

  it("maps duplicate redemption to conflict without another grant", async () => {
    const { user, invitation } = await createUserAndInvitation();
    await db.invitationRedemption.create({
      data: { invitationCodeId: invitation.id, userId: user.id, bonusQuota: 5 },
    });
    await db.invitationCode.update({
      where: { id: invitation.id },
      data: { usedCount: 1 },
    });
    await db.user.update({ where: { id: user.id }, data: { quotaLimit: 25 } });

    const response = await redeemInvitation(redeemRequest("SETTINGS-BONUS"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "该邀请码已兑换" });
    await expect(db.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      quotaLimit: 25,
      quotaUsed: 3,
    });
    await expect(db.invitationRedemption.count()).resolves.toBe(1);
  });

  it("returns only the signed-in user's quota and redemption summary", async () => {
    const { user, invitation } = await createUserAndInvitation();
    const redemption = await db.invitationRedemption.create({
      data: { invitationCodeId: invitation.id, userId: user.id, bonusQuota: 5 },
    });

    const response = await getInvitationSummary();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      quotaLimit: 20,
      quotaUsed: 3,
      remaining: 17,
      redemptions: [{ bonusQuota: 5, redeemedAt: redemption.redeemedAt.toISOString() }],
    });
    expect(JSON.stringify(body)).not.toContain(invitation.id);
    expect(JSON.stringify(body)).not.toContain(invitation.label);
    expect(JSON.stringify(body)).not.toContain(invitation.code);
  });
});
