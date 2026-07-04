import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { sessionCookieName } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/privacy/privacy-service";

export async function DELETE() {
  const user = await requireUser();
  await deleteAccount(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName());
  return response;
}
