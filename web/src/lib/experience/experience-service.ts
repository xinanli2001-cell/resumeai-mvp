import { ExperienceStatus, ExperienceType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const ExperienceInputSchema = z.object({
  type: z.nativeEnum(ExperienceType),
  title: z.string().min(1),
  organization: z.string().default(""),
  role: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  rawText: z.string().default(""),
  structuredFields: z.record(z.string(), z.unknown()).default({}),
  skills: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
});

export type ExperienceInput = z.input<typeof ExperienceInputSchema>;

export function normalizeExperienceInput(input: ExperienceInput) {
  const parsed = ExperienceInputSchema.parse(input);
  return {
    ...parsed,
    title: parsed.title.trim(),
    organization: parsed.organization.trim(),
    role: parsed.role.trim(),
    rawText: parsed.rawText.trim(),
    structuredFields: parsed.structuredFields as Prisma.InputJsonObject,
    skills: parsed.skills.map((item) => item.trim()).filter(Boolean) as Prisma.InputJsonArray,
    tags: parsed.tags.map((item) => item.trim()).filter(Boolean) as Prisma.InputJsonArray,
    metrics: parsed.metrics.map((item) => item.trim()).filter(Boolean) as Prisma.InputJsonArray,
    status: ExperienceStatus.ACTIVE,
  };
}

export async function listExperiences(userId: string) {
  return db.experience.findMany({
    where: { userId, status: ExperienceStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createExperience(userId: string, input: ExperienceInput) {
  return db.experience.create({ data: { userId, ...normalizeExperienceInput(input) } });
}

export async function updateExperience(userId: string, id: string, input: ExperienceInput) {
  const result = await db.experience.updateMany({
    where: { id, userId },
    data: normalizeExperienceInput(input),
  });
  if (result.count === 0) throw new Error("Experience not found");
  return db.experience.findFirstOrThrow({ where: { id, userId } });
}

export async function archiveExperience(userId: string, id: string) {
  const result = await db.experience.updateMany({
    where: { id, userId },
    data: { status: ExperienceStatus.ARCHIVED },
  });
  if (result.count === 0) throw new Error("Experience not found");
  return { id, status: ExperienceStatus.ARCHIVED };
}
