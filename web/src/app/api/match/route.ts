import { ExperienceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { jdParseFromRow, stringArray } from "@/lib/jd/jd-service";
import { scoreExperiences } from "@/lib/match/match-service";

const MatchRequestSchema = z.object({
  jdId: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = MatchRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid match input" }, { status: 400 });
  }

  const jd = await db.jobDescription.findFirst({ where: { id: parsed.data.jdId, userId: user.id } });
  if (!jd) {
    return NextResponse.json({ error: "Job description not found" }, { status: 404 });
  }

  const experiences = await db.experience.findMany({
    where: { userId: user.id, status: ExperienceStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
  });

  const matches = scoreExperiences(
    jdParseFromRow(jd),
    experiences.map((experience) => ({
      id: experience.id,
      title: experience.title,
      organization: experience.organization,
      role: experience.role,
      rawText: experience.rawText,
      skills: stringArray(experience.skills),
      tags: stringArray(experience.tags),
    })),
  );

  return NextResponse.json({ matches });
}
