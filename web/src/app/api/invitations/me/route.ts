import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET() {
  const current = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: current.id },
    select: {
      quotaLimit: true,
      quotaUsed: true,
      invitationRedemptions: {
        orderBy: { redeemedAt: "desc" },
        select: { bonusQuota: true, redeemedAt: true },
      },
    },
  });

  return NextResponse.json({
    quotaLimit: user.quotaLimit,
    quotaUsed: user.quotaUsed,
    remaining: user.quotaLimit - user.quotaUsed,
    redemptions: user.invitationRedemptions,
  });
}
