import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/lib/config/env";
import {
  createUserWithInvitation,
  InvitationError,
  normalizeInvitationCode,
} from "@/lib/invitations/service";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  invitationCode: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid registration input" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const invitationCode = normalizeInvitationCode(parsed.data.invitationCode ?? "");
  if (env().REGISTRATION_MODE === "invite_only" && !invitationCode) {
    return NextResponse.json({ error: "邀请码为必填项" }, { status: 403 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  try {
    const user = await createUserWithInvitation({
      email,
      passwordHash: await hashPassword(parsed.data.password),
      rawCode: invitationCode || undefined,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ error: "邀请码无效或不可用" }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    throw error;
  }
}
