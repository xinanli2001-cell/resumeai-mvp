import { randomBytes } from "node:crypto";
import { db } from "../db";

export type CreateInvitationCodeInput = {
  label: string;
  maxUses: number;
  bonusQuota: number;
};

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

  return db.invitationCode.create({
    data: {
      code: randomBytes(6).toString("base64url").toUpperCase(),
      label,
      maxUses: input.maxUses,
      bonusQuota: input.bonusQuota,
    },
  });
}
