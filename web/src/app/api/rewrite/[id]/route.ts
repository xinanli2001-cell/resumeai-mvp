import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getRewriteSession, recordDecision } from "@/lib/rewrite/rewrite-service";

type Params = { params: Promise<{ id: string }> };

const DecisionSchema = z.object({
  blockId: z.string().min(1),
  decision: z.enum(["ACCEPTED", "EDITED", "REJECTED"]),
  userEditedText: z.string().optional(),
});

export async function GET(_request: Request, context: Params) {
  const user = await requireUser();
  try {
    const { id } = await context.params;
    return NextResponse.json({ session: await getRewriteSession(user.id, id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rewrite session not found" },
      { status: 404 },
    );
  }
}

export async function PATCH(request: Request, context: Params) {
  const user = await requireUser();
  const parsed = DecisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision input" }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    return NextResponse.json({ block: await recordDecision(user.id, id, parsed.data.blockId, parsed.data) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Decision update failed" },
      { status: 404 },
    );
  }
}
