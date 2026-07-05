import { describe, expect, it } from "vitest";
import { analyzeResumeFit } from "../../src/lib/resume/fit-advisor";
import type { ResumeContent } from "../../src/lib/resume/resume-content";
import type { TemplateConfig } from "../../src/lib/template/template-config";

function contentWithBody(body: string): ResumeContent {
  return {
    header: { name: "A", targetTitle: "Engineer", location: "", phone: "", email: "", linkedin: "", github: "", website: "" },
    sections: [
      {
        id: "s1",
        type: "PROJECT",
        title: "项目经历",
        visible: true,
        items: [{ id: "i1", heading: "Project", subheading: "", dateRange: "", body }],
      },
    ],
  };
}

const config: Pick<TemplateConfig, "font" | "spacing"> = {
  font: { family: "system-ui", sizePt: 11 },
  spacing: { sectionGap: 16, lineHeight: 1.4 },
};

describe("analyzeResumeFit", () => {
  it("returns fits for compact resumes", () => {
    const result = analyzeResumeFit(contentWithBody("Short impact statement."), config);
    expect(result.status).toBe("fits");
    expect(result.message).toBe("预计适合一页");
  });

  it("returns overflow with concrete suggestions for long resumes", () => {
    const result = analyzeResumeFit(contentWithBody("Long ".repeat(220)), config);
    expect(result.status).toBe("overflow");
    expect(result.suggestions.join(" ")).toContain("隐藏或缩短");
  });
});
