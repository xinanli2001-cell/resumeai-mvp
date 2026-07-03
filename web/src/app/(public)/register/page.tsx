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
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9ff] px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-[#d8c3ad] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[#855300]">ResumeAI</h1>
          <p className="mt-2 text-sm text-[#565e74]">Create your resume workspace</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#0b1c30]">Email Address</span>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="mt-2 w-full rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm outline-none focus:border-[#855300]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#0b1c30]">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="mt-2 w-full rounded border border-[#d8c3ad] bg-[#f8f9ff] px-3 py-2 text-sm outline-none focus:border-[#855300]"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button className="w-full rounded bg-[#855300] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#653e00]">
            Create Account
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-[#565e74]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#855300]">
            Sign In
          </Link>
        </p>
      </section>
    </main>
  );
}
