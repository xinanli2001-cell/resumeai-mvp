"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type InvitationSummary = {
  quotaLimit: number;
  quotaUsed: number;
  remaining: number;
  redemptions: Array<{ bonusQuota: number; redeemedAt: string }>;
};

export function SettingsClient() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"invitation" | "data" | "account" | null>(null);
  const [invitationCode, setInvitationCode] = useState("");
  const [invitationMessage, setInvitationMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [invitationSummary, setInvitationSummary] = useState<InvitationSummary | null>(null);
  const summaryRequestVersion = useRef(0);

  const loadInvitationSummary = useCallback(async (reportError = true) => {
    const requestVersion = summaryRequestVersion.current + 1;
    summaryRequestVersion.current = requestVersion;

    try {
      const response = await fetch("/api/invitations/me");
      if (!response.ok) throw new Error("Invitation summary request failed");
      const summary = (await response.json()) as InvitationSummary;
      if (summaryRequestVersion.current === requestVersion) {
        setInvitationSummary(summary);
      }
      return summary;
    } catch {
      if (reportError && summaryRequestVersion.current === requestVersion) {
        setInvitationMessage({ kind: "error", text: "无法读取改写额度，请稍后重试" });
      }
      return null;
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadInvitationSummary());
    return () => {
      summaryRequestVersion.current += 1;
    };
  }, [loadInvitationSummary]);

  async function redeemInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("invitation");
    setInvitationMessage(null);
    summaryRequestVersion.current += 1;

    try {
      const response = await fetch("/api/invitations/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: invitationCode }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setInvitationMessage({ kind: "error", text: body.error ?? "邀请码兑换失败" });
        return;
      }

      setInvitationSummary((current) => ({
        quotaLimit: body.quotaLimit,
        quotaUsed: body.quotaUsed,
        remaining: body.remaining,
        redemptions: current?.redemptions ?? [],
      }));
      setInvitationCode("");
      await loadInvitationSummary(false);
      setInvitationMessage({
        kind: "success",
        text: `邀请码已兑换，当前可用 ${body.remaining} 次改写额度`,
      });
    } catch {
      setInvitationMessage({ kind: "error", text: "邀请码兑换失败，请检查网络后重试" });
    } finally {
      setBusy(null);
    }
  }

  async function deleteData() {
    const ok = window.confirm("确认删除你的资料数据？账号会保留，但信息库、JD、改写和简历会被清空。");
    if (!ok) return;
    setBusy("data");
    setMessage("");
    const response = await fetch("/api/account/data", { method: "DELETE" });
    setBusy(null);
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "资料数据删除失败");
      return;
    }
    setMessage("资料数据已删除");
    router.refresh();
  }

  async function deleteAccount() {
    const ok = window.confirm("确认注销账号？该操作会删除账号并退出登录。");
    if (!ok) return;
    setBusy("account");
    setMessage("");
    const response = await fetch("/api/account", { method: "DELETE" });
    setBusy(null);
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "账号注销失败");
      return;
    }
    router.replace("/login");
  }

  return (
    <div className="space-y-5 p-5 md:p-8">
      <section className="desk-slab p-5">
        <div className="magazine-rule mb-4 h-1 w-24 rounded-full" />
        <h2 className="text-2xl font-black">账号与隐私纸面</h2>
        <p className="mt-2 text-sm text-[#7a6457]">管理你的素材纸、改写额度和账号状态。</p>
      </section>

      {message ? <p className="desk-row px-0 py-3 text-sm font-bold text-[#006b55]">{message}</p> : null}

      <section className="desk-slab p-5">
        <h3 className="text-lg font-black">兑换邀请码</h3>
        <p className="mt-2 text-sm leading-6 text-[#7a6457]">
          输入有效邀请码以增加 AI 改写额度。每个邀请码每个账号只能兑换一次。
        </p>
        <p className="mt-3 text-sm font-semibold text-[#6a4632]" role="status" aria-live="polite">
          {invitationSummary
            ? `当前可用 ${invitationSummary.remaining} 次改写额度`
            : "正在读取改写额度..."}
        </p>
        <form
          onSubmit={redeemInvitation}
          aria-busy={busy === "invitation"}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1">
          <span className="magazine-label">邀请码</span>
            <input
              aria-label="邀请码"
              value={invitationCode}
              onChange={(event) => setInvitationCode(event.target.value)}
              required
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="BETA-XXXX"
              className="magazine-input mt-2 px-3 py-2.5 text-sm uppercase"
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null}
            className="magazine-button-primary w-full shrink-0 px-4 py-2.5 text-sm disabled:opacity-50 sm:w-auto"
          >
            {busy === "invitation" ? "兑换中..." : "兑换邀请码"}
          </button>
        </form>
        {invitationMessage ? (
          <p
            role={invitationMessage.kind === "error" ? "alert" : "status"}
            aria-live={invitationMessage.kind === "error" ? "assertive" : "polite"}
            className={`mt-3 border px-3 py-2 text-sm ${
              invitationMessage.kind === "success"
                ? "border-[#cce7dd] bg-[#e4f7f1] text-[#006b55]"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {invitationMessage.text}
          </p>
        ) : null}
      </section>

      <section className="desk-slab p-5">
        <h3 className="text-base font-black">删除我的资料数据</h3>
        <p className="mt-2 text-sm text-[#7a6457]">
          清空个人档案内容、经历、JD、改写记录、简历和我的模板，账号仍会保留。
        </p>
        <button
          type="button"
          onClick={deleteData}
          disabled={busy !== null}
          className="magazine-button-primary mt-4 px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy === "data" ? "删除中..." : "删除我的资料数据"}
        </button>
      </section>

      <section className="border-y border-red-200 bg-white/70 p-5">
        <h3 className="text-base font-black text-red-800">注销账号</h3>
        <p className="mt-2 text-sm text-[#7a6457]">删除账号和与该账号关联的全部数据，并立即退出登录。</p>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={busy !== null}
          className="mt-4 bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "account" ? "注销中..." : "注销账号"}
        </button>
      </section>
    </div>
  );
}
