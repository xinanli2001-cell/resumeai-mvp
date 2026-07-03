"use client";

import { FormEvent, useMemo, useState } from "react";

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
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(360px,420px)_1fr]">
      <section className="space-y-6">
        <form onSubmit={saveProfile} className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold">基本信息</h2>
            <button className="rounded bg-[#855300] px-3 py-2 text-sm font-semibold text-white">保存档案</button>
          </div>
          <div className="grid gap-4">
            <Field label="姓名" value={profile.name} onChange={(name) => setProfile({ ...profile, name })} />
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
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">简介</span>
              <textarea
                value={profile.summary}
                onChange={(event) => setProfile({ ...profile, summary: event.target.value })}
                className="min-h-24 rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <h2 className="mb-4 mt-8 text-base font-semibold">联系方式</h2>
          <div className="grid gap-4">
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
          <div className="grid gap-4">
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

        <form onSubmit={saveExperience} className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold">{editingId ? "编辑经历块" : "新增经历块"}</h2>
            <button className="rounded bg-[#0f172a] px-3 py-2 text-sm font-semibold text-white">
              {editingId ? "保存修改" : "新增"}
            </button>
          </div>
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">类型</span>
              <select
                value={experienceForm.type}
                onChange={(event) => setExperienceForm({ ...experienceForm, type: event.target.value as ExperienceType })}
                className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
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
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#565e74]">原始描述</span>
              <textarea
                required
                value={experienceForm.rawText}
                onChange={(event) => setExperienceForm({ ...experienceForm, rawText: event.target.value })}
                className="min-h-28 rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm"
              />
            </label>
          </div>
        </form>
        {message ? <p className="rounded border border-[#d8c3ad] bg-white px-4 py-3 text-sm">{message}</p> : null}
      </section>

      <section className="space-y-5">
        {typeOptions.map((type) => (
          <div key={type} className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{sectionLabels[type]}</h2>
              <span className="rounded bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#565e74]">
                {grouped[type].length} blocks
              </span>
            </div>
            <div className="grid gap-3">
              {grouped[type].length === 0 ? (
                <p className="rounded border border-dashed border-[#d8c3ad] bg-[#f8f9ff] p-4 text-sm text-[#565e74]">
                  暂无内容，可在左侧新增。
                </p>
              ) : (
                grouped[type].map((experience) => (
                  <article key={experience.id} className="rounded border border-[#d8c3ad] bg-[#f8f9ff] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">{sectionLabels[experience.type]}</p>
                        <h3 className="mt-1 font-semibold">{experience.title}</h3>
                        <p className="text-sm text-[#565e74]">
                          {[experience.organization, experience.role, [experience.startDate, experience.endDate].filter(Boolean).join(" - ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editExperience(experience)}
                          className="rounded border border-[#d8c3ad] bg-white px-3 py-1 text-xs font-semibold"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveExperience(experience.id)}
                          className="rounded border border-[#d8c3ad] bg-white px-3 py-1 text-xs font-semibold text-red-700"
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

function TagRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-[#565e74]">{label}</span>
      {items.map((item) => (
        <span key={item} className="rounded bg-[#ffddb8] px-2 py-1 text-xs font-semibold text-[#653e00]">
          {item}
        </span>
      ))}
    </div>
  );
}
