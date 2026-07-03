import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getProvider } from "@/lib/llm/provider";
import { createRewriteSession } from "@/lib/rewrite/rewrite-service";

const RewriteRequestSchema = z.object({
  jdId: z.string().min(1),
  selectedExperienceIds: z.array(z.string().min(1)).min(1),
  mode: z.enum(["DEFAULT", "PACKAGING"]),
  languageMode: z.enum(["ZH", "EN", "BILINGUAL"]),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = RewriteRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rewrite input" }, { status: 400 });
  }

  try {
    const result = await createRewriteSession(user.id, parsed.data, getProvider());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rewrite failed";
    return NextResponse.json({ error: message }, { status: message === "Quota exceeded" ? 402 : 400 });
  }
}
