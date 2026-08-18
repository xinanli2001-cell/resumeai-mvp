import type { CSSProperties } from "react";
import type { ResumeContent } from "@/lib/resume/resume-content";
import { headingClass, headingText, orderedSectionsForRender } from "@/lib/resume/render";
import type { TemplateConfig } from "@/lib/template/template-config";

export function ResumeDocument({
  content,
  config,
  className = "",
}: {
  content: ResumeContent;
  config: TemplateConfig;
  className?: string;
}) {
  const previewStyle: CSSProperties = {
    fontFamily: config.font.family,
    fontSize: `${config.font.sizePt}pt`,
    lineHeight: config.spacing.lineHeight,
    color: config.color.text,
  };
  const contact = [
    content.header.location,
    content.header.phone,
    content.header.email,
    content.header.linkedin,
    content.header.github,
    content.header.website,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`resume-document mx-auto max-w-3xl border border-[#d6b39b] bg-white p-8 shadow-[0_24px_60px_-34px_rgba(23,32,42,0.5)] ${className}`} style={previewStyle}>
      <header className={config.header.align === "center" ? "text-center" : "text-left"}>
        <h1 className="text-2xl font-bold" style={{ color: config.color.primary }}>
          {content.header.name || "姓名"}
        </h1>
        <p className="mt-1 font-semibold">{content.header.targetTitle}</p>
        {contact ? <p className="mt-2 text-sm">{contact}</p> : null}
      </header>
      <div className="mt-6">
        {orderedSectionsForRender(content, config).map((section) => (
          <section key={section.id} style={{ marginBottom: config.spacing.sectionGap }}>
            <SectionHeading title={section.title} config={config} />
            <div className="mt-3 grid gap-3">
              {section.items.map((item) => (
                <article key={item.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{item.heading}</h3>
                    <p className="text-sm text-[#565e74]">{item.dateRange}</p>
                  </div>
                  <p className="text-sm text-[#565e74]">{item.subheading}</p>
                  <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ title, config }: { title: string; config: TemplateConfig }) {
  const text = headingText(title, config);
  const className = headingClass(config);
  if (config.heading.style === "underline") {
    return (
      <h2 className={`${className} border-b pb-1 font-bold`} style={{ borderColor: config.color.primary, color: config.color.primary }}>
        {text}
      </h2>
    );
  }
  if (config.heading.style === "plain") {
    return (
      <h2 className={`${className} font-bold`} style={{ color: config.color.primary }}>
        {text}
      </h2>
    );
  }
  return (
    <h2 className={`${className} border-l pl-2 font-bold`} style={{ borderColor: config.color.primary, color: config.color.primary }}>
      {text}
    </h2>
  );
}
