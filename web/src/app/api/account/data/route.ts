import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { deleteUserData } from "@/lib/privacy/privacy-service";

export async function DELETE() {
  const user = await requireUser();
  const result = await deleteUserData(user.id);
  return NextResponse.json(result);
}
