import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "../../src/lib/llm/mock";

const provider = new MockLLMProvider();

describe("MockLLMProvider", () => {
  it("is deterministic for the same input", async () => {
    const a = await provider.extractStructuredExperience("Built an NLP pipeline with BERT.");
    const b = await provider.extractStructuredExperience("Built an NLP pipeline with BERT.");

    expect(a).toEqual(b);
  });

  it("marks unknown fields as pending claims, never fabricating them", async () => {
    const result = await provider.extractStructuredExperience("Sentiment analysis project");

    expect(result.experiences[0].pendingClaims).toContain("organization");
  });

  it("honors language mode in rewrite output", async () => {
    const base = {
      experience: {
        type: "PROJECT",
        title: "ABSA",
        organization: "",
        role: "",
        rawText: "x",
        skills: ["Python"],
        tags: [],
        metrics: [],
      },
      jd: {
        title: "",
        company: "",
        language: "en" as const,
        requirements: [],
        skills: [],
        keywords: [],
      },
      mode: "DEFAULT" as const,
    };

    const zh = await provider.rewriteExperience({ ...base, languageMode: "ZH" });
    const en = await provider.rewriteExperience({ ...base, languageMode: "EN" });
    const bi = await provider.rewriteExperience({ ...base, languageMode: "BILINGUAL" });

    expect(zh.rewrittenText).toMatch(/情境/);
    expect(en.rewrittenText).toMatch(/Situation/);
    expect(bi.rewrittenText).toMatch(/情境/);
    expect(bi.rewrittenText).toMatch(/Situation/);
  });

  it("labels packaging output distinctly", async () => {
    const req = {
      experience: {
        type: "PROJECT",
        title: "ABSA",
        organization: "",
        role: "",
        rawText: "x",
        skills: [],
        tags: [],
        metrics: [],
      },
      jd: {
        title: "",
        company: "",
        language: "en" as const,
        requirements: [],
        skills: [],
        keywords: [],
      },
      languageMode: "EN" as const,
    };

    const def = await provider.rewriteExperience({ ...req, mode: "DEFAULT" });
    const pkg = await provider.rewriteExperience({ ...req, mode: "PACKAGING" });

    expect(def.rewrittenText).toContain("[default]");
    expect(pkg.rewrittenText).toContain("[packaged]");
  });
});
