"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={logout}
      className={
        compact
          ? "w-full border border-[#d9e4f7] px-2 py-2 text-[10px] font-semibold text-[#52637a] transition hover:border-[#b9d0ff] hover:bg-[#eff4ff] hover:text-[#004ac6]"
          : "border border-[#d9e4f7] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#52637a] transition hover:border-[#b9d0ff] hover:bg-[#eff4ff] hover:text-[#004ac6]"
      }
    >
      Sign Out
    </button>
  );
}
