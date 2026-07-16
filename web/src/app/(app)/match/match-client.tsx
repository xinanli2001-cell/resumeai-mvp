"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type MatchItem = {
  experience: {
    id: string;
    title: string;
    organization?: string;
    role?: string;
    rawText: string;
    skills: string[];
    tags: string[];
  };
  matchScore: number;
  matchReason: string;
  recommended: boolean;
};

type ParsedJd = {
  id: string;
  title: string;
  company: string;
  parsedRequirements: string[];
  parsedSkills: string[];
  parsedKeywords: string[];
  language: string;
};

export function MatchClient() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [jd, setJd] = useState<ParsedJd | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"DEFAULT" | "PACKAGING">("DEFAULT");
  const [languageMode, setLanguageMode] = useState<"ZH" | "EN" | "BILINGUAL">("ZH");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCount = selectedIds.length;
  const chips = useMemo(() => Array.from(new Set([...(jd?.parsedSkills ?? []), ...(jd?.parsedKeywords ?? [])])), [jd]);

  async function parseAndMatch() {
    setLoading(true);
    setMessage("");
    const jdResponse = await fetch("/api/jd", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    if (!jdResponse.ok) {
      const body = await jdResponse.json();
      setMessage(body.error ?? "JD 解析失败");
      setLoading(false);
      return;
    }
    const jdBody = await jdResponse.json();
    const jobDescription = jdBody.jobDescription;
    const matchResponse = await fetch("/api/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jdId: jobDescription.id }),
    });
    setLoading(false);
    if (!matchResponse.ok) {
      const body = await matchResponse.json();
      setMessage(body.error ?? "匹配失败");
      return;
    }
    const matchBody = await matchResponse.json();
    setJd({
      id: jobDescription.id,
      title: jobDescription.title,
      company: jobDescription.company,
      parsedRequirements: jobDescription.parsedRequirements,
      parsedSkills: jobDescription.parsedSkills,
      parsedKeywords: jobDescription.parsedKeywords,
      language: jobDescription.language,
    });
    setMatches(matchBody.matches);
    setSelectedIds(
      matchBody.matches
        .filter((item: MatchItem) => item.recommended)
        .map((item: MatchItem) => item.experience.id),
    );
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function enablePackaging() {
    const ok = window.confirm("包装模式会强化表达，但仍需要你额外核对真实性。确认开启？");
    if (ok) setMode("PACKAGING");
  }

  async function generateRewrite() {
    if (!jd || selectedIds.length === 0) return;
    setMessage("");
    const response = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jdId: jd.id,
        selectedExperienceIds: selectedIds,
        mode,
        languageMode,
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "生成改写失败");
      return;
    }
    const body = await response.json();
    router.push(`/rewrite/${body.sessionId}`);
  }

  return (
    <div className="grid gap-5 p-5 md:p-8 xl:grid-cols-[400px_1fr]">
      <section className="space-y-5">
        <div className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">Target Role</p>
          <h2 className="mt-1 text-base font-semibold">JD 输入</h2>
          <p className="mt-1 text-sm text-[#52637a]">解析会消耗 1 个额度，匹配阶段不调用 LLM。</p>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            className="mt-4 min-h-64 w-full border border-[#cbdaf2] bg-[#f8faff] px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
            placeholder="Paste the target job description..."
          />
          <button
            type="button"
            onClick={parseAndMatch}
            disabled={loading || !rawText.trim()}
            className="mt-3 bg-[#004ac6] px-3 py-2 text-sm font-semibold text-white hover:bg-[#003a9d] disabled:opacity-50"
          >
            {loading ? "解析中..." : "解析并匹配"}
          </button>
        </div>

        <div className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">Rewrite Setup</p>
          <h2 className="mt-1 text-base font-semibold">改写设置</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#52637a]">语言</span>
              <select
                value={languageMode}
                onChange={(event) => setLanguageMode(event.target.value as typeof languageMode)}
                className="border border-[#cbdaf2] bg-[#f8faff] px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
              >
                <option value="ZH">中文</option>
                <option value="EN">英文</option>
                <option value="BILINGUAL">双语</option>
              </select>
            </label>
            <div className="flex items-center justify-between border border-[#d9e4f7] bg-[#f8faff] px-3 py-2">
              <div>
                <p className="text-sm font-semibold">包装模式</p>
                <p className="text-xs text-[#52637a]">默认关闭；开启前需要真实性确认。</p>
              </div>
              <button
                type="button"
                onClick={() => (mode === "PACKAGING" ? setMode("DEFAULT") : enablePackaging())}
                className="bg-[#0b1c30] px-3 py-2 text-xs font-semibold text-white hover:bg-[#24364d]"
              >
                {mode === "PACKAGING" ? "已开启" : "开启"}
              </button>
            </div>
          </div>
        </div>
        {message ? <p className="border border-[#b9d0ff] bg-[#eff4ff] px-4 py-3 text-sm text-[#003a9d]">{message}</p> : null}
      </section>

      <section className="space-y-5">
        {jd ? (
          <div className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">{jd.title || "Parsed JD"}</h2>
            <p className="text-sm text-[#52637a]">Language: {jd.language}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span key={chip} className="bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#004ac6]">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">推荐经历</h2>
            <button
              type="button"
              onClick={generateRewrite}
              disabled={!jd || selectedCount === 0}
              className="bg-[#004ac6] px-3 py-2 text-sm font-semibold text-white hover:bg-[#003a9d] disabled:opacity-50"
            >
              生成改写 ({selectedCount})
            </button>
          </div>
          <div className="grid gap-3">
            {matches.length === 0 ? (
              <p className="border border-dashed border-[#b9d0ff] bg-[#f8faff] p-4 text-sm text-[#52637a]">
                输入 JD 后会显示推荐与可手动选择的经历。
              </p>
            ) : (
              matches.map((item) => (
                <label
                  key={item.experience.id}
                  className={`block border p-4 ${
                    item.recommended ? "border-[#90b6ff] bg-[#eff4ff]" : "border-[#d9e4f7] bg-[#f8faff]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.experience.id)}
                      onChange={() => toggleSelected(item.experience.id)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold">{item.experience.title}</p>
                      <p className="text-sm text-[#52637a]">{item.matchReason}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{item.experience.rawText}</p>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
