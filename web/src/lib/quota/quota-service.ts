import { db } from "@/lib/db";

export async function assertCanConsume(userId: string, costUnits: number) {
  if (costUnits < 1) throw new Error("costUnits must be positive");

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "ADMIN") return;
  if (user.quotaUsed + costUnits > user.quotaLimit) throw new Error("Quota exceeded");
}

export async function recordUsage(input: {
  userId: string;
  actionType: string;
  costUnits: number;
  status: "SUCCESS" | "FAILED";
  relatedObjectType?: string;
  relatedObjectId?: string;
}) {
  if (input.costUnits < 1) throw new Error("costUnits must be positive");

  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
  const log = await db.usageLog.create({
    data: {
      userId: input.userId,
      actionType: input.actionType,
      relatedObjectType: input.relatedObjectType ?? "",
      relatedObjectId: input.relatedObjectId ?? "",
      costUnits: input.costUnits,
      status: input.status,
    },
  });

  if (input.status === "SUCCESS" && user.role !== "ADMIN") {
    await db.user.update({
      where: { id: input.userId },
      data: { quotaUsed: { increment: input.costUnits } },
    });
  }

  return log;
}
