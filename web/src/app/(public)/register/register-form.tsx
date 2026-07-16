"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type RegistrationMode = "open" | "invite_only";

export function RegisterForm({ registrationMode }: { registrationMode: RegistrationMode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const invitationRequired = registrationMode === "invite_only";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const invitationCode = String(form.get("invitationCode") ?? "");

    try {
      const register = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, invitationCode }),
      });
      if (!register.ok) {
        const body = await register.json().catch(() => ({}));
        setError(body.error ?? "Registration failed");
        return;
      }

      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!login.ok) {
        setError("Registered, but automatic login failed");
        return;
      }
      router.push("/library");
    } catch {
      setError("注册请求失败，请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef4ff] px-5 py-8 text-[#10213f] sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-stretch lg:p-0">
      <section className="hidden border-r border-[#cbd8f2] bg-[#1e5bd7] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex h-10 w-10 items-center justify-center border border-white/35 bg-white/10 text-sm font-black">
          R
        </div>
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c9dcff]">Build your story</p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight">从资料库到投递，一处完成。</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#dce8ff]">
            把经历、职位要求与版本管理整理成能持续复用的求职工作流。
          </p>
        </div>
        <p className="text-sm text-[#c9dcff]">ResumeAI</p>
      </section>
      <section className="mx-auto flex w-full max-w-md items-center py-10 lg:max-w-none lg:px-16 xl:px-24">
        <div className="w-full">
          <div className="mb-9 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center bg-[#1e5bd7] text-sm font-black text-white">
              R
            </div>
          </div>
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4972bd]">Get started</p>
            <h1 className="mt-2 text-3xl font-semibold">创建你的工作台</h1>
            <p className="mt-2 text-sm text-[#5d6f8d]">建立账号后即可开始整理和优化简历。</p>
          </div>
          <form onSubmit={onSubmit} aria-busy={busy} className="space-y-5">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[#344b73]">邮箱</span>
              <input
                name="email"
                aria-label="Email Address"
                type="email"
                required
                placeholder="you@example.com"
                className="mt-2 w-full border border-[#b9c9e5] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1e5bd7] focus:ring-2 focus:ring-[#1e5bd7]/15"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[#344b73]">密码</span>
              <input
                name="password"
                aria-label="Password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="mt-2 w-full border border-[#b9c9e5] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1e5bd7] focus:ring-2 focus:ring-[#1e5bd7]/15"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[#344b73]">
                {invitationRequired ? "邀请码" : "邀请码（可选）"}
              </span>
              <input
                name="invitationCode"
                aria-label="邀请码"
                required={invitationRequired}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder={invitationRequired ? "请输入内测邀请码" : "有邀请码可在此兑换额外额度"}
                className="mt-2 w-full border border-[#b9c9e5] bg-white px-3 py-2.5 text-sm uppercase outline-none transition focus:border-[#1e5bd7] focus:ring-2 focus:ring-[#1e5bd7]/15"
              />
              <span className="mt-2 block text-xs leading-5 text-[#697b98]">
                {invitationRequired
                  ? "当前为内测注册，需要有效邀请码才能创建账号。"
                  : "没有邀请码也可以注册；有效邀请码会增加 AI 改写额度。"}
              </span>
            </label>
            {error ? (
              <p className="text-sm text-red-700" role="alert" aria-live="assertive">
                {error}
              </p>
            ) : null}
            <button
              aria-label="Create Account"
              disabled={busy}
              className="w-full bg-[#1e5bd7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1749b2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "创建中..." : "创建账号"}
            </button>
          </form>
          <p className="mt-8 text-sm text-[#5d6f8d]">
            已有账号？{" "}
            <Link href="/login" className="font-semibold text-[#1e5bd7] hover:underline">
              登录
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
