import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { JdParseResult, LLMProvider } from "@/lib/llm/types";

export async function parseAndSaveJd(userId: string, rawText: string, provider: LLMProvider) {
  const text = rawText.trim();
  if (!text) throw new Error("rawText is required");

  const parsed = await provider.parseJobDescription(text);
  return db.jobDescription.create({
    data: {
      userId,
      title: parsed.title,
      company: parsed.company,
      rawText: text,
      parsedRequirements: parsed.requirements as Prisma.InputJsonArray,
      parsedSkills: parsed.skills as Prisma.InputJsonArray,
      parsedKeywords: parsed.keywords as Prisma.InputJsonArray,
      language: parsed.language,
    },
  });
}

export function jdParseFromRow(row: {
  title: string;
  company: string;
  language: string;
  parsedRequirements: unknown;
  parsedSkills: unknown;
  parsedKeywords: unknown;
}): JdParseResult {
  return {
    title: row.title,
    company: row.company,
    language: row.language === "zh" || row.language === "en" || row.language === "mixed" ? row.language : "mixed",
    requirements: stringArray(row.parsedRequirements),
    skills: stringArray(row.parsedSkills),
    keywords: stringArray(row.parsedKeywords),
  };
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
