import type {
  ImportResult,
  JdParseResult,
  LLMProvider,
  RewriteRequest,
  RewriteResult,
} from "./types";

function words(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9一-鿿+#.]+/i)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2),
    ),
  );
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock" as const;

  async extractStructuredExperience(rawText: string): Promise<ImportResult> {
    const firstLine =
      rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? "Imported Experience";
    const skills = words(rawText).slice(0, 5);

    return {
      experiences: [
        {
          type: "PROJECT",
          title: firstLine.slice(0, 80),
          organization: "",
          role: "",
          startDate: "",
          endDate: "",
          summary: rawText.trim().slice(0, 280),
          responsibilities: [],
          achievements: [],
          skills,
          tags: skills.slice(0, 2),
          pendingClaims: ["organization", "startDate", "endDate"],
        },
      ],
    };
  }

  async parseJobDescription(rawText: string): Promise<JdParseResult> {
    const tokens = words(rawText);

    return {
      title: rawText.split(/\r?\n/)[0]?.trim().slice(0, 80) ?? "",
      company: "",
      language: /[一-鿿]/.test(rawText) ? "zh" : "en",
      requirements: rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 8),
      skills: tokens.slice(0, 8),
      keywords: tokens.slice(0, 12),
    };
  }

  async rewriteExperience(request: RewriteRequest): Promise<RewriteResult> {
    const { experience, languageMode, mode } = request;
    const tag = mode === "PACKAGING" ? "[packaged]" : "[default]";
    const zhResult = experience.metrics.length > 0 ? experience.metrics.join("、") : "量化影响待确认";
    const enResult = experience.metrics.length > 0 ? experience.metrics.join(", ") : "quantified impact requires confirmation";
    const zh = `${tag} 情境：${experience.title}。行动：基于 ${
      experience.skills.join("、") || "相关技能"
    } 推进工作。结果：${zhResult}。`;
    const en = `${tag} Situation: ${experience.title}. Action: drove the work using ${
      experience.skills.join(", ") || "relevant skills"
    }. Result: ${enResult}.`;

    const rewrittenText =
      languageMode === "ZH" ? zh : languageMode === "EN" ? en : `${zh}\n\n${en}`;

    return {
      rewrittenText,
      pendingClaims: experience.metrics.length === 0 ? ["quantified impact"] : [],
    };
  }
}
