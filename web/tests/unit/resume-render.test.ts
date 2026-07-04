import { describe, expect, it } from "vitest";
import { headingClass, orderedSectionsForRender } from "../../src/lib/resume/render";
import type { ResumeContent } from "../../src/lib/resume/resume-content";

const content: ResumeContent = {
  header: {
    name: "A",
    targetTitle: "",
    location: "",
    phone: "",
    email: "",
    linkedin: "",
    github: "",
    website: "",
  },
  sections: [
    { id: "s1", type: "PROJECT", title: "项目", visible: true, items: [] },
    { id: "s2", type: "EDUCATION", title: "教育", visible: true, items: [] },
    { id: "s3", type: "SKILL", title: "技能", visible: false, items: [] },
    { id: "s4", type: "CUSTOM", title: "其他", visible: true, items: [] },
  ],
};

describe("orderedSectionsForRender", () => {
  it("orders by config.sectionOrder and drops hidden sections", () => {
    const ordered = orderedSectionsForRender(content, { sectionOrder: ["EDUCATION", "PROJECT"] });
    expect(ordered.map((section) => section.type)).toEqual(["EDUCATION", "PROJECT", "CUSTOM"]);
  });

  it("preserves original order when no sectionOrder is configured", () => {
    const ordered = orderedSectionsForRender(content, { sectionOrder: [] });
    expect(ordered.map((section) => section.id)).toEqual(["s1", "s2", "s4"]);
  });
});

describe("headingClass", () => {
  it("reflects heading style and uppercase", () => {
    expect(headingClass({ heading: { style: "underline", uppercase: true } })).toBe(
      "heading-underline uppercase",
    );
    expect(headingClass({ heading: { style: "bar", uppercase: false } })).toBe("heading-bar");
    expect(headingClass({ heading: { style: "plain", uppercase: false } })).toBe("heading-plain");
  });
});
