import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "ADMIN"]),
  quotaLimit: z.number().int().min(0),
});

export async function GET() {
  await requireAdmin();
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      quotaLimit: true,
      quotaUsed: true,
      createdAt: true,
      usageLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          actionType: true,
          costUnits: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  await requireAdmin();
  const parsed = UpdateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid admin user input" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: parsed.data.userId },
    data: {
      role: parsed.data.role,
      quotaLimit: parsed.data.role === "ADMIN" ? 999999 : parsed.data.quotaLimit,
    },
    select: { id: true, email: true, role: true, quotaLimit: true, quotaUsed: true, createdAt: true },
  });

  return NextResponse.json({ user });
}
