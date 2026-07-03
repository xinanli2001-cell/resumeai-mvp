import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { LogoutButton } from "./logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-[#0f172a] text-white">
        <div className="px-6 py-6">
          <p className="text-xl font-bold text-[#f59e0b]">ResumeAI</p>
          <p className="mt-1 text-xs text-[#bec6e0]">Pro Workspace</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <Link
            href="/library"
            className="border-l-4 border-[#f59e0b] bg-white/5 px-6 py-3 text-sm font-semibold text-white"
          >
            信息库
          </Link>
          <Link href="/match" className="px-6 py-3 text-sm font-semibold text-[#bec6e0] hover:bg-white/10">
            JD 匹配
          </Link>
          <span className="px-6 py-3 text-sm font-semibold text-[#94a3b8]">简历编辑</span>
          {user.role === "ADMIN" ? (
            <Link href="/admin" className="px-6 py-3 text-sm font-semibold text-[#bec6e0] hover:bg-white/10">
              管理后台
            </Link>
          ) : null}
        </nav>
        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="text-xs text-[#bec6e0]">
            <p className="truncate font-semibold text-white">{user.email}</p>
            <p>
              {user.role === "ADMIN" ? "Unlimited" : `${user.quotaUsed}/${user.quotaLimit}`} credits
            </p>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-h-screen pl-60">
        <header className="flex h-16 items-center justify-between border-b border-[#d8c3ad] bg-white px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">Personal Library</p>
            <h1 className="text-lg font-semibold">个人信息库</h1>
          </div>
          <p className="text-sm text-[#565e74]">维护长期可复用的简历资产</p>
        </header>
        {children}
      </main>
    </div>
  );
}
