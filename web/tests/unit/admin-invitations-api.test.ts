import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));

vi.mock("../../src/lib/auth/guards", () => ({ requireAdmin: requireAdminMock }));

import { db } from "../../src/lib/db";
import { GET, POST } from "../../src/app/api/admin/invitations/route";
import { PATCH } from "../../src/app/api/admin/invitations/[id]/route";

describe("admin invitation routes", () => {
  beforeEach(async () => {
    requireAdminMock.mockReset();
    await db.invitationRedemption.deleteMany();
    await db.invitationCode.deleteMany();
    await db.usageLog.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function adminSession() {
    requireAdminMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      quotaLimit: 999999,
      quotaUsed: 0,
    });
  }

  function createRequest(body: unknown) {
    return new Request("http://localhost/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function updateRequest(id: string, body: unknown) {
    return [
      new Request(`http://localhost/api/admin/invitations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    ] as const;
  }

  it("does not create invitation codes when the admin guard rejects", async () => {
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      POST(createRequest({ label: "Blocked", maxUses: 1, bonusQuota: 1 })),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(db.invitationCode.count()).resolves.toBe(0);
  });

  it("does not list or update invitation codes when the admin guard rejects", async () => {
    const invitation = await db.invitationCode.create({
      data: { code: "ADMIN-ONLY", label: "Admin only", maxUses: 1, bonusQuota: 1 },
    });
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");
    const [request, context] = updateRequest(invitation.id, { active: false });
    await expect(PATCH(request, context)).rejects.toThrow("NEXT_REDIRECT");
    await expect(
      db.invitationCode.findUniqueOrThrow({ where: { id: invitation.id } }),
    ).resolves.toMatchObject({ active: true });
  });

  it("creates, lists with recent redemption history, and deactivates a code", async () => {
    adminSession();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();

    const createResponse = await POST(
      createRequest({
        label: "July beta friends",
        maxUses: 3,
        bonusQuota: 7,
        expiresAt,
      }),
    );

    expect(createResponse.status).toBe(201);
    const createdBody = await createResponse.json();
    expect(createdBody.invitation).toMatchObject({
      label: "July beta friends",
      maxUses: 3,
      usedCount: 0,
      bonusQuota: 7,
      active: true,
      expiresAt,
    });
    expect(createdBody.invitation.code).toMatch(/^[A-Z0-9_-]+$/);

    const user = await db.user.create({
      data: { email: "redeemed@example.com", passwordHash: "hash" },
    });
    const redemption = await db.invitationRedemption.create({
      data: {
        invitationCodeId: createdBody.invitation.id,
        userId: user.id,
        bonusQuota: 7,
      },
    });
    await db.invitationCode.update({
      where: { id: createdBody.invitation.id },
      data: { usedCount: 1 },
    });

    const listResponse = await GET();
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      invitations: [
        expect.objectContaining({
          id: createdBody.invitation.id,
          code: createdBody.invitation.code,
          label: "July beta friends",
          maxUses: 3,
          usedCount: 1,
          bonusQuota: 7,
          active: true,
          redemptions: [
            {
              bonusQuota: 7,
              redeemedAt: redemption.redeemedAt.toISOString(),
              user: { email: "redeemed@example.com" },
            },
          ],
        }),
      ],
    });

    const [request, context] = updateRequest(createdBody.invitation.id, { active: false });
    const updateResponse = await PATCH(request, context);
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toEqual({
      invitation: expect.objectContaining({ id: createdBody.invitation.id, active: false }),
    });
  });

  it("rejects invalid creation and patch input", async () => {
    adminSession();

    const invalidCreate = await POST(
      createRequest({
        label: "Invalid",
        maxUses: 1,
        bonusQuota: 1,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    );
    expect(invalidCreate.status).toBe(400);

    const invitation = await db.invitationCode.create({
      data: { code: "STRICT-PATCH", label: "Strict", maxUses: 1, bonusQuota: 1 },
    });
    const [request, context] = updateRequest(invitation.id, { active: false, code: "REPLACE" });
    const invalidPatch = await PATCH(request, context);
    expect(invalidPatch.status).toBe(400);
    await expect(db.invitationCode.findUniqueOrThrow({ where: { id: invitation.id } })).resolves.toMatchObject({
      active: true,
      code: "STRICT-PATCH",
    });
  });

  it("returns 400 for malformed JSON", async () => {
    adminSession();

    const createResponse = await POST(
      new Request("http://localhost/api/admin/invitations", {
        method: "POST",
        body: "{",
      }),
    );
    expect(createResponse.status).toBe(400);

    const invitation = await db.invitationCode.create({
      data: { code: "MALFORMED", label: "Malformed", maxUses: 1, bonusQuota: 1 },
    });
    const updateResponse = await PATCH(
      new Request(`http://localhost/api/admin/invitations/${invitation.id}`, {
        method: "PATCH",
        body: "{",
      }),
      { params: Promise.resolve({ id: invitation.id }) },
    );
    expect(updateResponse.status).toBe(400);
  });
});
