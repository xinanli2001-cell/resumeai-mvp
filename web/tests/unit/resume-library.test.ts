import { describe, expect, it } from "vitest";
import {
  appendLibraryExperience,
  resumeItemFromLibraryExperience,
  sectionTypeForExperience,
} from "../../src/lib/resume/library-experience";
import type { ResumeContent } from "../../src/lib/resume/resume-content";

const baseContent: ResumeContent = {
  header: { name: "", targetTitle: "", location: "", phone: "", email: "", linkedin: "", github: "", website: "" },
  sections: [{ id: "section-project", type: "PROJECT", title: "项目经历", visible: true, items: [] }],
};

const experience = {
  id: "exp-1",
  type: "PROJECT",
  title: "Recommendation System",
  organization: "UNSW",
  role: "Developer",
  startDate: "2025-01",
  endDate: "2025-03",
  rawText: "Built a recommendation prototype with ranking metrics.",
};

describe("library experience resume conversion", () => {
  it("maps known experience types to resume section types", () => {
    expect(sectionTypeForExperience("PROJECT")).toBe("PROJECT");
    expect(sectionTypeForExperience("INTERNSHIP")).toBe("INTERNSHIP");
    expect(sectionTypeForExperience("WORK")).toBe("WORK");
    expect(sectionTypeForExperience("EDUCATION")).toBe("EDUCATION");
    expect(sectionTypeForExperience("SKILL")).toBe("SKILL");
    expect(sectionTypeForExperience("OTHER")).toBe("CUSTOM");
  });

  it("converts one library experience into a resume item with provenance", () => {
    expect(resumeItemFromLibraryExperience(experience)).toEqual({
      id: "library-exp-1",
      heading: "Recommendation System",
      subheading: "UNSW · Developer",
      dateRange: "2025-01 - 2025-03",
      body: "Built a recommendation prototype with ranking metrics.",
      sourceExperienceId: "exp-1",
    });
  });

  it("appends to the matching section and prevents duplicate additions", () => {
    const first = appendLibraryExperience(baseContent, experience);
    expect(first.added).toBe(true);
    expect(first.content.sections[0].items).toHaveLength(1);
    expect(first.content.sections[0].items[0]?.sourceExperienceId).toBe("exp-1");

    const second = appendLibraryExperience(first.content, experience);
    expect(second.added).toBe(false);
    expect(second.content.sections[0].items).toHaveLength(1);
  });

  it("creates the section when the resume does not have that type yet", () => {
    const result = appendLibraryExperience({ ...baseContent, sections: [] }, experience);
    expect(result.added).toBe(true);
    expect(result.content.sections[0]).toMatchObject({ type: "PROJECT", title: "项目经历", visible: true });
  });
});
