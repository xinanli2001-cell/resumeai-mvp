import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createResumeFromSession, listResumes } from "@/lib/resume/resume-service";

const CreateResumeSchema = z.object({
  sessionId: z.string().min(1),
  templateId: z.string().min(1).optional(),
  title: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ resumes: await listResumes(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = CreateResumeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resume input" }, { status: 400 });
  }

  try {
    const result = await createResumeFromSession(user.id, parsed.data.sessionId, {
      templateId: parsed.data.templateId,
      title: parsed.data.title,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume creation failed";
    return NextResponse.json(
      { error: message },
      { status: message === "No confirmed experience" ? 409 : 404 },
    );
  }
}
