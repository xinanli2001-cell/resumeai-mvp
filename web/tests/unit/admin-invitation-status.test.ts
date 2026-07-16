import { describe, expect, it } from "vitest";
import { getAdminInvitationStatus } from "../../src/lib/invitations/admin-status";

describe("admin invitation status", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("distinguishes disabled, expired, exhausted, and available codes", () => {
    expect(
      getAdminInvitationStatus(
        { active: false, expiresAt: null, usedCount: 0, maxUses: 1 },
        now,
      ),
    ).toBe("已停用");
    expect(
      getAdminInvitationStatus(
        {
          active: true,
          expiresAt: "2026-07-16T11:59:59.000Z",
          usedCount: 0,
          maxUses: 1,
        },
        now,
      ),
    ).toBe("已过期");
    expect(
      getAdminInvitationStatus(
        { active: true, expiresAt: null, usedCount: 1, maxUses: 1 },
        now,
      ),
    ).toBe("已用完");
    expect(
      getAdminInvitationStatus(
        { active: true, expiresAt: null, usedCount: 0, maxUses: 1 },
        now,
      ),
    ).toBe("可用");
  });
});
