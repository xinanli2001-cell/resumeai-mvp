"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { ResumeContent } from "@/lib/resume/resume-content";
import type { TemplateConfig } from "@/lib/template/template-config";

type TemplateItem = {
  id: string;
  name: string;
  baseTemplateId: string | null;
  isSystem: boolean;
  ownerUserId: string | null;
  config: TemplateConfig;
};

type ResumeDetail = {
  id: string;
  sessionId: string | null;
  title: string;
  language: string;
  templateId: string | null;
  status: "DRAFT" | "FINALIZED";
  content: ResumeContent;
  template: { id: string; config: TemplateConfig } | null;
};

type Library = {
  profile: {
    name: string;
    location: string;
    targetTitle: string;
    summary: string;
    phone: string;
    contactEmail: string;
    linkedin: string;
    github: string;
    website: string;
    workAuthorization: string;
    languages: string[];
  };
  experiences: {
    id: string;
    type: string;
    title: string;
    organization: string;
    role: string;
    startDate: string;
    endDate: string;
    rawText: string;
    skills: string[];
    tags: string[];
    metrics: string[];
  }[];
};

const defaultConfig: TemplateConfig = {
  sectionOrder: ["SUMMARY", "EDUCATION", "PROJECT", "INTERNSHIP", "WORK", "SKILL"],
  font: { family: "system-ui", sizePt: 11 },
  spacing: { sectionGap: 16, lineHeight: 1.4 },
  color: { primary: "#0f172a", text: "#0b1c30" },
  heading: { style: "bar", uppercase: false },
  header: { align: "left", showContactIcons: false },
};

const typeLabels: Record<string, string> = {
  SUMMARY: "个人简介",
  EDUCATION: "教育经历",
  PROJECT: "项目经历",
  INTERNSHIP: "实习经历",
  WORK: "工作经历",
  SKILL: "职业能力",
  CUSTOM: "自定义",
};

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function mergeConfig(config?: Partial<TemplateConfig> | null): TemplateConfig {
  return {
    ...defaultConfig,
    ...config,
    font: { ...defaultConfig.font, ...config?.font },
    spacing: { ...defaultConfig.spacing, ...config?.spacing },
    color: { ...defaultConfig.color, ...config?.color },
    heading: { ...defaultConfig.heading, ...config?.heading },
    header: { ...defaultConfig.header, ...config?.header },
  };
}

export function ResumeClient({
  initialResume,
  initialTemplates,
  library,
}: {
  initialResume: ResumeDetail;
  initialTemplates: TemplateItem[];
  library: Library;
}) {
  const [title, setTitle] = useState(initialResume.title);
  const [content, setContent] = useState<ResumeContent>(initialResume.content);
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateId, setTemplateId] = useState(initialResume.templateId ?? initialTemplates[0]?.id ?? "");
  const [config, setConfig] = useState<TemplateConfig>(
    mergeConfig(initialResume.template?.config ?? initialTemplates.find((item) => item.id === initialResume.templateId)?.config),
  );
  const [templateName, setTemplateName] = useState("我的模板");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const orderedSections = useMemo(() => {
    const order = config.sectionOrder.length ? config.sectionOrder : content.sections.map((section) => section.type);
    return [...content.sections].sort((a, b) => {
      const aIndex = order.indexOf(a.type);
      const bIndex = order.indexOf(b.type);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }, [content.sections, config.sectionOrder]);

  const previewStyle: CSSProperties = {
    fontFamily: config.font.family,
    fontSize: `${config.font.sizePt}pt`,
    lineHeight: config.spacing.lineHeight,
    color: config.color.text,
  };

  function updateSection(sectionId: string, patch: Partial<ResumeContent["sections"][number]>) {
    setContent((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
    }));
  }

  function updateItem(sectionId: string, itemId: string, field: "heading" | "subheading" | "dateRange" | "body", value: string) {
    setContent((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
            }
          : section,
      ),
    }));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setContent((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      return { ...current, sections: move(current.sections, index, direction) };
    });
  }

  function moveTemplateType(type: string, direction: -1 | 1) {
    const currentOrder = config.sectionOrder.length ? config.sectionOrder : content.sections.map((section) => section.type);
    const uniqueOrder = Array.from(new Set([...currentOrder, ...content.sections.map((section) => section.type)]));
    const index = uniqueOrder.indexOf(type);
    setConfig((current) => ({ ...current, sectionOrder: move(uniqueOrder, index, direction) }));
  }

  function selectTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    setTemplateId(id);
    if (template) setConfig(mergeConfig(template.config));
  }

  async function saveResume() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/resumes/${initialResume.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, content, templateId }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "保存失败");
      return;
    }
    const body = await response.json();
    setContent(body.resume.content);
    setMessage("简历已保存");
  }

  async function saveTemplate() {
    setMessage("");
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: templateName, baseTemplateId: templateId || undefined, config }),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "模板保存失败");
      return;
    }
    const body = await response.json();
    const template = body.template as TemplateItem;
    const normalized = { ...template, config: mergeConfig(template.config) };
    setTemplates((current) => [normalized, ...current]);
    setTemplateId(template.id);
    setMessage("已保存为我的模板");
  }

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">Personal Library</p>
          <h2 className="mt-1 text-base font-semibold">只读参考</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">{library.profile.name || "未填写姓名"}</p>
            <p className="text-[#565e74]">{library.profile.targetTitle || "未填写目标岗位"}</p>
            <p className="text-[#565e74]">{library.profile.contactEmail || library.profile.phone}</p>
          </div>
        </section>
        <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">经历资产</h2>
          <div className="mt-4 grid gap-3">
            {library.experiences.map((experience) => (
              <article key={experience.id} className="rounded border border-[#d8c3ad] bg-[#f8f9ff] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">{typeLabels[experience.type] ?? experience.type}</p>
                <h3 className="mt-1 text-sm font-semibold">{experience.title}</h3>
                <p className="text-xs text-[#565e74]">
                  {[experience.organization, experience.role].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 line-clamp-3 text-xs text-[#565e74]">{experience.rawText}</p>
              </article>
            ))}
          </div>
        </section>
      </aside>

      <main className="space-y-5">
        <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <label className="grid gap-1">
                <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">简历标题</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-80 max-w-full rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
                />
              </label>
              <p className="text-sm text-[#565e74]">语言：{initialResume.language} · 来源 session：{initialResume.sessionId ?? "无"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveResume}
                disabled={saving}
                className="rounded bg-[#855300] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                disabled
                className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-4 py-2 text-sm font-semibold text-[#94a3b8]"
              >
                PDF 导出（后续版本）
              </button>
            </div>
          </div>
          {message ? <p className="mt-4 rounded border border-[#d8c3ad] bg-[#f8f9ff] px-4 py-3 text-sm">{message}</p> : null}
        </section>

        <section className="grid gap-5 2xl:grid-cols-[minmax(360px,520px)_1fr]">
          <div className="space-y-5">
            <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">模板</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">当前模板</span>
                  <select
                    value={templateId}
                    onChange={(event) => selectTemplate(event.target.value)}
                    className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.isSystem ? "（系统）" : "（我的）"}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="字体"
                    value={config.font.family}
                    onChange={(family) => setConfig((current) => ({ ...current, font: { ...current.font, family } }))}
                  />
                  <NumberField
                    label="字号"
                    value={config.font.sizePt}
                    step={0.5}
                    onChange={(sizePt) => setConfig((current) => ({ ...current, font: { ...current.font, sizePt } }))}
                  />
                  <NumberField
                    label="段距"
                    value={config.spacing.sectionGap}
                    onChange={(sectionGap) =>
                      setConfig((current) => ({ ...current, spacing: { ...current.spacing, sectionGap } }))
                    }
                  />
                  <NumberField
                    label="行高"
                    value={config.spacing.lineHeight}
                    step={0.05}
                    onChange={(lineHeight) =>
                      setConfig((current) => ({ ...current, spacing: { ...current.spacing, lineHeight } }))
                    }
                  />
                  <ColorField
                    label="主色"
                    value={config.color.primary}
                    onChange={(primary) => setConfig((current) => ({ ...current, color: { ...current.color, primary } }))}
                  />
                  <ColorField
                    label="正文"
                    value={config.color.text}
                    onChange={(text) => setConfig((current) => ({ ...current, color: { ...current.color, text } }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">标题样式</span>
                    <select
                      value={config.heading.style}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          heading: { ...current.heading, style: event.target.value as TemplateConfig["heading"]["style"] },
                        }))
                      }
                      className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
                    >
                      <option value="bar">色条</option>
                      <option value="underline">下划线</option>
                      <option value="plain">朴素</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">页眉</span>
                    <select
                      value={config.header.align}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          header: { ...current.header, align: event.target.value as TemplateConfig["header"]["align"] },
                        }))
                      }
                      className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
                    >
                      <option value="left">左对齐</option>
                      <option value="center">居中</option>
                    </select>
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.heading.uppercase}
                    onChange={(event) =>
                      setConfig((current) => ({ ...current, heading: { ...current.heading, uppercase: event.target.checked } }))
                    }
                  />
                  标题大写
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.header.showContactIcons}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        header: { ...current.header, showContactIcons: event.target.checked },
                      }))
                    }
                  />
                  联系方式图标占位
                </label>
                <div className="rounded border border-[#d8c3ad] bg-[#f8f9ff] p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#565e74]">模板模块顺序</p>
                  {orderedSections.map((section, index) => (
                    <div key={section.id} className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <span>{section.title}</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveTemplateType(section.type, -1)}
                          disabled={index === 0}
                          className="rounded border border-[#d8c3ad] bg-white px-2 py-1 disabled:opacity-40"
                        >
                          上
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTemplateType(section.type, 1)}
                          disabled={index === orderedSections.length - 1}
                          className="rounded border border-[#d8c3ad] bg-white px-2 py-1 disabled:opacity-40"
                        >
                          下
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">模板名称</span>
                    <input
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      className="min-w-52 rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={saveTemplate}
                    className="w-fit rounded bg-[#0f172a] px-3 py-2 text-sm font-semibold text-white"
                  >
                    保存为我的模板
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">内容编辑</h2>
              <div className="mt-4 grid gap-4">
                {content.sections.map((section, index) => (
                  <article key={section.id} className="rounded border border-[#d8c3ad] bg-[#f8f9ff] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <input
                        value={section.title}
                        onChange={(event) => updateSection(section.id, { title: event.target.value })}
                        className="min-w-0 flex-1 rounded border border-[#d8c3ad] bg-white px-3 py-2 text-sm font-semibold"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveSection(section.id, -1)}
                          disabled={index === 0}
                          className="rounded border border-[#d8c3ad] bg-white px-2 py-1 text-xs disabled:opacity-40"
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(section.id, 1)}
                          disabled={index === content.sections.length - 1}
                          className="rounded border border-[#d8c3ad] bg-white px-2 py-1 text-xs disabled:opacity-40"
                        >
                          下移
                        </button>
                      </div>
                    </div>
                    <label className="mb-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={section.visible}
                        onChange={(event) => updateSection(section.id, { visible: event.target.checked })}
                      />
                      显示该模块
                    </label>
                    <div className="grid gap-3">
                      {section.items.map((item) => (
                        <div key={item.id} className="grid gap-2 rounded border border-[#d8c3ad] bg-white p-3">
                          <Field
                            label="标题"
                            value={item.heading}
                            onChange={(value) => updateItem(section.id, item.id, "heading", value)}
                          />
                          <Field
                            label="副标题"
                            value={item.subheading}
                            onChange={(value) => updateItem(section.id, item.id, "subheading", value)}
                          />
                          <Field
                            label="时间"
                            value={item.dateRange}
                            onChange={(value) => updateItem(section.id, item.id, "dateRange", value)}
                          />
                          <label className="grid gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">条目正文</span>
                            <textarea
                              value={item.body}
                              onChange={(event) => updateItem(section.id, item.id, "body", event.target.value)}
                              className="min-h-24 rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-[#d8c3ad] bg-white p-6 shadow-sm">
            <div className="mx-auto max-w-3xl border border-[#e5e7eb] bg-white p-8 shadow-sm" style={previewStyle}>
              <header className={config.header.align === "center" ? "text-center" : "text-left"}>
                <h1 className="text-2xl font-bold" style={{ color: config.color.primary }}>
                  {content.header.name || library.profile.name || "姓名"}
                </h1>
                <p className="mt-1 font-semibold">{content.header.targetTitle || library.profile.targetTitle}</p>
                <p className="mt-2 text-sm">
                  {[content.header.location, content.header.phone, content.header.email, content.header.linkedin, content.header.github]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </header>
              <div className="mt-6">
                {orderedSections
                  .filter((section) => section.visible)
                  .map((section) => (
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
          </section>
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
      />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded border border-[#d8c3ad] bg-[#f8f9ff] px-2 py-1"
      />
    </label>
  );
}

function SectionHeading({ title, config }: { title: string; config: TemplateConfig }) {
  const text = config.heading.uppercase ? title.toUpperCase() : title;
  if (config.heading.style === "underline") {
    return (
      <h2 className="border-b pb-1 font-bold" style={{ borderColor: config.color.primary, color: config.color.primary }}>
        {text}
      </h2>
    );
  }
  if (config.heading.style === "plain") {
    return (
      <h2 className="font-bold" style={{ color: config.color.primary }}>
        {text}
      </h2>
    );
  }
  return (
    <h2 className="border-l-4 pl-2 font-bold" style={{ borderColor: config.color.primary, color: config.color.primary }}>
      {text}
    </h2>
  );
}
