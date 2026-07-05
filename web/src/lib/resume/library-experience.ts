import type { ResumeContent, ResumeSection } from "@/lib/resume/resume-content";

export type LibraryExperienceForResume = {
  id: string;
  type: string;
  title: string;
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  rawText?: string;
};

const sectionTitles: Record<ResumeSection["type"], string> = {
  SUMMARY: "个人简介",
  EDUCATION: "教育经历",
  PROJECT: "项目经历",
  INTERNSHIP: "实习经历",
  WORK: "工作经历",
  SKILL: "职业能力",
  CUSTOM: "自定义",
};

export function sectionTypeForExperience(type: string): ResumeSection["type"] {
  if (type === "PROJECT" || type === "INTERNSHIP" || type === "WORK" || type === "EDUCATION" || type === "SKILL") {
    return type;
  }
  return "CUSTOM";
}

function joinParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

function dateRange(experience: LibraryExperienceForResume) {
  return [experience.startDate, experience.endDate]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" - ");
}

export function resumeItemFromLibraryExperience(experience: LibraryExperienceForResume) {
  return {
    id: `library-${experience.id}`,
    heading: experience.title.trim(),
    subheading: joinParts([experience.organization, experience.role]),
    dateRange: dateRange(experience),
    body: experience.rawText?.trim() ?? "",
    sourceExperienceId: experience.id,
  };
}

export function appendLibraryExperience(content: ResumeContent, experience: LibraryExperienceForResume) {
  const sectionType = sectionTypeForExperience(experience.type);
  const alreadyAdded = content.sections.some((section) =>
    section.items.some((item) => item.sourceExperienceId === experience.id),
  );
  if (alreadyAdded) return { content, added: false, sectionType };

  const item = resumeItemFromLibraryExperience(experience);
  const sectionIndex = content.sections.findIndex((section) => section.type === sectionType);
  if (sectionIndex === -1) {
    return {
      added: true,
      sectionType,
      content: {
        ...content,
        sections: [
          ...content.sections,
          {
            id: `section-${sectionType.toLowerCase()}`,
            type: sectionType,
            title: sectionTitles[sectionType],
            visible: true,
            items: [item],
          },
        ],
      },
    };
  }

  return {
    added: true,
    sectionType,
    content: {
      ...content,
      sections: content.sections.map((section, index) =>
        index === sectionIndex ? { ...section, visible: true, items: [...section.items, item] } : section,
      ),
    },
  };
}
