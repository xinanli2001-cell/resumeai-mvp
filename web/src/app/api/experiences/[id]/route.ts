import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import {
  archiveExperience,
  ExperienceInputSchema,
  updateExperience,
} from "@/lib/experience/experience-service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Params) {
  const user = await requireUser();
  const parsed = ExperienceInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid experience input" }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    return NextResponse.json({ experience: await updateExperience(user.id, id, parsed.data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Params) {
  const user = await requireUser();
  try {
    const { id } = await context.params;
    return NextResponse.json({ experience: await archiveExperience(user.id, id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Archive failed" }, { status: 404 });
  }
}
