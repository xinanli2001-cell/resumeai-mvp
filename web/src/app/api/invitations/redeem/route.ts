import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { InvitationError, redeemInvitationCode } from "@/lib/invitations/service";

const RedeemInvitationSchema = z.object({
  code: z.string().min(1).max(80),
});

export async function POST(request: Request) {
  const user = await requireUser();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请输入有效邀请码" }, { status: 400 });
  }

  const parsed = RedeemInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入有效邀请码" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await redeemInvitationCode({ userId: user.id, rawCode: parsed.data.code }),
    );
  } catch (error) {
    if (error instanceof InvitationError && error.code === "ALREADY_REDEEMED") {
      return NextResponse.json({ error: "该邀请码已兑换" }, { status: 409 });
    }
    if (error instanceof InvitationError) {
      return NextResponse.json({ error: "邀请码无效或不可用" }, { status: 400 });
    }
    throw error;
  }
}
