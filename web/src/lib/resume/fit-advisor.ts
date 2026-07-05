import type { ResumeContent } from "@/lib/resume/resume-content";
import type { TemplateConfig } from "@/lib/template/template-config";

export type FitStatus = "fits" | "tight" | "overflow";

export function analyzeResumeFit(content: ResumeContent, config: Pick<TemplateConfig, "font" | "spacing">) {
  const visibleSections = content.sections.filter((section) => section.visible);
  const visibleItems = visibleSections.flatMap((section) => section.items);
  const text = [
    content.header.name,
    content.header.targetTitle,
    content.header.location,
    content.header.phone,
    content.header.email,
    content.header.linkedin,
    content.header.github,
    content.header.website,
    ...visibleSections.map((section) => section.title),
    ...visibleItems.flatMap((item) => [item.heading, item.subheading, item.dateRange, item.body]),
  ].join(" ");
  const textUnits = Math.ceil(text.trim().length / 60) * 10;
  const baseUnits = visibleSections.length * 12 + visibleItems.length * 18 + textUnits;
  const fontAdjustment = (config.font.sizePt - 11) * 14;
  const spacingAdjustment = (config.spacing.sectionGap - 16) * visibleSections.length * 0.8;
  const estimatedUnits = Math.round(baseUnits + fontAdjustment + spacingAdjustment);

  if (estimatedUnits >= 220) {
    return {
      status: "overflow" as const,
      visibleSections: visibleSections.length,
      visibleItems: visibleItems.length,
      estimatedUnits,
      message: "可能超过一页",
      suggestions: ["优先保留目标岗位相关模块", "隐藏或缩短较旧条目", "导出前先降低段距或字号"],
    };
  }

  if (estimatedUnits >= 160) {
    return {
      status: "tight" as const,
      visibleSections: visibleSections.length,
      visibleItems: visibleItems.length,
      estimatedUnits,
      message: "内容接近一页上限",
      suggestions: ["降低段距", "减少字号 0.5pt", "隐藏低优先级模块"],
    };
  }

  return {
    status: "fits" as const,
    visibleSections: visibleSections.length,
    visibleItems: visibleItems.length,
    estimatedUnits,
    message: "预计适合一页",
    suggestions: ["可以继续导出 PDF，导出前仍建议快速检查版面"],
  };
}
