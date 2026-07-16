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
      <section className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#004ac6]">Rewrite Review</p>
            <h2 className="mt-1 text-lg font-semibold">{session.jd.title || "目标 JD"}</h2>
            <p className="mt-1 text-sm text-[#52637a]">
              模式：{session.mode === "PACKAGING" ? "包装模式" : "默认模式"} · 语言：{session.languageMode}
            </p>
          </div>
          <button
            type="button"
            onClick={enterResumeEditor}
            disabled={!session.canProceed || creatingResume}
            className="bg-[#004ac6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003a9d] disabled:cursor-not-allowed disabled:opacity-40"
            title={!session.canProceed ? "至少确认或编辑一段经历后才能进入简历编辑" : "进入简历编辑"}
          >
            {creatingResume ? "创建中..." : "进入简历编辑"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {jdChips.map((item) => (
            <span key={item} className="bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#004ac6]">
              {item}
            </span>
          ))}
        </div>
      </section>

      {message ? <p className="border border-[#b9d0ff] bg-[#eff4ff] px-4 py-3 text-sm text-[#003a9d]">{message}</p> : null}

      {session.blocks.map((block, index) => (
        <article key={block.id} className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#004ac6]">经历块 #{index + 1}</p>
              <h3 className="mt-1 text-base font-semibold">{block.originalSnapshot.title}</h3>
              <p className="text-sm text-[#52637a]">{block.matchReason}</p>
            </div>
            <span className="bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#004ac6]">
              {block.decision}
            </span>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="border border-[#d9e4f7] bg-[#f8faff] p-4">
              <h4 className="text-sm font-semibold">原始经历快照</h4>
              <p className="mt-2 text-sm text-[#52637a]">
                {[block.originalSnapshot.organization, block.originalSnapshot.role].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{block.originalSnapshot.rawText}</p>
            </section>
            <section className="border border-[#90b6ff] bg-[#eff4ff] p-4">
              <h4 className="text-sm font-semibold">AI 原始建议</h4>
              <p className="mt-3 whitespace-pre-wrap text-sm">{block.rewrittenText || "生成失败，请稍后重试。"}</p>
              {block.pendingClaims.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-[#52637a]">待确认</span>
                  {block.pendingClaims.map((claim) => (
                    <span key={claim} className="bg-white px-2 py-1 text-xs font-semibold text-[#004ac6]">
                      {claim}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className="mt-4 border border-[#d9e4f7] bg-[#f8faff] p-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">用户确认版本（编辑后保存为 EDITED）</span>
              <textarea
                value={editing[block.id] ?? block.userEditedText ?? block.rewrittenText}
                onChange={(event) => setEditing((current) => ({ ...current, [block.id]: event.target.value }))}
                className="min-h-28 border border-[#cbdaf2] bg-white px-3 py-2 text-sm outline-none focus:border-[#004ac6]"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => patchDecision(block.id, "ACCEPTED")}
              className="bg-[#0b1c30] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24364d]"
            >
              确认
            </button>
            <button
              type="button"
              onClick={() => patchDecision(block.id, "EDITED")}
              className="bg-[#004ac6] px-3 py-2 text-sm font-semibold text-white hover:bg-[#003a9d]"
            >
              保存编辑
            </button>
            <button
              type="button"
              onClick={() => patchDecision(block.id, "REJECTED")}
              className="border border-[#cbdaf2] bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:border-red-300"
            >
              拒绝
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
