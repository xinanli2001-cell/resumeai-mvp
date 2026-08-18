"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Login failed");
      return;
    }
    router.push("/library");
  }

  return (
    <main className="min-h-screen career-surface px-5 py-8 text-[#1c1714] sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-stretch lg:p-0">
      <section className="hidden border-r border-[#d6b39b] bg-[#1c1714] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f2d9c8] text-sm font-black text-[#1c1714]">R</div>
        <div className="max-w-xl">
          <div className="magazine-rule mb-6 h-1 w-32 rounded-full" />
          <h1 className="text-5xl font-black leading-tight">把真实经历折向目标岗位。</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/72">集中管理素材纸，用 JD 标出折痕，确认每段 AI 建议后再装订成 A4 简历。</p>
        </div>
        <p className="text-sm font-bold text-[#f2d9c8]">ResumeAI Folded Materials</p>
      </section>
      <section className="mx-auto flex w-full max-w-md items-center py-10 lg:max-w-none lg:px-16 xl:px-24">
        <div className="desk-slab w-full p-6 md:p-8">
          <div className="mb-9 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f2d9c8] text-sm font-black text-[#1c1714]">R</div>
          </div>
          <div className="mb-8">
            <h1 className="text-3xl font-black">登录 ResumeAI</h1>
            <p className="mt-2 text-sm text-[#7a6457]">继续编辑你的素材纸、JD 折痕和简历纸面。</p>
          </div>
        <form onSubmit={onSubmit} className="space-y-5">
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
              placeholder="At least 8 characters"
              className="magazine-input mt-2 px-3 py-2.5 text-sm"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button aria-label="Sign In" className="magazine-button-primary w-full px-4 py-2.5 text-sm">
            登录并进入工作台
          </button>
        </form>
        <p className="mt-8 text-sm text-[#7a6457]">
          还没有账号？{" "}
          <Link href="/register" className="font-bold text-[#c72413] hover:underline">
            创建账号
          </Link>
        </p>
        </div>
      </section>
    </main>
  );
}
