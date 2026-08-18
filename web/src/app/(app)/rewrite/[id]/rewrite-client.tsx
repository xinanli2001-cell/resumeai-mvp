"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Block = {
  id: string;
  originalSnapshot: {
    title: string;
    organization: string;
    role: string;
    rawText: string;
    skills: string[];
    tags: string[];
    metrics: string[];
  };
  matchReason: string;
  matchScore: number;
  rewrittenText: string;
  pendingClaims: string[];
  userEditedText: string;
  decision: "PENDING" | "ACCEPTED" | "EDITED" | "REJECTED";
};

type SessionDetail = {
  id: string;
  mode: "DEFAULT" | "PACKAGING";
  languageMode: "ZH" | "EN" | "BILINGUAL";
  canProceed: boolean;
  jd: {
    title: string;
    company: string;
    rawText: string;
    requirements: string[];
    skills: string[];
    keywords: string[];
  };
  blocks: Block[];
};

export function RewriteClient({ initialSession }: { initialSession: SessionDetail }) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [creatingResume, setCreatingResume] = useState(false);
  const jdChips = Array.from(new Set([...session.jd.skills, ...session.jd.keywords]));

  async function patchDecision(blockId: string, decision: "ACCEPTED" | "EDITED" | "REJECTED") {
    const response = await fetch(`/api/rewrite/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        blockId,
        decision,
        userEditedText: editing[blockId],
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "保存确认状态失败");
      return;
    }
    const body = await response.json();
    setSession((current) => {
      const blocks = current.blocks.map((block) => (block.id === blockId ? body.block : block));
      return {
        ...current,
        blocks,
        canProceed: blocks.some((block) => block.decision === "ACCEPTED" || block.decision === "EDITED"),
      };
    });
    setMessage("确认状态已保存");
  }

  async function enterResumeEditor() {
    if (!session.canProceed) return;
    setCreatingResume(true);
    setMessage("");
    const response = await fetch("/api/resumes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    });
    setCreatingResume(false);
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "创建简历失败");
      return;
    }
    const body = await response.json();
    router.push(`/resume/${body.resumeId}`);
  }

  return (
    <div className="space-y-5 p-5 md:p-8">
      <section className="desk-slab p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="magazine-rule mb-4 h-1 w-24 rounded-full" />
            <h2 className="text-2xl font-black">{session.jd.title || "目标 JD 折痕"}</h2>
            <p className="mt-1 text-sm text-[#7a6457]">
              折叠模式：{session.mode === "PACKAGING" ? "包装模式" : "默认模式"} · 语言：{session.languageMode}
            </p>
          </div>
          <button
            type="button"
            onClick={enterResumeEditor}
            disabled={!session.canProceed || creatingResume}
            className="magazine-button-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            title={!session.canProceed ? "至少确认或编辑一段经历后才能进入简历编辑" : "进入简历编辑"}
          >
            {creatingResume ? "创建中..." : "折成简历草稿"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {jdChips.map((item) => (
            <span key={item} className="magazine-chip px-2 py-1">
              {item}
            </span>
          ))}
        </div>
      </section>

      {message ? <p className="desk-row px-0 py-3 text-sm font-bold text-[#006b55]">{message}</p> : null}

      {session.blocks.map((block, index) => (
        <article key={block.id} className="desk-slab p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d6b39b] pb-4">
            <div>
              <p className="text-xs font-black text-[#c72413]">素材纸 #{index + 1}</p>
              <h3 className="mt-1 text-lg font-black">{block.originalSnapshot.title}</h3>
              <p className="text-sm text-[#7a6457]">折痕原因：{block.matchReason}</p>
            </div>
            <span className="magazine-chip px-2 py-1">
              {block.decision}
            </span>
          </div>

          <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-[#d6b39b]">
            <section className="py-4 xl:pr-5">
              <h4 className="text-sm font-black">原始素材快照</h4>
              <p className="mt-2 text-sm text-[#7a6457]">
                {[block.originalSnapshot.organization, block.originalSnapshot.role].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{block.originalSnapshot.rawText}</p>
            </section>
            <section className="border-t border-[#d6b39b] py-4 xl:border-t-0 xl:pl-5">
              <h4 className="text-sm font-black text-[#006b55]">AI 折叠建议</h4>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{block.rewrittenText || "生成失败，请稍后重试。"}</p>
              {block.pendingClaims.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#7a4a32]">待确认</span>
                  {block.pendingClaims.map((claim) => (
                    <span key={claim} className="magazine-chip px-2 py-1 text-xs font-bold text-[#9f2617]">
                      {claim}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className="border-y border-[#c99573] bg-[#f2d9c8]/35 p-4">
            <label className="grid gap-2">
              <span className="text-sm font-black">用户确认版本（编辑后才会写入简历纸面）</span>
              <textarea
                value={editing[block.id] ?? block.userEditedText ?? block.rewrittenText}
                onChange={(event) => setEditing((current) => ({ ...current, [block.id]: event.target.value }))}
                className="magazine-input min-h-28 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => patchDecision(block.id, "ACCEPTED")}
              className="magazine-button-dark px-3 py-2 text-sm"
            >
              确认采用
            </button>
            <button
              type="button"
              onClick={() => patchDecision(block.id, "EDITED")}
              className="magazine-button-primary px-3 py-2 text-sm"
            >
              保存我的版本
            </button>
            <button
              type="button"
              onClick={() => patchDecision(block.id, "REJECTED")}
              className="border border-[#e5b8a5] bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:border-red-400"
            >
              拒绝
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
