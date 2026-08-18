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
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<DraftExperience[]>([]);
  const [loading, setLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
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
    setImportMessage("");
  }

  async function breakdown() {
    setLoading(true);
    setImportMessage(resumeFile ? "正在解析上传文件..." : "正在拆成素材纸...");
    onMessage("");

    const request = resumeFile
      ? {
          method: "POST",
          body: (() => {
            const form = new FormData();
            form.append("resume", resumeFile);
            return form;
          })(),
        }
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rawText }),
        };
    try {
      const response = await fetch("/api/import", request);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = typeof body.error === "string" ? body.error : "AI 拆解失败";
        setImportMessage(error);
        return;
      }
      const experiences = Array.isArray(body.draft?.experiences) ? body.draft.experiences : [];
      setDrafts(experiences);
      setImportMessage(experiences.length > 0 ? `已生成 ${experiences.length} 张素材纸草稿` : "没有解析出可用经历，请换一个文件或粘贴文本。");
    } catch {
      const error = "上传解析请求失败，请检查本地服务或网络后重试。";
      setImportMessage(error);
    } finally {
      setLoading(false);
    }
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
        className="magazine-button-primary px-4 py-2.5 text-sm"
      >
        上传或粘贴简历导入
      </button>
    );
  }

  return (
    <section className="desk-slab p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-black">上传或粘贴简历导入素材纸</h2>
          <p className="text-sm text-[#7a6457]">本地 DOCX 抽取和 AI 文件解析只生成待确认草稿，保存前不会写入正式信息库。</p>
        </div>
        <button
          type="button"
          onClick={closeDialog}
          className="magazine-button-secondary px-3 py-2 text-sm"
        >
          放弃
        </button>
      </div>

      <label className="desk-rail mb-4 grid gap-2 p-4">
        <span className="magazine-label">上传简历文件</span>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,text/plain"
          onChange={(event) => {
            setResumeFile(event.target.files?.[0] ?? null);
            setImportMessage("");
            if (event.target.files?.[0]) setRawText("");
          }}
          className="text-sm text-[#7a6457] file:mr-3 file:rounded-lg file:border-0 file:bg-[#c72413] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
        />
        <span className="text-xs leading-5 text-[#7a6457]">
          DOCX 会先本地抽正文；PDF 会读取文字和页面视觉；图片会走视觉解析。解析结果需要你逐条确认。
        </span>
        {resumeFile ? (
          <span className="magazine-chip w-fit px-2 py-1">
            已选择：{resumeFile.name}
          </span>
        ) : null}
      </label>

      <label className="grid gap-2">
        <span className="magazine-label">原始经历文本</span>
        <textarea
          value={rawText}
          onChange={(event) => {
            setRawText(event.target.value);
            setImportMessage("");
            if (event.target.value.trim()) setResumeFile(null);
          }}
          className="magazine-input min-h-32 px-3 py-2 text-sm"
          placeholder="例如：Built an ABSA project with BERT..."
        />
      </label>
      <button
        type="button"
        onClick={breakdown}
        disabled={loading || (!rawText.trim() && !resumeFile)}
        className="magazine-button-primary mt-3 px-4 py-2.5 text-sm disabled:opacity-50"
      >
        {loading ? "拆解中..." : resumeFile ? "解析上传文件" : "拆成素材纸"}
      </button>
      {importMessage ? (
        <p className="desk-rail mt-3 px-3 py-2 text-sm font-bold text-[#6a4632]" role="status" aria-live="polite">
          {importMessage}
        </p>
      ) : null}

      {drafts.map((draft, index) => (
        <article key={`${draft.title}-${index}`} className="desk-row mt-5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-black">素材纸草稿 #{index + 1}</h3>
            <button
              type="button"
              onClick={() => saveDraft(index)}
              className="magazine-button-dark px-3 py-2 text-sm"
            >
              保存到信息库
            </button>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="magazine-label">类型</span>
              <select
                value={draft.type}
                onChange={(event) => updateDraft(index, { type: event.target.value as ExperienceType })}
                className="magazine-input px-3 py-2 text-sm"
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
              <span className="magazine-label">摘要</span>
              <textarea
                value={draft.summary}
                onChange={(event) => updateDraft(index, { summary: event.target.value })}
                className="magazine-input min-h-24 px-3 py-2 text-sm"
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
              <span className="text-xs font-bold text-[#7a4a32]">待确认</span>
              {draft.pendingClaims.map((claim) => (
                <span key={claim} className="magazine-chip px-2 py-1">
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
      <span className="magazine-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="magazine-input px-3 py-2 text-sm"
      />
    </label>
  );
}
