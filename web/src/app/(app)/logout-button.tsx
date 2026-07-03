"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded border border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#bec6e0] transition hover:bg-white/10 hover:text-white"
    >
      Sign Out
    </button>
  );
}
