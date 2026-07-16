import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";

const invitationCodeGenerationAttempts = 5;

export type CreateInvitationCodeInput = {
  label: string;
  maxUses: number;
  bonusQuota: number;
};

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
