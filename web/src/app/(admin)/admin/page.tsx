import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      quotaLimit: true,
      quotaUsed: true,
      createdAt: true,
      usageLogs: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, actionType: true, costUnits: true, status: true, createdAt: true },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[#f4f7fc] text-[#13233f]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col border-r border-[#0d3d9f] bg-[#1e5bd7] text-white md:flex">
        <Link href="/library" className="flex h-20 items-center justify-center border-b border-white/20 text-lg font-black" aria-label="ResumeAI 工作台">
          R
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-3 py-6">
          <Link href="/library" className="flex h-12 w-12 items-center justify-center border border-transparent text-xs font-bold text-[#dce8ff] transition hover:border-white/40 hover:bg-white/10" title="信息库">
            资
          </Link>
          <Link href="/admin" className="flex h-12 w-12 items-center justify-center border border-white bg-white text-xs font-bold text-[#1e5bd7] shadow-sm" title="管理后台">
            管
          </Link>
        </nav>
        <div className="border-t border-white/20 px-2 py-4 text-center text-[10px] leading-4 text-[#dce8ff]">
          <p className="truncate font-semibold text-white">{admin.email}</p>
          <p>ADMIN</p>
        </div>
      </aside>
      <main className="min-h-screen md:pl-20">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#d5e0f2] bg-white px-5 py-3 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4972bd]">Administration</p>
            <h1 className="mt-1 text-lg font-semibold">管理后台</h1>
          </div>
          <p className="text-sm text-[#667995]">用户、角色、额度和用量记录</p>
        </header>
        <AdminClient initialUsers={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString(), usageLogs: user.usageLogs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })) }))} />
      </main>
    </div>
  );
}
