import { Prisma, RewriteDecision, RewriteSessionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { stringArray, jdParseFromRow } from "@/lib/jd/jd-service";
import type { LLMProvider, LanguageMode, RewriteMode } from "@/lib/llm/types";
import { scoreExperiences } from "@/lib/match/match-service";
import { assertCanConsume, recordUsage } from "@/lib/quota/quota-service";

export type RewriteSessionInput = {
  jdId: string;
  selectedExperienceIds: string[];
  mode: RewriteMode;
  languageMode: LanguageMode;
};

export type RewriteDecisionInput = {
  decision: "ACCEPTED" | "EDITED" | "REJECTED";
  userEditedText?: string;
};

function experienceSnapshot(experience: {
  id: string;
  type: string;
  title: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  rawText: string;
  skills: unknown;
  tags: unknown;
  metrics: unknown;
}) {
  return {
    id: experience.id,
    type: experience.type,
    title: experience.title,
    organization: experience.organization,
    role: experience.role,
    startDate: experience.startDate,
    endDate: experience.endDate,
    rawText: experience.rawText,
    skills: stringArray(experience.skills),
    tags: stringArray(experience.tags),
    metrics: stringArray(experience.metrics),
  };
}

async function ownedSessionBlock(userId: string, blockId: string) {
  return db.rewrittenExperience.findFirst({
    where: {
      id: blockId,
      session: { userId },
    },
  });
}

export async function createRewriteSession(
  userId: string,
  input: RewriteSessionInput,
  provider: LLMProvider,
) {
  const selectedIds = Array.from(new Set(input.selectedExperienceIds.filter(Boolean)));
  if (selectedIds.length === 0) throw new Error("At least one experience is required");

  const jd = await db.jobDescription.findFirst({ where: { id: input.jdId, userId } });
  if (!jd) throw new Error("Job description not found");

  const experiences = await db.experience.findMany({
    where: { id: { in: selectedIds }, userId, status: "ACTIVE" },
  });
  if (experiences.length !== selectedIds.length) throw new Error("Experience not found");

  await assertCanConsume(userId, selectedIds.length);

  const session = await db.rewriteSession.create({
    data: {
      userId,
      jdId: jd.id,
      selectedExperienceIds: selectedIds as Prisma.InputJsonArray,
      mode: input.mode,
      languageMode: input.languageMode,
      status: RewriteSessionStatus.DRAFT,
    },
  });

  const jdParsed = jdParseFromRow(jd);
  const matches = scoreExperiences(
    jdParsed,
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
  const matchesById = new Map(matches.map((match) => [match.experience.id, match]));

  for (const experience of experiences) {
    const snapshot = experienceSnapshot(experience);
    const match = matchesById.get(experience.id);
    const block = await db.rewrittenExperience.create({
      data: {
        sessionId: session.id,
        sourceExperienceId: experience.id,
        originalSnapshot: snapshot as Prisma.InputJsonObject,
        matchReason: match?.matchReason ?? "No direct JD skill or keyword overlap.",
        matchScore: match?.matchScore ?? 0,
        pendingClaims: [] as Prisma.InputJsonArray,
      },
    });

    try {
      const rewritten = await provider.rewriteExperience({
        experience: {
          type: snapshot.type,
          title: snapshot.title,
          organization: snapshot.organization,
          role: snapshot.role,
          rawText: snapshot.rawText,
          skills: snapshot.skills,
          tags: snapshot.tags,
          metrics: snapshot.metrics,
        },
        jd: jdParsed,
        mode: input.mode,
        languageMode: input.languageMode,
      });
      await db.rewrittenExperience.update({
        where: { id: block.id },
        data: {
          rewrittenText: rewritten.rewrittenText,
          pendingClaims: rewritten.pendingClaims as Prisma.InputJsonArray,
        },
      });
      await recordUsage({
        userId,
        actionType: "rewrite",
        costUnits: 1,
        status: "SUCCESS",
        relatedObjectType: "RewrittenExperience",
        relatedObjectId: block.id,
      });
    } catch (error) {
      await db.rewrittenExperience.update({
        where: { id: block.id },
        data: {
          pendingClaims: ["rewrite_failed"] as Prisma.InputJsonArray,
          rewrittenText: "",
        },
      });
      await recordUsage({
        userId,
        actionType: "rewrite",
        costUnits: 1,
        status: "FAILED",
        relatedObjectType: "RewrittenExperience",
        relatedObjectId: block.id,
      });
    }
  }

  await db.rewriteSession.update({
    where: { id: session.id },
    data: { status: RewriteSessionStatus.READY },
  });

  return { sessionId: session.id };
}

export async function getRewriteSession(userId: string, sessionId: string) {
  const session = await db.rewriteSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      jd: true,
      rewrittenExperiences: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) throw new Error("Rewrite session not found");

  return {
    id: session.id,
    mode: session.mode,
    languageMode: session.languageMode,
    status: session.status,
    canProceed: await canProceed(userId, session.id),
    jd: {
      id: session.jd.id,
      rawText: session.jd.rawText,
      ...jdParseFromRow(session.jd),
    },
    blocks: session.rewrittenExperiences,
  };
}

export async function recordDecision(userId: string, blockId: string, input: RewriteDecisionInput) {
  const block = await ownedSessionBlock(userId, blockId);
  if (!block) throw new Error("Rewritten experience not found");
  if (input.decision === "EDITED" && !input.userEditedText?.trim()) {
    throw new Error("userEditedText is required for edited decisions");
  }

  return db.rewrittenExperience.update({
    where: { id: block.id },
    data: {
      decision: input.decision as RewriteDecision,
      userEditedText: input.decision === "EDITED" ? input.userEditedText?.trim() ?? "" : "",
    },
  });
}

export async function canProceed(userId: string, sessionId: string) {
  const count = await db.rewrittenExperience.count({
    where: {
      sessionId,
      session: { userId },
      decision: { in: [RewriteDecision.ACCEPTED, RewriteDecision.EDITED] },
    },
  });
  return count > 0;
}
