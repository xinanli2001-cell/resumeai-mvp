import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { env } from "@/lib/config/env";
import { breakdownFreeText } from "@/lib/import/import-service";
import { getProvider } from "@/lib/llm/provider";
import { assertCanConsume, recordUsage } from "@/lib/quota/quota-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

const ImportRequestSchema = z.object({
  rawText: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const config = env();
  const limit = checkRateLimit(`${user.id}:import`, config.LLM_RATE_LIMIT_PER_MINUTE);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const parsed = ImportRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import input" }, { status: 400 });
  }
  if (new TextEncoder().encode(parsed.data.rawText).length > config.MAX_TEXT_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    await assertCanConsume(user.id, 1);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quota exceeded" },
      { status: 402 },
    );
  }

  try {
    const draft = await breakdownFreeText(parsed.data.rawText, getProvider());
    await recordUsage({ userId: user.id, actionType: "import", costUnits: 1, status: "SUCCESS" });
    return NextResponse.json({ draft });
  } catch (error) {
    await recordUsage({ userId: user.id, actionType: "import", costUnits: 1, status: "FAILED" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 502 },
    );
  }
}
