import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { env } from "@/lib/config/env";
import { getProvider } from "@/lib/llm/provider";
import { createRewriteSession } from "@/lib/rewrite/rewrite-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

const RewriteRequestSchema = z.object({
  jdId: z.string().min(1),
  selectedExperienceIds: z.array(z.string().min(1)).min(1),
  mode: z.enum(["DEFAULT", "PACKAGING"]),
  languageMode: z.enum(["ZH", "EN", "BILINGUAL"]),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const config = env();
  const limit = checkRateLimit(`${user.id}:rewrite`, config.LLM_RATE_LIMIT_PER_MINUTE);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

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
