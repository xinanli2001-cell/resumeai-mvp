"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ResumeDocument } from "@/components/resume/resume-document";
import { analyzeResumeFit } from "@/lib/resume/fit-advisor";
import { appendLibraryExperience } from "@/lib/resume/library-experience";
import type { ResumeContent } from "@/lib/resume/resume-content";
import { orderedSectionsForControls } from "@/lib/resume/render";
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

type ResumeLanguage = "zh" | "en" | "bilingual";
type DraftSnapshot = {
  title: string;
  language: ResumeLanguage;
  content: ResumeContent;
  templateId: string;
  config: TemplateConfig;
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
  color: { primary: "#004ac6", text: "#0b1c30" },
  heading: { style: "bar", uppercase: false },
  header: { align: "left", showContactIcons: false },
};

const typeLabels: Record<string, string> = {
  EDUCATION: "教育经历",
  PROJECT: "项目经历",
  INTERNSHIP: "实习经历",
  WORK: "工作经历",
  SKILL: "职业能力",
};

const assetTabs = [
  { id: "PROFILE", label: "基本信息" },
  { id: "EDUCATION", label: "教育" },
  { id: "PROJECT", label: "项目" },
  { id: "INTERNSHIP", label: "实习" },
  { id: "WORK", label: "工作" },
] as const;

const languageModes: { id: ResumeLanguage; label: string; description: string }[] = [
  { id: "zh", label: "CN", description: "中文" },
  { id: "en", label: "EN", description: "英文" },
  { id: "bilingual", label: "双语", description: "中英文" },
];

const controlClass = "w-full border border-[#cbdaf2] bg-white px-3 py-2 text-sm text-[#0b1c30] outline-none transition focus:border-[#004ac6] focus:ring-2 focus:ring-[#b9d0ff]";
const compactButton = "border border-[#cbdaf2] bg-white px-2 py-1.5 text-xs font-semibold text-[#33435b] transition hover:border-[#004ac6] hover:text-[#004ac6] disabled:cursor-not-allowed disabled:opacity-40";

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

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ResumeClient({ initialResume, initialTemplates, library }: { initialResume: ResumeDetail; initialTemplates: TemplateItem[]; library: Library }) {
  const [title, setTitle] = useState(initialResume.title);
  const [language, setLanguage] = useState<ResumeLanguage>(
    initialResume.language === "en" || initialResume.language === "bilingual" ? initialResume.language : "zh",
  );
  const [content, setContent] = useState<ResumeContent>(initialResume.content);
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateId, setTemplateId] = useState(initialResume.templateId ?? initialTemplates[0]?.id ?? "");
  const [config, setConfig] = useState<TemplateConfig>(mergeConfig(initialResume.template?.config ?? initialTemplates.find((item) => item.id === initialResume.templateId)?.config));
  const [templateName, setTemplateName] = useState("我的模板");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"content" | "style">("style");
  const [assetTab, setAssetTab] = useState<(typeof assetTabs)[number]["id"]>("PROJECT");
  const [undoStack, setUndoStack] = useState<DraftSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<DraftSnapshot[]>([]);

  const orderedSections = useMemo(() => orderedSectionsForControls(content, config), [content, config]);
  const fit = useMemo(() => analyzeResumeFit(content, config), [content, config]);
  const visibleExperiences = useMemo(
    () => library.experiences.filter((experience) => experience.type === assetTab),
    [assetTab, library.experiences],
  );
  const previewContent = useMemo(
    () => ({
      ...content,
      header: {
        ...content.header,
        name: content.header.name || library.profile.name || "姓名",
        targetTitle: content.header.targetTitle || library.profile.targetTitle,
      },
    }),
    [content, library.profile.name, library.profile.targetTitle],
  );

  function snapshot(): DraftSnapshot {
    return { title, language, content, templateId, config };
  }

  function rememberChange() {
    setUndoStack((current) => [...current, snapshot()].slice(-50));
    setRedoStack([]);
  }

  function restoreSnapshot(next: DraftSnapshot) {
    setTitle(next.title);
    setLanguage(next.language);
    setContent(next.content);
    setTemplateId(next.templateId);
    setConfig(next.config);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, snapshot()].slice(-50));
    restoreSnapshot(previous);
    setMessage("已撤销上一步修改");
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, snapshot()].slice(-50));
    restoreSnapshot(next);
    setMessage("已重做修改");
  }

  function updateContent(updater: (current: ResumeContent) => ResumeContent) {
    rememberChange();
    setContent(updater);
  }

  function updateConfig(updater: (current: TemplateConfig) => TemplateConfig) {
    rememberChange();
    setConfig(updater);
  }

  function updateSection(sectionId: string, patch: Partial<ResumeContent["sections"][number]>) {
    updateContent((current) => ({ ...current, sections: current.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)) }));
  }

  function updateItem(sectionId: string, itemId: string, field: "heading" | "subheading" | "dateRange" | "body", value: string) {
    updateContent((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId ? { ...section, items: section.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)) } : section),
    }));
  }

  function addLibraryExperience(experience: Library["experiences"][number]) {
    const result = appendLibraryExperience(content, experience);
    if (result.added) updateContent(() => result.content);
    setMessage(result.added ? `已加入简历：${experience.title}` : "该经历已在当前简历中");
  }

  function addCustomSection() {
    updateContent((current) => ({
      ...current,
      sections: [...current.sections, { id: uniqueId("custom"), type: "CUSTOM", title: "自定义模块", visible: true, items: [{ id: uniqueId("custom-item"), heading: "", subheading: "", dateRange: "", body: "" }] }],
    }));
    setMessage("已新增自定义模块");
  }

  function removeSection(sectionId: string) {
    updateContent((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== sectionId) }));
  }

  function addSectionItem(sectionId: string) {
    updateContent((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId ? { ...section, items: [...section.items, { id: uniqueId("item"), heading: "", subheading: "", dateRange: "", body: "" }] } : section),
    }));
  }

  function removeSectionItem(sectionId: string, itemId: string) {
    updateContent((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === sectionId ? { ...section, items: section.items.filter((item) => item.id !== itemId) } : section),
    }));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    updateContent((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      return { ...current, sections: move(current.sections, index, direction) };
    });
  }

  function moveTemplateType(type: string, direction: -1 | 1) {
    const currentOrder = config.sectionOrder.length ? config.sectionOrder : content.sections.map((section) => section.type);
    const uniqueOrder = Array.from(new Set([...currentOrder, ...content.sections.map((section) => section.type)]));
    updateConfig((current) => ({ ...current, sectionOrder: move(uniqueOrder, uniqueOrder.indexOf(type), direction) }));
  }

  function selectTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    rememberChange();
    setTemplateId(id);
    if (template) setConfig(mergeConfig(template.config));
  }

  async function saveResume() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/resumes/${initialResume.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, language, content, templateId }) });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "保存失败");
      return false;
    }
    const body = await response.json();
    setContent(body.resume.content);
    setLanguage(body.resume.language);
    setMessage("简历已保存");
    return true;
  }

  async function exportPdf() {
    const saved = await saveResume();
    if (saved) window.open(`/resume/${initialResume.id}/print`, "_blank", "noopener,noreferrer");
  }

  async function saveTemplate() {
    setMessage("");
    const response = await fetch("/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: templateName, baseTemplateId: templateId || undefined, config }) });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "模板保存失败");
      return;
    }
    const body = await response.json();
    const template = body.template as TemplateItem;
    const normalized = { ...template, config: mergeConfig(template.config) };
    setTemplates((current) => [normalized, ...current]);
    rememberChange();
    setTemplateId(template.id);
    setMessage("已保存为我的模板");
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#e7effd] md:min-h-screen">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[#d9e4f7] bg-white px-4 py-2 md:px-6">
        <div className="min-w-0">
          <input aria-label="简历标题" value={title} onChange={(event) => { rememberChange(); setTitle(event.target.value); }} className="w-full max-w-90 border-0 bg-transparent p-0 text-sm font-semibold text-[#0b1c30] outline-none" />
          <p className="mt-1 text-[11px] text-[#52637a]">待保存修改 · {language} · session {initialResume.sessionId ?? "无"}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="hidden border border-[#d9e4f7] bg-[#f8faff] text-xs font-semibold sm:flex" role="group" aria-label="简历语言">
            {languageModes.map((mode) => <button key={mode.id} type="button" title={mode.description} aria-pressed={language === mode.id} onClick={() => { rememberChange(); setLanguage(mode.id); }} className={`px-2.5 py-1.5 transition ${language === mode.id ? "bg-[#eff4ff] text-[#004ac6]" : "text-[#64748b] hover:text-[#004ac6]"}`}>{mode.label}</button>)}
          </div>
          <button type="button" onClick={undo} disabled={undoStack.length === 0} className={compactButton} title="撤销" aria-label="撤销">Undo</button>
          <button type="button" onClick={redo} disabled={redoStack.length === 0} className={compactButton} title="重做" aria-label="重做">Redo</button>
          <button type="button" onClick={saveResume} disabled={saving} className="border border-[#004ac6] bg-white px-3 py-1.5 text-xs font-semibold text-[#004ac6] transition hover:bg-[#eff4ff] disabled:opacity-50">{saving ? "保存中..." : "保存"}</button>
          <button type="button" onClick={exportPdf} disabled={saving} className="bg-[#004ac6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#003a9d] disabled:opacity-50">导出 PDF</button>
        </div>
      </header>

      {message ? <div className="border-b border-[#b9d0ff] bg-[#eff4ff] px-4 py-2 text-sm text-[#003a9d] md:px-6" role="status">{message}</div> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)_300px]">
        <aside className="border-b border-[#d9e4f7] bg-white md:max-h-[calc(100vh-3.5rem)] md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="border-b border-[#d9e4f7] px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">Asset Library</p>
            <h2 className="mt-1 text-base font-semibold">信息库内容</h2>
          </div>
          <div className="flex border-b border-[#d9e4f7] px-2" role="tablist" aria-label="信息库分类">
            {assetTabs.map((tab) => <button key={tab.id} type="button" onClick={() => setAssetTab(tab.id)} className={`flex-1 border-b-2 px-1 py-3 text-[11px] font-semibold ${assetTab === tab.id ? "border-[#004ac6] text-[#004ac6]" : "border-transparent text-[#64748b] hover:text-[#004ac6]"}`}>{tab.label}</button>)}
          </div>
          {assetTab === "PROFILE" ? (
            <div className="p-4">
              <p className="text-xs font-bold text-[#52637a]">只读参考</p>
              <h3 className="mt-3 font-semibold">{library.profile.name || "未填写姓名"}</h3>
              <p className="mt-1 text-sm text-[#52637a]">{library.profile.targetTitle || "未填写目标岗位"}</p>
              <p className="mt-3 text-sm text-[#52637a]">{library.profile.contactEmail || library.profile.phone || "未填写联系方式"}</p>
              <p className="mt-4 whitespace-pre-wrap border-t border-[#e5edf9] pt-4 text-sm leading-6 text-[#52637a]">{library.profile.summary || "个人简介将在信息库中维护。"}</p>
            </div>
          ) : (
            <div className="grid gap-3 p-4">
              {visibleExperiences.length === 0 ? <p className="border border-dashed border-[#cbdaf2] bg-[#f8faff] p-4 text-sm text-[#64748b]">此分类暂时没有可复用的经历。</p> : visibleExperiences.map((experience) => {
                const included = content.sections.some((section) => section.items.some((item) => item.sourceExperienceId === experience.id));
                return (
                  <article key={experience.id} className={`relative border p-3 ${included ? "border-[#90b6ff] bg-[#eff4ff]" : "border-[#d9e4f7] bg-white"}`}>
                    {included ? <span className="absolute right-0 top-0 bg-[#004ac6] px-1.5 py-0.5 text-[10px] font-bold text-white">已添加</span> : null}
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#004ac6]">{typeLabels[experience.type] ?? experience.type}</p>
                    <h3 className="mt-1 pr-10 text-sm font-semibold">{experience.title}</h3>
                    <p className="mt-1 text-xs text-[#52637a]">{[experience.organization, experience.role].filter(Boolean).join(" · ")}</p>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#64748b]">{experience.rawText}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-[#64748b]">{experience.skills.slice(0, 2).join(" · ")}</span>
                      <button type="button" onClick={() => addLibraryExperience(experience)} className={included ? compactButton : "bg-[#004ac6] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#003a9d]"} aria-label={`加入简历 ${experience.title}`}>{included ? "再次加入" : "加入简历"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <Link href="/library" className="block border-t border-[#d9e4f7] p-4 text-sm font-semibold text-[#004ac6] hover:bg-[#eff4ff]">+ 新建项目经历</Link>
        </aside>

        <main className="relative min-h-[62vh] overflow-auto bg-[#cfdef7] px-4 py-8 md:max-h-[calc(100vh-3.5rem)] md:px-8 md:py-10">
          <ResumeDocument content={previewContent} config={config} className="min-h-[297mm] w-[210mm] max-w-[calc(100vw-2rem)] p-[14mm] shadow-[0_12px_30px_rgba(45,73,120,0.16)] md:max-w-full" />
          <div className="sticky bottom-2 ml-auto mr-2 mt-5 w-fit border border-[#b9d0ff] bg-white px-3 py-2 text-xs shadow-sm">
            <p className={`font-semibold ${fit.status === "overflow" ? "text-[#b42318]" : fit.status === "tight" ? "text-[#a15c00]" : "text-[#16803c]"}`}>{fit.status === "fits" ? "排版状态良好" : "排版需要关注"}</p>
            <p className="mt-0.5 text-[#52637a]">版面检查：{fit.status === "fits" ? "预计适合一页 A4 纸" : fit.message} · {fit.visibleItems} 个条目</p>
          </div>
        </main>

        <aside className="border-t border-[#d9e4f7] bg-white md:max-h-[calc(100vh-3.5rem)] md:overflow-y-auto md:border-l md:border-t-0">
          <div className="flex border-b border-[#d9e4f7]" role="tablist" aria-label="编辑器检查器">
            <button id="content-tab" type="button" role="tab" aria-selected={inspectorTab === "content"} aria-controls="content-panel" onClick={() => setInspectorTab("content")} className={`flex-1 border-b-2 py-3 text-sm font-semibold ${inspectorTab === "content" ? "border-[#004ac6] text-[#004ac6]" : "border-transparent text-[#64748b]"}`}>内容</button>
            <button id="style-tab" type="button" role="tab" aria-selected={inspectorTab === "style"} aria-controls="style-panel" onClick={() => setInspectorTab("style")} className={`flex-1 border-b-2 py-3 text-sm font-semibold ${inspectorTab === "style" ? "border-[#004ac6] text-[#004ac6]" : "border-transparent text-[#64748b]"}`}>样式</button>
          </div>
          {inspectorTab === "content" ? (
            <section id="content-panel" role="tabpanel" aria-labelledby="content-tab" className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">Resume Content</p><h2 className="mt-1 font-semibold">内容编辑</h2></div>
                <button type="button" onClick={addCustomSection} className="bg-[#004ac6] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#003a9d]">新增自定义模块</button>
              </div>
              <div className="grid gap-4">
                {content.sections.map((section, index) => (
                  <article key={section.id} className="border border-[#d9e4f7] bg-[#f8faff] p-3">
                    <div className="flex items-start gap-2">
                      <input aria-label="模块标题" value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} className={`${controlClass} min-w-0 flex-1 font-semibold`} />
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => moveSection(section.id, -1)} disabled={index === 0} className={compactButton} aria-label="上移">上移</button>
                        <button type="button" onClick={() => moveSection(section.id, 1)} disabled={index === content.sections.length - 1} className={compactButton} aria-label="下移">下移</button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-[#52637a]"><input type="checkbox" checked={section.visible} onChange={(event) => updateSection(section.id, { visible: event.target.checked })} />显示该模块</label>
                      <span className="flex gap-1"><button type="button" onClick={() => addSectionItem(section.id)} className={compactButton}>新增条目</button><button type="button" onClick={() => removeSection(section.id)} className={`${compactButton} text-[#b42318]`}>删除</button></span>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {section.items.map((item) => (
                        <div key={item.id} className="border border-[#e1eaf8] bg-white p-3">
                          <div className="mb-2 flex justify-end"><button type="button" onClick={() => removeSectionItem(section.id, item.id)} className={`${compactButton} text-[#b42318]`}>删除条目</button></div>
                          <div className="grid gap-2"><Field label="标题" value={item.heading} onChange={(value) => updateItem(section.id, item.id, "heading", value)} /><Field label="副标题" value={item.subheading} onChange={(value) => updateItem(section.id, item.id, "subheading", value)} /><Field label="时间" value={item.dateRange} onChange={(value) => updateItem(section.id, item.id, "dateRange", value)} /><label className="grid gap-1"><span className="text-xs font-semibold text-[#52637a]">条目正文</span><textarea value={item.body} onChange={(event) => updateItem(section.id, item.id, "body", event.target.value)} className={`${controlClass} min-h-24 resize-y`} /></label></div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section id="style-panel" role="tabpanel" aria-labelledby="style-tab" className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">Resume Style</p>
              <h2 className="mt-1 font-semibold">排版与主题</h2>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1"><span className="text-xs font-semibold text-[#52637a]">当前模板</span><select value={templateId} onChange={(event) => selectTemplate(event.target.value)} className={controlClass}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isSystem ? "（系统）" : "（我的）"}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-3"><Field label="字体" value={config.font.family} onChange={(family) => updateConfig((current) => ({ ...current, font: { ...current.font, family } }))} /><NumberField label="字号" value={config.font.sizePt} step={0.5} onChange={(sizePt) => updateConfig((current) => ({ ...current, font: { ...current.font, sizePt } }))} /><NumberField label="段距" value={config.spacing.sectionGap} onChange={(sectionGap) => updateConfig((current) => ({ ...current, spacing: { ...current.spacing, sectionGap } }))} /><NumberField label="行高" value={config.spacing.lineHeight} step={0.05} onChange={(lineHeight) => updateConfig((current) => ({ ...current, spacing: { ...current.spacing, lineHeight } }))} /></div>
                <div className="border-y border-[#e1eaf8] py-4"><p className="text-xs font-semibold text-[#52637a]">主题颜色</p><div className="mt-3 flex gap-2"><ColorField label="主色" value={config.color.primary} onChange={(primary) => updateConfig((current) => ({ ...current, color: { ...current.color, primary } }))} /><ColorField label="正文" value={config.color.text} onChange={(text) => updateConfig((current) => ({ ...current, color: { ...current.color, text } }))} /></div></div>
                <div className="grid grid-cols-2 gap-3"><label className="grid gap-1"><span className="text-xs font-semibold text-[#52637a]">标题样式</span><select value={config.heading.style} onChange={(event) => updateConfig((current) => ({ ...current, heading: { ...current.heading, style: event.target.value as TemplateConfig["heading"]["style"] } }))} className={controlClass}><option value="bar">色条</option><option value="underline">下划线</option><option value="plain">朴素</option></select></label><label className="grid gap-1"><span className="text-xs font-semibold text-[#52637a]">页眉</span><select value={config.header.align} onChange={(event) => updateConfig((current) => ({ ...current, header: { ...current.header, align: event.target.value as TemplateConfig["header"]["align"] } }))} className={controlClass}><option value="left">左对齐</option><option value="center">居中</option></select></label></div>
                <label className="flex items-center gap-2 text-sm text-[#33435b]"><input type="checkbox" checked={config.heading.uppercase} onChange={(event) => updateConfig((current) => ({ ...current, heading: { ...current.heading, uppercase: event.target.checked } }))} />标题大写</label>
                <label className="flex items-center gap-2 text-sm text-[#33435b]"><input type="checkbox" checked={config.header.showContactIcons} onChange={(event) => updateConfig((current) => ({ ...current, header: { ...current.header, showContactIcons: event.target.checked } }))} />联系方式图标占位</label>
                <div className="border border-[#d9e4f7] bg-[#f8faff] p-3"><p className="mb-2 text-xs font-semibold text-[#52637a]">模块顺序</p>{orderedSections.map((section, index) => <div key={section.id} className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="truncate">{section.title}</span><span className="flex gap-1"><button type="button" onClick={() => moveTemplateType(section.type, -1)} disabled={index === 0} className={compactButton}>上</button><button type="button" onClick={() => moveTemplateType(section.type, 1)} disabled={index === orderedSections.length - 1} className={compactButton}>下</button></span></div>)}</div>
                <div className="grid gap-2 border-t border-[#e1eaf8] pt-4"><Field label="模板名称" value={templateName} onChange={setTemplateName} /><button type="button" onClick={saveTemplate} className="w-fit bg-[#0b1c30] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24364d]">保存为我的模板</button></div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1"><span className="text-xs font-semibold text-[#52637a]">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className={controlClass} /></label>;
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1"><span className="text-xs font-semibold text-[#52637a]">{label}</span><input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={controlClass} /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1"><span className="sr-only">{label}</span><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-10 cursor-pointer border border-[#cbdaf2] bg-white p-1" /></label>;
}
