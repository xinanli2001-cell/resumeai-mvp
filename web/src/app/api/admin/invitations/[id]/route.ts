import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { setInvitationCodeActive } from "@/lib/invitations/service";

const UpdateInvitationSchema = z.object({ active: z.boolean() }).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const body = await request.json().catch(() => null);
  const parsed = UpdateInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation update" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const invitation = await setInvitationCodeActive(id, parsed.data.active);
    return NextResponse.json({ invitation });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Invitation code not found" }, { status: 404 });
    }
    throw error;
  }
}
