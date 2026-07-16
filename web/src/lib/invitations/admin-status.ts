export type AdminInvitationStatusInput = {
  active: boolean;
  expiresAt: string | null;
  usedCount: number;
  maxUses: number;
};

export type AdminInvitationStatus = "已停用" | "已过期" | "已用完" | "可用";

export function getAdminInvitationStatus(
  invitation: AdminInvitationStatusInput,
  now = new Date(),
): AdminInvitationStatus {
  if (!invitation.active) {
    return "已停用";
  }
  if (invitation.expiresAt && new Date(invitation.expiresAt) <= now) {
    return "已过期";
  }
  if (invitation.usedCount >= invitation.maxUses) {
    return "已用完";
  }
  return "可用";
}
