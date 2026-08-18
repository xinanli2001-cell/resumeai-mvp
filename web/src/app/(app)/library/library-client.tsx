"use client";

import { FormEvent, Ref, useMemo, useRef, useState } from "react";
import { FirstRunLibraryPanel } from "./first-run-library-panel";
import { ImportDialog } from "./import-dialog";

type ExperienceType = "PROJECT" | "INTERNSHIP" | "WORK" | "EDUCATION" | "SKILL";

type ProfileForm = {
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

type ExperienceItem = {
  id: string;
  type: ExperienceType;
  title: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  rawText: string;
  skills: string[];
  tags: string[];
  metrics: string[];
};

const sectionLabels: Record<ExperienceType, string> = {
  EDUCATION: "教育经历",
  PROJECT: "项目经历",
  INTERNSHIP: "实习经历",
  WORK: "工作经历",
  SKILL: "职业能力",
};

const typeOptions: ExperienceType[] = ["EDUCATION", "PROJECT", "INTERNSHIP", "WORK", "SKILL"];

const emptyExperience = {
  type: "PROJECT" as ExperienceType,
  title: "",
  organization: "",
  role: "",
  startDate: "",
  endDate: "",
  rawText: "",
  skills: "",
  tags: "",
  metrics: "",
};

function csv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function LibraryClient({
  initialProfile,
  initialExperiences,
}: {
  initialProfile: ProfileForm;
  initialExperiences: ExperienceItem[];
}) {
  const [profile, setProfile] = useState<ProfileForm>(initialProfile);
  const [experiences, setExperiences] = useState(initialExperiences);
  const [experienceForm, setExperienceForm] = useState(emptyExperience);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showFullLibrary, setShowFullLibrary] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const profileNameRef = useRef<HTMLInputElement>(null);
  const experienceTitleRef = useRef<HTMLInputElement>(null);

  const hasStartedLibrary = Boolean(profile.name.trim()) || experiences.length > 0;
  const showOnboarding = !hasStartedLibrary && !showFullLibrary;

  const grouped = useMemo(
    () =>
      typeOptions.reduce<Record<ExperienceType, ExperienceItem[]>>(
        (acc, type) => ({ ...acc, [type]: experiences.filter((item) => item.type === type) }),
        { EDUCATION: [], PROJECT: [], INTERNSHIP: [], WORK: [], SKILL: [] },
      ),
    [experiences],
  );
  const filledContactCount = [
    profile.contactEmail,
    profile.phone,
    profile.linkedin,
    profile.github,
    profile.website,
  ].filter((item) => item.trim()).length;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
    setMessage(response.ok ? "个人信息已保存" : "保存失败");
  }

  async function saveExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...experienceForm,
      skills: csv(experienceForm.skills),
      tags: csv(experienceForm.tags),
      metrics: csv(experienceForm.metrics),
      structuredFields: {},
    };
    const response = await fetch(editingId ? `/api/experiences/${editingId}` : "/api/experiences", {
      method: editingId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setMessage("经历保存失败");
      return;
    }
    const body = await response.json();
    setExperiences((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? body.experience : item))
        : [body.experience, ...current],
    );
    setExperienceForm(emptyExperience);
    setEditingId(null);
    setMessage("经历已保存");
  }

  async function archiveExperience(id: string) {
    const response = await fetch(`/api/experiences/${id}`, { method: "DELETE" });
    if (response.ok) {
      setExperiences((current) => current.filter((item) => item.id !== id));
      setMessage("经历已归档");
    }
  }

  function editExperience(experience: ExperienceItem) {
    setEditingId(experience.id);
    setExperienceForm({
      type: experience.type,
      title: experience.title,
      organization: experience.organization,
      role: experience.role,
      startDate: experience.startDate,
      endDate: experience.endDate,
      rawText: experience.rawText,
      skills: experience.skills.join(", "),
      tags: experience.tags.join(", "),
      metrics: experience.metrics.join(", "),
    });
  }

  function revealLibraryAndFocus(target: "profile" | "experience") {
    setShowFullLibrary(true);
    requestAnimationFrame(() => {
      (target === "profile" ? profileNameRef : experienceTitleRef).current?.focus();
    });
  }

  if (showOnboarding) {
    return (
      <div className="space-y-5">
        <FirstRunLibraryPanel
          onImport={() => setImportOpen(true)}
          onAddExperience={() => revealLibraryAndFocus("experience")}
          onFillProfile={() => revealLibraryAndFocus("profile")}
          onSkip={() => setShowFullLibrary(true)}
        />
        {importOpen ? (
          <div className="mx-auto w-full max-w-4xl px-5 pb-8 md:px-8">
            <ImportDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              onSaved={(experience) => setExperiences((current) => [experience, ...current])}
              onMessage={setMessage}
            />
          </div>
        ) : null}
        {message ? <p className="magazine-panel-quiet mx-auto max-w-4xl px-4 py-3 text-sm font-bold text-[#006b55]">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 md:p-8">
      <section className="desk-slab overflow-hidden">
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:p-6">
          <div>
            <div className="magazine-rule mb-4 h-1 w-28 rounded-full" />
            <h2 className="text-3xl font-black leading-tight text-[#1c1714]">把经历铺成可复用素材纸</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#7a6457]">
              每张素材纸保留来源、技能、标签和量化结果。后续 JD 只是在这些真实材料上标折痕，不会替你生成无法确认的经历。
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-3 divide-x divide-[#d6b39b] border-y border-[#d6b39b] bg-[#fff8ef]/70 text-center">
            <div className="px-4 py-3">
              <p className="text-2xl font-black text-[#9f2617]">{experiences.length}</p>
              <p className="text-xs font-bold text-[#7a4a32]">素材纸</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-2xl font-black text-[#006b55]">{filledContactCount}</p>
              <p className="text-xs font-bold text-[#4f665f]">联系方式</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-2xl font-black text-[#6a4632]">{typeOptions.filter((type) => grouped[type].length > 0).length}</p>
              <p className="text-xs font-bold text-[#6b5d35]">栏目</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,420px)_1fr]">
        <section className="space-y-6">
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onSaved={(experience) => setExperiences((current) => [experience, ...current])}
          onMessage={setMessage}
        />

        <form onSubmit={saveProfile} className="desk-slab p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><h2 className="text-lg font-black">个人档案纸</h2><p className="mt-1 text-sm text-[#7a6457]">给后续简历页提供稳定署名和联系方式。</p></div>
            <button className="magazine-button-primary w-fit whitespace-nowrap px-3 py-2 text-sm">保存档案纸</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field inputRef={profileNameRef} className="md:col-span-2" label="姓名" value={profile.name} onChange={(name) => setProfile({ ...profile, name })} />
            <Field
              label="所在地 / 目标城市"
              value={profile.location}
              onChange={(location) => setProfile({ ...profile, location })}
            />
            <Field
              label="目标岗位"
              value={profile.targetTitle}
              onChange={(targetTitle) => setProfile({ ...profile, targetTitle })}
            />
            <label className="grid gap-2 md:col-span-2">
              <span className="magazine-label">简介</span>
              <textarea
                value={profile.summary}
                onChange={(event) => setProfile({ ...profile, summary: event.target.value })}
                className="magazine-input min-h-24 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <h2 className="mb-4 mt-8 border-t border-[#d6b39b] pt-5 text-base font-black">联系方式</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="电话" value={profile.phone} onChange={(phone) => setProfile({ ...profile, phone })} />
            <Field
              label="邮箱"
              value={profile.contactEmail}
              onChange={(contactEmail) => setProfile({ ...profile, contactEmail })}
            />
            <Field
              label="LinkedIn"
              value={profile.linkedin}
              onChange={(linkedin) => setProfile({ ...profile, linkedin })}
            />
            <Field label="GitHub" value={profile.github} onChange={(github) => setProfile({ ...profile, github })} />
            <Field className="md:col-span-2" label="个人网站" value={profile.website} onChange={(website) => setProfile({ ...profile, website })} />
          </div>
          <h2 className="mb-4 mt-8 border-t border-[#d6b39b] pt-5 text-base font-black">求职属性</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="签证 / 工作权限"
              value={profile.workAuthorization}
              onChange={(workAuthorization) => setProfile({ ...profile, workAuthorization })}
            />
            <Field
              label="语言能力"
              value={profile.languages.join(", ")}
              onChange={(languages) => setProfile({ ...profile, languages: csv(languages) })}
            />
          </div>
        </form>

        <form onSubmit={saveExperience} className="desk-slab p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><h2 className="text-lg font-black">{editingId ? "编辑素材纸" : "新增素材纸"}</h2><p className="mt-1 text-sm text-[#7a6457]">补齐来源、职责、成果和可验证指标，再交给 JD 匹配使用。</p></div>
            <button className="magazine-button-dark min-w-20 w-fit whitespace-nowrap px-3 py-2 text-sm">
              {editingId ? "保存修改" : "新增"}
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="magazine-label">类型</span>
              <select
                value={experienceForm.type}
                onChange={(event) => setExperienceForm({ ...experienceForm, type: event.target.value as ExperienceType })}
                className="magazine-input px-3 py-2 text-sm"
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {sectionLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <Field
              inputRef={experienceTitleRef}
              label="标题"
              value={experienceForm.title}
              onChange={(title) => setExperienceForm({ ...experienceForm, title })}
            />
            <Field
              label="组织 / 学校 / 公司"
              value={experienceForm.organization}
              onChange={(organization) => setExperienceForm({ ...experienceForm, organization })}
            />
            <Field
              label="角色 / 岗位"
              value={experienceForm.role}
              onChange={(role) => setExperienceForm({ ...experienceForm, role })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="开始"
                value={experienceForm.startDate}
                onChange={(startDate) => setExperienceForm({ ...experienceForm, startDate })}
              />
              <Field
                label="结束"
                value={experienceForm.endDate}
                onChange={(endDate) => setExperienceForm({ ...experienceForm, endDate })}
              />
            </div>
            <Field
              label="技能"
              value={experienceForm.skills}
              onChange={(skills) => setExperienceForm({ ...experienceForm, skills })}
            />
            <Field label="标签" value={experienceForm.tags} onChange={(tags) => setExperienceForm({ ...experienceForm, tags })} />
            <Field
              label="量化结果"
              value={experienceForm.metrics}
              onChange={(metrics) => setExperienceForm({ ...experienceForm, metrics })}
            />
            <label className="grid gap-2 md:col-span-2">
              <span className="magazine-label">原始描述</span>
              <textarea
                required
                value={experienceForm.rawText}
                onChange={(event) => setExperienceForm({ ...experienceForm, rawText: event.target.value })}
                className="magazine-input min-h-28 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </form>
        {message ? <p className="magazine-panel-quiet px-4 py-3 text-sm font-bold text-[#006b55]">{message}</p> : null}
        </section>

      <section className="space-y-5">
        {typeOptions.map((type) => (
          <div key={type} className="desk-slab p-5">
            <div className="flex items-center justify-between border-b border-[#d6b39b] pb-4">
              <h2 className="text-lg font-black">{sectionLabels[type]}</h2>
              <span className="magazine-chip px-2 py-1">
                {grouped[type].length} 张
              </span>
            </div>
            <div>
              {grouped[type].length === 0 ? (
                <p className="magazine-empty mt-4 p-4 text-sm">
                  暂无内容，可在左侧新增。
                </p>
              ) : (
                grouped[type].map((experience) => (
                  <article key={experience.id} className="desk-row p-4 transition hover:bg-[#fff8ef]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#c72413]">素材来源 · {sectionLabels[experience.type]}</p>
                        <h3 className="mt-1 font-black">{experience.title}</h3>
                        <p className="text-sm text-[#7a6457]">
                          {[experience.organization, experience.role, [experience.startDate, experience.endDate].filter(Boolean).join(" - ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => editExperience(experience)}
                          className="magazine-button-secondary whitespace-nowrap px-3 py-1 text-xs"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveExperience(experience.id)}
                          className="whitespace-nowrap border border-[#e5b8a5] bg-white px-3 py-1 text-xs font-bold text-red-700 transition hover:border-red-400"
                        >
                          归档
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{experience.rawText}</p>
                    <div className="mt-4 border-t border-[#d6b39b] pt-3 text-xs font-bold text-[#7a4a32]">
                      状态：已保存到信息库，可用于 JD 折痕匹配
                    </div>
                    <TagRow label="技能" items={experience.skills} />
                    <TagRow label="标签" items={experience.tags} />
                    <TagRow label="成果" items={experience.metrics} />
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className={`grid min-w-0 gap-2 ${className}`}>
      <span className="magazine-label">{label}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="magazine-input px-3 py-2 text-sm"
      />
    </label>
  );
}

function TagRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-[#7a4a32]">{label}</span>
      {items.map((item) => (
        <span key={item} className="magazine-chip px-2 py-1">
          {item}
        </span>
      ))}
    </div>
  );
}
