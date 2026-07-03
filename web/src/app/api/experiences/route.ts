import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import {
  createExperience,
  ExperienceInputSchema,
  listExperiences,
} from "@/lib/experience/experience-service";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ experiences: await listExperiences(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = ExperienceInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid experience input" }, { status: 400 });
  }

  return NextResponse.json({ experience: await createExperience(user.id, parsed.data) }, { status: 201 });
}
