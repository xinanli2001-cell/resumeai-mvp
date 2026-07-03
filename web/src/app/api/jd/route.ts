import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { parseAndSaveJd } from "@/lib/jd/jd-service";
import { getProvider } from "@/lib/llm/provider";
import { assertCanConsume, recordUsage } from "@/lib/quota/quota-service";

const JdRequestSchema = z.object({
  rawText: z.string().min(1),
});

export async function GET() {
  const user = await requireUser();
  const jobDescriptions = await db.jobDescription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ jobDescriptions });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = JdRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid JD input" }, { status: 400 });
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
    const jobDescription = await parseAndSaveJd(user.id, parsed.data.rawText, getProvider());
    await recordUsage({ userId: user.id, actionType: "jd_parse", costUnits: 1, status: "SUCCESS" });
    return NextResponse.json({ jobDescription }, { status: 201 });
  } catch (error) {
    await recordUsage({ userId: user.id, actionType: "jd_parse", costUnits: 1, status: "FAILED" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "JD parse failed" },
      { status: 502 },
    );
  }
}
