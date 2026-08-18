import { z } from "zod";

export const StructuredExperienceSchema = z.object({
  type: z.enum(["PROJECT", "INTERNSHIP", "WORK", "EDUCATION", "SKILL"]),
  title: z.string().default(""),
  organization: z.string().default(""),
  role: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  summary: z.string().default(""),
  responsibilities: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  pendingClaims: z.array(z.string()).default([]),
});
export type StructuredExperience = z.infer<typeof StructuredExperienceSchema>;

export const ImportResultSchema = z.object({
  experiences: z.array(StructuredExperienceSchema).default([]),
});
export type ImportResult = z.infer<typeof ImportResultSchema>;

export const JdParseResultSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  language: z.enum(["zh", "en", "mixed"]).default("mixed"),
  requirements: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});
export type JdParseResult = z.infer<typeof JdParseResultSchema>;

export const RewriteResultSchema = z.object({
  rewrittenText: z.string().default(""),
  pendingClaims: z.array(z.string()).default([]),
});
export type RewriteResult = z.infer<typeof RewriteResultSchema>;

export type RewriteMode = "DEFAULT" | "PACKAGING";
export type LanguageMode = "ZH" | "EN" | "BILINGUAL";

export type ResumeFileInput = {
  filename: string;
  mimeType: string;
  dataBase64: string;
};

export interface RewriteRequest {
  experience: {
    type: string;
    title: string;
    organization: string;
    role: string;
    rawText: string;
    skills: string[];
    tags: string[];
    metrics: string[];
  };
  jd: JdParseResult;
  mode: RewriteMode;
  languageMode: LanguageMode;
}

export interface LLMProvider {
  readonly name: "deepseek" | "mock" | "openai";
  extractStructuredExperience(rawText: string): Promise<ImportResult>;
  extractStructuredExperienceFromFile?(file: ResumeFileInput): Promise<ImportResult>;
  parseJobDescription(rawText: string): Promise<JdParseResult>;
  rewriteExperience(request: RewriteRequest): Promise<RewriteResult>;
}
