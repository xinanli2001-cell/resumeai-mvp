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
          ? "w-full rounded-md border border-white/18 px-2 py-2 text-[10px] font-bold text-white/70 transition hover:border-[#f2d9c8] hover:bg-white/10 hover:text-white"
          : "magazine-button-secondary px-3 py-2 text-left text-xs"
      }
    >
      Sign Out
    </button>
  );
}
