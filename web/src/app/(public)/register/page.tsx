"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const register = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!register.ok) {
      const body = await register.json();
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
  }

  return (
    <main className="min-h-screen bg-[#eef4ff] px-5 py-8 text-[#10213f] sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-stretch lg:p-0">
      <section className="hidden border-r border-[#cbd8f2] bg-[#1e5bd7] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex h-10 w-10 items-center justify-center border border-white/35 bg-white/10 text-sm font-black">R</div>
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c9dcff]">Build your story</p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight">从资料库到投递，一处完成。</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#dce8ff]">把经历、职位要求与版本管理整理成能持续复用的求职工作流。</p>
        </div>
        <p className="text-sm text-[#c9dcff]">ResumeAI</p>
      </section>
      <section className="mx-auto flex w-full max-w-md items-center py-10 lg:max-w-none lg:px-16 xl:px-24">
        <div className="w-full">
          <div className="mb-9 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center bg-[#1e5bd7] text-sm font-black text-white">R</div>
          </div>
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4972bd]">Get started</p>
            <h1 className="mt-2 text-3xl font-semibold">创建你的工作台</h1>
            <p className="mt-2 text-sm text-[#5d6f8d]">建立账号后即可开始整理和优化简历。</p>
          </div>
        <form onSubmit={onSubmit} className="space-y-5">
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
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button aria-label="Create Account" className="w-full bg-[#1e5bd7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1749b2]">
            创建账号
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
