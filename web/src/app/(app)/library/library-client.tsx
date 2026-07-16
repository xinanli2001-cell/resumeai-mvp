"use client";

import { FormEvent, useMemo, useState } from "react";
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

  const grouped = useMemo(
    () =>
      typeOptions.reduce<Record<ExperienceType, ExperienceItem[]>>(
        (acc, type) => ({ ...acc, [type]: experiences.filter((item) => item.type === type) }),
        { EDUCATION: [], PROJECT: [], INTERNSHIP: [], WORK: [], SKILL: [] },
      ),
    [experiences],
  );

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

  return (
    <div className="grid gap-5 p-5 md:p-8 xl:grid-cols-[minmax(340px,400px)_1fr]">
      <section className="space-y-6">
        <ImportDialog
          onSaved={(experience) => setExperiences((current) => [experience, ...current])}
          onMessage={setMessage}
        />

        <form onSubmit={saveProfile} className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">Profile</p><h2 className="mt-1 text-base font-semibold">基本信息</h2></div>
            <button className="bg-[#004ac6] px-3 py-2 text-sm font-semibold text-white hover:bg-[#003a9d]">保存档案</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field className="md:col-span-2" label="姓名" value={profile.name} onChange={(name) => setProfile({ ...profile, name })} />
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
              <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">简介</span>
              <textarea
                value={profile.summary}
                onChange={(event) => setProfile({ ...profile, summary: event.target.value })}
                className="min-h-24 border border-[#cbdaf2] bg-[#f8faff] px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
              />
            </label>
          </div>
          <h2 className="mb-4 mt-8 text-base font-semibold">联系方式</h2>
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
            <Field label="个人网站" value={profile.website} onChange={(website) => setProfile({ ...profile, website })} />
          </div>
          <h2 className="mb-4 mt-8 text-base font-semibold">求职属性</h2>
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

        <form onSubmit={saveExperience} className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">Experience</p><h2 className="mt-1 text-base font-semibold">{editingId ? "编辑经历块" : "新增经历块"}</h2></div>
            <button className="bg-[#0b1c30] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24364d]">
              {editingId ? "保存修改" : "新增"}
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">类型</span>
              <select
                value={experienceForm.type}
                onChange={(event) => setExperienceForm({ ...experienceForm, type: event.target.value as ExperienceType })}
                className="border border-[#cbdaf2] bg-[#f8faff] px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {sectionLabels[type]}
                  </option>
                ))}
              </select>
            </label>
            <Field
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
              <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">原始描述</span>
              <textarea
                required
                value={experienceForm.rawText}
                onChange={(event) => setExperienceForm({ ...experienceForm, rawText: event.target.value })}
                className="min-h-28 border border-[#cbdaf2] bg-[#f8faff] px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
              />
            </label>
          </div>
        </form>
        {message ? <p className="border border-[#b9d0ff] bg-[#eff4ff] px-4 py-3 text-sm text-[#003a9d]">{message}</p> : null}
      </section>

      <section className="space-y-5">
        {typeOptions.map((type) => (
          <div key={type} className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{sectionLabels[type]}</h2>
              <span className="bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#004ac6]">
                {grouped[type].length} blocks
              </span>
            </div>
            <div className="grid gap-3">
              {grouped[type].length === 0 ? (
                <p className="border border-dashed border-[#b9d0ff] bg-[#f8faff] p-4 text-sm text-[#52637a]">
                  暂无内容，可在左侧新增。
                </p>
              ) : (
                grouped[type].map((experience) => (
                  <article key={experience.id} className="border border-[#d9e4f7] bg-[#f8faff] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#004ac6]">{sectionLabels[experience.type]}</p>
                        <h3 className="mt-1 font-semibold">{experience.title}</h3>
                        <p className="text-sm text-[#52637a]">
                          {[experience.organization, experience.role, [experience.startDate, experience.endDate].filter(Boolean).join(" - ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editExperience(experience)}
                          className="border border-[#cbdaf2] bg-white px-3 py-1 text-xs font-semibold text-[#33435b] hover:border-[#004ac6] hover:text-[#004ac6]"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveExperience(experience.id)}
                          className="border border-[#cbdaf2] bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:border-red-300"
                        >
                          归档
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm">{experience.rawText}</p>
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
  );
}

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-[#cbdaf2] bg-[#f8faff] px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
      />
    </label>
  );
}

function TagRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-[#52637a]">{label}</span>
      {items.map((item) => (
        <span key={item} className="bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#004ac6]">
          {item}
        </span>
      ))}
    </div>
  );
}
