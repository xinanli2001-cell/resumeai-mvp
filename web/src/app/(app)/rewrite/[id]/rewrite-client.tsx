"use client";

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
  const [session, setSession] = useState(initialSession);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

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

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">Rewrite Review</p>
            <h2 className="mt-1 text-lg font-semibold">{session.jd.title || "目标 JD"}</h2>
            <p className="mt-1 text-sm text-[#565e74]">
              模式：{session.mode === "PACKAGING" ? "包装模式" : "默认模式"} · 语言：{session.languageMode}
            </p>
          </div>
          <button
            type="button"
            disabled={!session.canProceed}
            className="rounded bg-[#855300] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            title={!session.canProceed ? "至少确认或编辑一段经历后才能进入 Plan 3 简历编辑" : "Plan 3 will implement editor"}
          >
            进入简历编辑
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...session.jd.skills, ...session.jd.keywords].map((item) => (
            <span key={item} className="rounded bg-[#ffddb8] px-2 py-1 text-xs font-semibold text-[#653e00]">
              {item}
            </span>
          ))}
        </div>
      </section>

      {message ? <p className="rounded border border-[#d8c3ad] bg-white px-4 py-3 text-sm">{message}</p> : null}

      {session.blocks.map((block, index) => (
        <article key={block.id} className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">经历块 #{index + 1}</p>
              <h3 className="mt-1 text-base font-semibold">{block.originalSnapshot.title}</h3>
              <p className="text-sm text-[#565e74]">{block.matchReason}</p>
            </div>
            <span className="rounded bg-[#eff4ff] px-2 py-1 text-xs font-semibold text-[#565e74]">
              {block.decision}
            </span>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded border border-[#d8c3ad] bg-[#f8f9ff] p-4">
              <h4 className="text-sm font-semibold">原始经历快照</h4>
              <p className="mt-2 text-sm text-[#565e74]">
                {[block.originalSnapshot.organization, block.originalSnapshot.role].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{block.originalSnapshot.rawText}</p>
            </section>
            <section className="rounded border border-[#f59e0b] bg-[#fff7ed] p-4">
              <h4 className="text-sm font-semibold">AI 原始建议</h4>
              <p className="mt-3 whitespace-pre-wrap text-sm">{block.rewrittenText || "生成失败，请稍后重试。"}</p>
              {block.pendingClaims.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-[#565e74]">待确认</span>
                  {block.pendingClaims.map((claim) => (
                    <span key={claim} className="rounded bg-[#ffddb8] px-2 py-1 text-xs font-semibold text-[#653e00]">
                      {claim}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className="mt-4 rounded border border-[#d8c3ad] bg-[#f8f9ff] p-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">用户确认版本（编辑后保存为 EDITED）</span>
              <textarea
                value={editing[block.id] ?? block.userEditedText ?? block.rewrittenText}
                onChange={(event) => setEditing((current) => ({ ...current, [block.id]: event.target.value }))}
                className="min-h-28 rounded border border-[#d8c3ad] bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => patchDecision(block.id, "ACCEPTED")}
              className="rounded bg-[#0f172a] px-3 py-2 text-sm font-semibold text-white"
            >
              确认
            </button>
            <button
              type="button"
              onClick={() => patchDecision(block.id, "EDITED")}
              className="rounded bg-[#855300] px-3 py-2 text-sm font-semibold text-white"
            >
              保存编辑
            </button>
            <button
              type="button"
              onClick={() => patchDecision(block.id, "REJECTED")}
              className="rounded border border-[#d8c3ad] bg-white px-3 py-2 text-sm font-semibold text-red-700"
            >
              拒绝
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
