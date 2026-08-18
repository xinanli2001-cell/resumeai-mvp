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
    <main className="min-h-screen career-surface px-5 py-8 text-[#1c1714] sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-stretch lg:p-0">
      <section className="hidden border-r border-[#d6b39b] bg-[#1c1714] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f2d9c8] text-sm font-black text-[#1c1714]">
          R
        </div>
        <div className="max-w-xl">
          <div className="magazine-rule mb-6 h-1 w-32 rounded-full" />
          <h1 className="text-5xl font-black leading-tight">从素材纸到投递版本，一处完成。</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/72">
            把经历、职位要求与版本管理折成能持续复用的求职工作流。
          </p>
        </div>
        <p className="text-sm font-bold text-[#f2d9c8]">ResumeAI Folded Materials</p>
      </section>
      <section className="mx-auto flex w-full max-w-md items-center py-10 lg:max-w-none lg:px-16 xl:px-24">
        <div className="desk-slab w-full p-6 md:p-8">
          <div className="mb-9 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f2d9c8] text-sm font-black text-[#1c1714]">
              R
            </div>
          </div>
          <div className="mb-8">
            <h1 className="text-3xl font-black">创建你的工作台</h1>
            <p className="mt-2 text-sm text-[#7a6457]">建立账号后即可开始整理素材纸和目标岗位版本。</p>
          </div>
          <form onSubmit={onSubmit} aria-busy={busy} className="space-y-5">
            <label className="block">
              <span className="magazine-label">邮箱</span>
              <input
                name="email"
                aria-label="Email Address"
                type="email"
                required
                placeholder="you@example.com"
                className="magazine-input mt-2 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="magazine-label">密码</span>
              <input
                name="password"
                aria-label="Password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="magazine-input mt-2 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="magazine-label">
                {invitationRequired ? "邀请码" : "邀请码（可选）"}
              </span>
              <input
                name="invitationCode"
                aria-label="邀请码"
                required={invitationRequired}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder={invitationRequired ? "请输入内测邀请码" : "有邀请码可在此兑换额外额度"}
                className="magazine-input mt-2 px-3 py-2.5 text-sm uppercase"
              />
              <span className="mt-2 block text-xs leading-5 text-[#7a6457]">
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
              className="magazine-button-primary w-full px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "创建中..." : "创建账号"}
            </button>
          </form>
          <p className="mt-8 text-sm text-[#7a6457]">
            已有账号？{" "}
            <Link href="/login" className="font-bold text-[#c72413] hover:underline">
              登录
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
