import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { ResumeContentSchema } from "@/lib/resume/resume-content";
import { getResume, updateResume } from "@/lib/resume/resume-service";

type Params = { params: Promise<{ id: string }> };

const UpdateResumeSchema = z.object({
  content: ResumeContentSchema.optional(),
  templateId: z.string().min(1).nullable().optional(),
  title: z.string().optional(),
  status: z.enum(["DRAFT", "FINALIZED"]).optional(),
});

export async function GET(_request: Request, context: Params) {
  const user = await requireUser();
  try {
    const { id } = await context.params;
    return NextResponse.json({ resume: await getResume(user.id, id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resume not found" },
      { status: 404 },
    );
  }
}

export async function PATCH(request: Request, context: Params) {
  const user = await requireUser();
  const parsed = UpdateResumeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resume update" }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const { templateId, ...rest } = parsed.data;
    const resume = await updateResume(user.id, id, {
      ...rest,
      templateId: templateId === null ? "" : templateId,
    });
    return NextResponse.json({ resume });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resume update failed" },
      { status: 404 },
    );
  }
}
