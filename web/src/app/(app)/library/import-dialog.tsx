"use client";

import { useState } from "react";

type ExperienceType = "PROJECT" | "INTERNSHIP" | "WORK" | "EDUCATION" | "SKILL";

type DraftExperience = {
  type: ExperienceType;
  title: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  summary: string;
  responsibilities: string[];
  achievements: string[];
  skills: string[];
  tags: string[];
  pendingClaims: string[];
};

type SavedExperience = {
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

const types: ExperienceType[] = ["PROJECT", "INTERNSHIP", "WORK", "EDUCATION", "SKILL"];

function csv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ImportDialog({
  onSaved,
  onMessage,
  open: controlledOpen,
  onOpenChange,
}: {
  onSaved: (experience: SavedExperience) => void;
  onMessage: (message: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [drafts, setDrafts] = useState<DraftExperience[]>([]);
  const [loading, setLoading] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  function closeDialog() {
    setOpen(false);
    setDrafts([]);
  }

  async function breakdown() {
    setLoading(true);
    onMessage("");
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json();
      onMessage(body.error ?? "AI 拆解失败");
      return;
    }
    const body = await response.json();
    setDrafts(body.draft.experiences);
  }

  async function saveDraft(index: number) {
    const draft = drafts[index];
    const response = await fetch("/api/experiences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: draft.type,
        title: draft.title || "Imported Experience",
        organization: draft.organization,
        role: draft.role,
        startDate: draft.startDate,
        endDate: draft.endDate,
        rawText: [
          draft.summary,
          ...draft.responsibilities.map((item) => `Responsibility: ${item}`),
          ...draft.achievements.map((item) => `Achievement: ${item}`),
        ]
          .filter(Boolean)
          .join("\n"),
        structuredFields: {
          summary: draft.summary,
          responsibilities: draft.responsibilities,
          achievements: draft.achievements,
          pendingClaims: draft.pendingClaims,
        },
        skills: draft.skills,
        tags: draft.tags,
        metrics: [],
      }),
    });
    if (!response.ok) {
      onMessage("保存导入经历失败");
      return;
    }
    const body = await response.json();
    onSaved(body.experience);
    setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    onMessage("导入经历已保存");
  }

  function updateDraft(index: number, patch: Partial<DraftExperience>) {
    setDrafts((current) =>
      current.map((draft, itemIndex) => (itemIndex === index ? { ...draft, ...patch } : draft)),
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-[#b9d0ff] bg-[#eff4ff] px-3 py-2 text-sm font-semibold text-[#004ac6] hover:bg-[#dce9ff]"
      >
        粘贴文本导入
      </button>
    );
  }

  return (
    <section className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">粘贴文本导入</h2>
          <p className="text-sm text-[#52637a]">AI 拆解只生成草稿，保存前不会写入正式信息库。</p>
        </div>
        <button
          type="button"
          onClick={closeDialog}
          className="border border-[#cbdaf2] px-3 py-2 text-sm font-semibold text-[#33435b] hover:border-[#004ac6] hover:text-[#004ac6]"
        >
          放弃
        </button>
      </div>

      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">原始经历文本</span>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          className="min-h-32 border border-[#cbdaf2] bg-[#f8faff] px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
          placeholder="例如：Built an ABSA project with BERT..."
        />
      </label>
      <button
        type="button"
        onClick={breakdown}
        disabled={loading || !rawText.trim()}
        className="mt-3 bg-[#004ac6] px-3 py-2 text-sm font-semibold text-white hover:bg-[#003a9d] disabled:opacity-50"
      >
        {loading ? "拆解中..." : "AI 拆解"}
      </button>

      {drafts.map((draft, index) => (
        <article key={`${draft.title}-${index}`} className="mt-5 border border-[#d9e4f7] bg-[#f8faff] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">拆解草稿 #{index + 1}</h3>
            <button
              type="button"
              onClick={() => saveDraft(index)}
              className="bg-[#0b1c30] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24364d]"
            >
              保存到信息库
            </button>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">类型</span>
              <select
                value={draft.type}
                onChange={(event) => updateDraft(index, { type: event.target.value as ExperienceType })}
                className="border border-[#cbdaf2] bg-white px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <DraftField label="标题" value={draft.title} onChange={(title) => updateDraft(index, { title })} />
            <DraftField
              label="组织"
              value={draft.organization}
              onChange={(organization) => updateDraft(index, { organization })}
            />
            <DraftField label="角色" value={draft.role} onChange={(role) => updateDraft(index, { role })} />
            <div className="grid grid-cols-2 gap-3">
              <DraftField
                label="开始"
                value={draft.startDate}
                onChange={(startDate) => updateDraft(index, { startDate })}
              />
              <DraftField label="结束" value={draft.endDate} onChange={(endDate) => updateDraft(index, { endDate })} />
            </div>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">摘要</span>
              <textarea
                value={draft.summary}
                onChange={(event) => updateDraft(index, { summary: event.target.value })}
                className="min-h-24 border border-[#cbdaf2] bg-white px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
              />
            </label>
            <DraftField
              label="职责"
              value={draft.responsibilities.join(", ")}
              onChange={(value) => updateDraft(index, { responsibilities: csv(value) })}
            />
            <DraftField
              label="成果"
              value={draft.achievements.join(", ")}
              onChange={(value) => updateDraft(index, { achievements: csv(value) })}
            />
            <DraftField
              label="技能"
              value={draft.skills.join(", ")}
              onChange={(value) => updateDraft(index, { skills: csv(value) })}
            />
            <DraftField
              label="标签"
              value={draft.tags.join(", ")}
              onChange={(value) => updateDraft(index, { tags: csv(value) })}
            />
          </div>
          {draft.pendingClaims.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs font-semibold text-[#52637a]">待确认</span>
              {draft.pendingClaims.map((claim) => (
                <span key={claim} className="bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#004ac6]">
                  {claim}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function DraftField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-[#cbdaf2] bg-white px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
      />
    </label>
  );
}
