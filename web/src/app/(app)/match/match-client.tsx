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
  const [rewriting, setRewriting] = useState(false);

  const selectedCount = selectedIds.length;
  const rewriteCostLabel = selectedCount > 0 ? `本次消耗 ${selectedCount} 次改写额度` : "选择素材纸后生成";
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
    if (!jd || selectedIds.length === 0 || rewriting) return;
    setMessage(`正在生成折叠版本，${rewriteCostLabel}...`);
    setRewriting(true);
    try {
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
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof body.error === "string" ? body.error : "生成改写失败");
        return;
      }
      router.push(`/rewrite/${body.sessionId}`);
    } catch {
      setMessage("生成折叠版本请求失败，请稍后重试。");
    } finally {
      setRewriting(false);
    }
  }

  return (
    <div className="grid gap-5 p-5 md:p-8 xl:grid-cols-[420px_1fr]">
      <section className="space-y-5">
        <div className="desk-slab p-5">
          <div className="magazine-rule mb-4 h-1 w-24 rounded-full" />
          <h2 className="text-xl font-black">粘贴目标 JD 折痕</h2>
          <p className="mt-1 text-sm leading-6 text-[#7a6457]">解析会消耗 1 个额度；匹配阶段只用本地规则在素材纸上标出折痕，不额外调用 LLM。</p>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            className="magazine-input mt-4 min-h-64 px-3 py-2 text-sm"
            placeholder="Paste the target job description..."
          />
          <button
            type="button"
            onClick={parseAndMatch}
            disabled={loading || !rawText.trim()}
            className="magazine-button-primary mt-3 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? "解析中..." : "解析折痕并匹配"}
          </button>
        </div>

        <div className="desk-slab p-5">
          <h2 className="text-xl font-black">折叠设置</h2>
          <p className="mt-1 text-sm text-[#7a6457]">先选择语言；包装模式会强化表达，但需要额外真实性确认。</p>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2">
              <span className="magazine-label">语言</span>
              <select
                value={languageMode}
                onChange={(event) => setLanguageMode(event.target.value as typeof languageMode)}
                className="magazine-input px-3 py-2 text-sm"
              >
                <option value="ZH">中文</option>
                <option value="EN">英文</option>
                <option value="BILINGUAL">双语</option>
              </select>
            </label>
            <div className="desk-row flex items-center justify-between px-0 py-3">
              <div>
                <p className="text-sm font-black">包装模式</p>
                <p className="text-xs text-[#7a6457]">默认关闭；开启前需要真实性确认。</p>
              </div>
              <button
                type="button"
                onClick={() => (mode === "PACKAGING" ? setMode("DEFAULT") : enablePackaging())}
                className="magazine-button-dark px-3 py-2 text-xs"
              >
                {mode === "PACKAGING" ? "已开启" : "开启"}
              </button>
            </div>
          </div>
        </div>
        {message ? <p className="desk-row px-0 py-3 text-sm font-bold text-[#006b55]">{message}</p> : null}
      </section>

      <section className="space-y-5">
        {jd ? (
          <div className="desk-slab p-5">
            <h2 className="text-xl font-black">{jd.title || "Parsed JD"}</h2>
            <p className="text-sm text-[#7a6457]">折痕语言：{jd.language}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span key={chip} className="magazine-chip px-2 py-1">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="desk-slab p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">可折向该岗位的素材纸</h2>
              <p className="mt-1 text-xs font-bold text-[#7a4a32]">{rewriteCostLabel}</p>
            </div>
            <button
              type="button"
              onClick={generateRewrite}
              disabled={!jd || selectedCount === 0 || rewriting}
              className="magazine-button-primary px-3 py-2 text-sm disabled:opacity-50"
            >
              {rewriting ? "生成中..." : `生成折叠版本 (${selectedCount})`}
            </button>
          </div>
          <div className="grid gap-3">
            {matches.length === 0 ? (
              <p className="magazine-empty p-4 text-sm">
                输入 JD 后会显示推荐素材纸、匹配原因和可手动选择的经历。
              </p>
            ) : (
              matches.map((item) => (
                <label
                  key={item.experience.id}
                  className={`desk-row block p-4 transition hover:bg-[#fff8ef] ${
                    item.recommended ? "border-[#008766] bg-[#e4f7f1]" : "border-[#d6b39b] bg-[#fffdf8]"
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
                      <p className="font-black">{item.experience.title}</p>
                      <p className="text-sm text-[#7a6457]">折痕原因：{item.matchReason}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.experience.rawText}</p>
                      <p className="mt-3 border-t border-[#d6b39b] pt-3 text-xs font-bold text-[#7a4a32]">
                        匹配分：{item.matchScore} · {item.recommended ? "建议纳入第一版" : "可手动选择"}
                      </p>
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
