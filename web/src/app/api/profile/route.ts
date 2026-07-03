import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getProfile, ProfileInputSchema, updateProfile } from "@/lib/profile/profile-service";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ profile: await getProfile(user.id) });
}

export async function PUT(request: Request) {
  const user = await requireUser();
  const parsed = ProfileInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile input" }, { status: 400 });
  }

  return NextResponse.json({ profile: await updateProfile(user.id, parsed.data) });
}
