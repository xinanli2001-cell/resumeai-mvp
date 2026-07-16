import { describe, expect, it } from "vitest";
import {
  QualityPilotFixtureSchema,
  evaluateQualityPilot,
  renderQualityPilotReport,
} from "../../src/lib/quality-pilot";
import { assertRealQualityPilotConfig } from "../../src/lib/quality-pilot/run-config";
import { applyEnvFileDefaults } from "../../src/lib/quality-pilot/local-env";

const fixture = QualityPilotFixtureSchema.parse({
  version: 1,
  caseName: "de-identified software project",
  experience: {
    rawText:
      "Built Resume Match Assistant with Next.js and TypeScript. Added a PostgreSQL-backed profile workflow for university career coaching.",
    expected: {
      sourceTokens: ["resume match assistant", "next.js", "typescript"],
      skills: ["next.js", "typescript", "postgresql"],
      pendingClaims: ["startDate", "endDate"],
    },
  },
  jobDescription: {
    rawText:
      "Software Engineer role. Build React and TypeScript product features with PostgreSQL and collaborate with product partners.",
    expected: {
      skills: ["typescript", "postgresql"],
      keywords: ["react", "product"],
      language: "en",
    },
  },
  rewrite: {
    expected: {
      sourceTokens: ["resume match assistant", "typescript"],
      jdTerms: ["product", "postgresql"],
      prohibitedClaims: ["50% revenue growth"],
    },
  },
});

const importResult = {
  experiences: [
    {
      type: "PROJECT" as const,
      title: "Resume Match Assistant",
      organization: "University Career Lab",
      role: "Developer",
      startDate: "",
      endDate: "",
      summary: "Built a profile workflow.",
      responsibilities: ["Implemented matching flows."],
      achievements: [],
      skills: ["Next.js", "TypeScript", "PostgreSQL"],
      tags: [],
      pendingClaims: ["startDate", "endDate"],
    },
  ],
};

const jdResult = {
  title: "Software Engineer",
  company: "Example Co",
  language: "en" as const,
  requirements: ["Build product features."],
  skills: ["TypeScript", "PostgreSQL"],
  keywords: ["React", "product"],
};

describe("real AI quality pilot", () => {
  it("loads missing local configuration without replacing explicit runtime values", () => {
    const target: Record<string, string | undefined> = {
      LLM_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "runtime-secret",
    };

    applyEnvFileDefaults(
      "DATABASE_URL=file:./dev.db\nLLM_PROVIDER=mock\nDEEPSEEK_API_KEY=local-secret\n",
      target,
    );

    expect(target.DATABASE_URL).toBe("file:./dev.db");
    expect(target.LLM_PROVIDER).toBe("deepseek");
    expect(target.DEEPSEEK_API_KEY).toBe("runtime-secret");
  });

  it("rejects a quality pilot unless DeepSeek and a key are explicitly configured", () => {
    expect(() => assertRealQualityPilotConfig({ provider: "mock", hasApiKey: true })).toThrow(
      "LLM_PROVIDER=deepseek",
    );
    expect(() => assertRealQualityPilotConfig({ provider: "deepseek", hasApiKey: false })).toThrow(
      "DEEPSEEK_API_KEY",
    );
    expect(() => assertRealQualityPilotConfig({ provider: "deepseek", hasApiKey: true })).not.toThrow();
  });

  it("fails a rewrite that contains a prohibited unsupported claim", () => {
    const evaluation = evaluateQualityPilot({
      fixture,
      importResult,
      jdResult,
      rewriteResult: {
        rewrittenText:
          "Built Resume Match Assistant with TypeScript and PostgreSQL product workflows, delivering 50% revenue growth.",
        pendingClaims: [],
      },
    });

    expect(evaluation.checks).toContainEqual(
      expect.objectContaining({
        status: "fail",
        label: "unsupported claim: 50% revenue growth",
      }),
    );
  });

  it("keeps missing coverage as human-review warnings", () => {
    const evaluation = evaluateQualityPilot({
      fixture,
      importResult,
      jdResult,
      rewriteResult: {
        rewrittenText: "Built a matching tool.",
        pendingClaims: [],
      },
    });

    expect(evaluation.checks).toContainEqual(
      expect.objectContaining({ status: "warning", label: "rewrite source coverage: typescript" }),
    );
  });

  it("redacts API-like values from a rendered report", () => {
    const evaluation = evaluateQualityPilot({
      fixture,
      importResult,
      jdResult,
      rewriteResult: {
        rewrittenText: "Built Resume Match Assistant with TypeScript and PostgreSQL product workflows.",
        pendingClaims: [],
      },
    });

    const report = renderQualityPilotReport({
      generatedAt: "2026-07-16T00:00:00.000Z",
      providerName: "deepseek",
      model: "deepseek-chat",
      evaluation,
      outputs: {
        importResult,
        jdResult,
        rewriteResult: {
          rewrittenText: "Authorization: Bearer sk-secret-value-1234567890",
          pendingClaims: [],
        },
      },
    });

    expect(report).not.toContain("sk-secret-value-1234567890");
    expect(report).toContain("[REDACTED]");
  });
});
