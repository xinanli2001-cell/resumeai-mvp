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

export type CreateUserWithInvitationInput = {
  email: string;
  passwordHash: string;
  rawCode?: string;
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

async function reserveInvitation(
  tx: Prisma.TransactionClient,
  input: { code: string; userId?: string },
) {
  const invitation = await tx.invitationCode.findUnique({ where: { code: input.code } });
  if (!invitation) throw new InvitationError("INVALID_CODE");

  if (input.userId) {
    const priorRedemption = await findRedemption(tx, invitation.id, input.userId);
    if (priorRedemption) throw new InvitationError("ALREADY_REDEEMED");
  }

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
  if (reserved.count !== 1) {
    if (input.userId && (await findRedemption(tx, invitation.id, input.userId))) {
      throw new InvitationError("ALREADY_REDEEMED");
    }
    throw new InvitationError("UNAVAILABLE");
  }

  return invitation;
}

function findRedemption(
  tx: Prisma.TransactionClient,
  invitationCodeId: string,
  userId: string,
) {
  return tx.invitationRedemption.findUnique({
    where: { invitationCodeId_userId: { invitationCodeId, userId } },
    select: { id: true },
  });
}

async function grantInvitation(
  tx: Prisma.TransactionClient,
  input: { invitationCodeId: string; userId: string; bonusQuota: number },
) {
  await tx.invitationRedemption.create({
    data: {
      invitationCodeId: input.invitationCodeId,
      userId: input.userId,
      bonusQuota: input.bonusQuota,
    },
  });
  return tx.user.update({
    where: { id: input.userId },
    data: { quotaLimit: { increment: input.bonusQuota } },
    select: { quotaLimit: true, quotaUsed: true },
  });
}

export async function createUserWithInvitation(input: CreateUserWithInvitationInput) {
  const code = normalizeInvitationCode(input.rawCode ?? "");

  return db.$transaction(async (tx) => {
    const invitation = code ? await reserveInvitation(tx, { code }) : null;
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        profile: { create: { contactEmail: input.email, languages: [] } },
      },
      select: { id: true, email: true },
    });

    if (invitation) {
      await grantInvitation(tx, {
        invitationCodeId: invitation.id,
        userId: user.id,
        bonusQuota: invitation.bonusQuota,
      });
    }

    return user;
  });
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

    const invitation = await reserveInvitation(tx, { code, userId: user.id });
    const updatedUser = await grantInvitation(tx, {
      invitationCodeId: invitation.id,
      userId: user.id,
      bonusQuota: invitation.bonusQuota,
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
