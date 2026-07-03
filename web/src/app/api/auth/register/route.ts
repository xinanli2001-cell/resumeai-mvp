import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const parsed = RegisterSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(parsed.data.password),
      profile: { create: { contactEmail: email, languages: [] } },
    },
    select: { id: true, email: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
