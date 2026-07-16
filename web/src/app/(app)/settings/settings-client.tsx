"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SettingsClient() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"data" | "account" | null>(null);

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
      <section className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#004ac6]">Settings</p>
        <h2 className="mt-1 text-lg font-semibold">账号与隐私</h2>
        <p className="mt-2 text-sm text-[#52637a]">管理你的资料数据和账号状态。</p>
      </section>

      {message ? <p className="border border-[#b9d0ff] bg-[#eff4ff] px-4 py-3 text-sm text-[#003a9d]">{message}</p> : null}

      <section className="border border-[#d9e4f7] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold">删除我的资料数据</h3>
        <p className="mt-2 text-sm text-[#52637a]">
          清空个人档案内容、经历、JD、改写记录、简历和我的模板，账号仍会保留。
        </p>
        <button
          type="button"
          onClick={deleteData}
          disabled={busy !== null}
          className="mt-4 bg-[#004ac6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003a9d] disabled:opacity-50"
        >
          {busy === "data" ? "删除中..." : "删除我的资料数据"}
        </button>
      </section>

      <section className="border border-red-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-red-800">注销账号</h3>
        <p className="mt-2 text-sm text-[#52637a]">删除账号和与该账号关联的全部数据，并立即退出登录。</p>
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
