import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { TemplateConfigSchema } from "@/lib/template/template-config";
import { listTemplates, saveAsMyTemplate } from "@/lib/template/template-service";

const SaveTemplateSchema = z.object({
  name: z.string().min(1),
  baseTemplateId: z.string().min(1).optional(),
  config: TemplateConfigSchema,
});

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ templates: await listTemplates(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = SaveTemplateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template input" }, { status: 400 });
  }

  try {
    const template = await saveAsMyTemplate(user.id, parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Template save failed" },
      { status: 404 },
    );
  }
}
