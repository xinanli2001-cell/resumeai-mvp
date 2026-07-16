import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  createInvitationCode,
  InvitationCodeCreationError,
} from "@/lib/invitations/service";

const CreateInvitationSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    maxUses: z.number().int().positive().max(100_000),
    bonusQuota: z.number().int().positive().max(100_000),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiration must be in the future",
      });
    }
  });

const invitationSelection = {
  id: true,
  code: true,
  label: true,
  maxUses: true,
  usedCount: true,
  bonusQuota: true,
  active: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  redemptions: {
    orderBy: { redeemedAt: "desc" as const },
    take: 5,
    select: {
      bonusQuota: true,
      redeemedAt: true,
      user: { select: { email: true } },
    },
  },
};

export async function GET() {
  await requireAdmin();
  const invitations = await db.invitationCode.findMany({
    orderBy: { createdAt: "desc" },
    select: invitationSelection,
  });
  return NextResponse.json({ invitations });
}

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null);
  const parsed = CreateInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation input" }, { status: 400 });
  }

  try {
    const invitation = await createInvitationCode({
      label: parsed.data.label,
      maxUses: parsed.data.maxUses,
      bonusQuota: parsed.data.bonusQuota,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    if (error instanceof InvitationCodeCreationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
