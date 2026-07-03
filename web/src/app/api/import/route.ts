import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { breakdownFreeText } from "@/lib/import/import-service";
import { getProvider } from "@/lib/llm/provider";
import { assertCanConsume, recordUsage } from "@/lib/quota/quota-service";

const ImportRequestSchema = z.object({
  rawText: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = ImportRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import input" }, { status: 400 });
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
