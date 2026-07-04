import type { ResumeContent, ResumeSection } from "@/lib/resume/resume-content";
import type { TemplateConfig } from "@/lib/template/template-config";

export function orderedSectionsForRender(
  content: ResumeContent,
  config: Pick<TemplateConfig, "sectionOrder">,
): ResumeSection[] {
  const visible = content.sections.filter((section) => section.visible);
  const order = config.sectionOrder.length ? config.sectionOrder : visible.map((section) => section.type);
  return [...visible].sort((a, b) => {
    const aIndex = order.indexOf(a.type);
    const bIndex = order.indexOf(b.type);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

export function orderedSectionsForControls(
  content: ResumeContent,
  config: Pick<TemplateConfig, "sectionOrder">,
): ResumeSection[] {
  const order = config.sectionOrder.length ? config.sectionOrder : content.sections.map((section) => section.type);
  return [...content.sections].sort((a, b) => {
    const aIndex = order.indexOf(a.type);
    const bIndex = order.indexOf(b.type);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

export function headingClass(config: Pick<TemplateConfig, "heading">) {
  const parts = [`heading-${config.heading.style}`];
  if (config.heading.uppercase) parts.push("uppercase");
  return parts.join(" ");
}

export function headingText(title: string, config: Pick<TemplateConfig, "heading">) {
  return config.heading.uppercase ? title.toUpperCase() : title;
}
