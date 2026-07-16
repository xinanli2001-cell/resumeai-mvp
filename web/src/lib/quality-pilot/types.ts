import { z } from "zod";

export const QualityPilotFixtureSchema = z.object({
  version: z.literal(1),
  caseName: z.string().min(1),
  experience: z.object({
    rawText: z.string().min(1),
    expected: z.object({
      sourceTokens: z.array(z.string().min(1)).min(1),
      skills: z.array(z.string().min(1)).min(1),
      pendingClaims: z.array(z.string().min(1)),
    }),
  }),
  jobDescription: z.object({
    rawText: z.string().min(1),
    expected: z.object({
      skills: z.array(z.string().min(1)).min(1),
      keywords: z.array(z.string().min(1)).min(1),
      language: z.enum(["zh", "en", "mixed"]),
    }),
  }),
  rewrite: z.object({
    expected: z.object({
      sourceTokens: z.array(z.string().min(1)).min(1),
      jdTerms: z.array(z.string().min(1)).min(1),
      prohibitedClaims: z.array(z.string().min(1)),
    }),
  }),
});

export type QualityPilotFixture = z.infer<typeof QualityPilotFixtureSchema>;

export type QualityPilotCheckStatus = "pass" | "warning" | "fail";

export type QualityPilotCheck = {
  section: "extraction" | "jd" | "rewrite";
  label: string;
  status: QualityPilotCheckStatus;
  detail: string;
};

export type QualityPilotEvaluation = {
  checks: QualityPilotCheck[];
  summary: Record<QualityPilotCheckStatus, number>;
};
