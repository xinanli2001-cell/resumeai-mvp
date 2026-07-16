import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";

const invitationCodeGenerationAttempts = 5;

export type CreateInvitationCodeInput = {
  label: string;
  maxUses: number;
  bonusQuota: number;
};

export type RedeemInvitationCodeInput = {
  userId: string;
  rawCode: string;
};

export type InvitationQuotaSummary = {
  quotaLimit: number;
  quotaUsed: number;
  remaining: number;
};

export type InvitationErrorCode =
  | "INVALID_CODE"
  | "UNAVAILABLE"
  | "ALREADY_REDEEMED"
  | "USER_NOT_FOUND";

const invitationErrorMessages: Record<InvitationErrorCode, string> = {
  INVALID_CODE: "Invitation code is invalid.",
  UNAVAILABLE: "Invitation code is unavailable.",
  ALREADY_REDEEMED: "Invitation code has already been redeemed.",
  USER_NOT_FOUND: "User was not found.",
};

export class InvitationError extends Error {
  constructor(readonly code: InvitationErrorCode) {
    super(invitationErrorMessages[code]);
    this.name = "InvitationError";
  }
}

export class InvitationCodeCreationError extends Error {
  readonly code = "CODE_GENERATION_EXHAUSTED";

  constructor() {
    super("Unable to generate a unique invitation code. Please try again.");
    this.name = "InvitationCodeCreationError";
  }
}

function assertPositiveInteger(value: number, field: "maxUses" | "bonusQuota") {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

export function normalizeInvitationCode(rawCode: string) {
  return rawCode.trim().toUpperCase();
}

export async function createInvitationCode(input: CreateInvitationCodeInput) {
  const label = input.label.trim();
  if (!label) throw new Error("Invitation label is required");

  assertPositiveInteger(input.maxUses, "maxUses");
  assertPositiveInteger(input.bonusQuota, "bonusQuota");

  for (let attempt = 0; attempt < invitationCodeGenerationAttempts; attempt += 1) {
    try {
      return await db.invitationCode.create({
        data: {
          code: randomBytes(6).toString("base64url").toUpperCase(),
          label,
          maxUses: input.maxUses,
          bonusQuota: input.bonusQuota,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }

  throw new InvitationCodeCreationError();
}

export async function redeemInvitationCode(
  input: RedeemInvitationCodeInput,
): Promise<InvitationQuotaSummary> {
  const code = normalizeInvitationCode(input.rawCode);
  if (!code) throw new InvitationError("INVALID_CODE");

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw new InvitationError("USER_NOT_FOUND");

    const invitation = await tx.invitationCode.findUnique({ where: { code } });
    if (!invitation) throw new InvitationError("INVALID_CODE");

    const priorRedemption = await tx.invitationRedemption.findUnique({
      where: {
        invitationCodeId_userId: {
          invitationCodeId: invitation.id,
          userId: user.id,
        },
      },
      select: { id: true },
    });
    if (priorRedemption) throw new InvitationError("ALREADY_REDEEMED");

    const now = new Date();
    if (
      !invitation.active ||
      (invitation.expiresAt !== null && invitation.expiresAt <= now) ||
      invitation.usedCount >= invitation.maxUses
    ) {
      throw new InvitationError("UNAVAILABLE");
    }

    const reserved = await tx.invitationCode.updateMany({
      where: {
        id: invitation.id,
        active: true,
        usedCount: invitation.usedCount,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { usedCount: { increment: 1 } },
    });
    if (reserved.count !== 1) throw new InvitationError("UNAVAILABLE");

    await tx.invitationRedemption.create({
      data: {
        invitationCodeId: invitation.id,
        userId: user.id,
        bonusQuota: invitation.bonusQuota,
      },
    });
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { quotaLimit: { increment: invitation.bonusQuota } },
      select: { quotaLimit: true, quotaUsed: true },
    });

    return {
      quotaLimit: updatedUser.quotaLimit,
      quotaUsed: updatedUser.quotaUsed,
      remaining: updatedUser.quotaLimit - updatedUser.quotaUsed,
    };
  });
}

export async function deactivateInvitationCode(invitationCodeId: string) {
  return db.invitationCode.update({
    where: { id: invitationCodeId },
    data: { active: false },
  });
}
