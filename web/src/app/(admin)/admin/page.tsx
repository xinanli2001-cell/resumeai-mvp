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
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-[#0f172a] text-white">
        <div className="px-6 py-6">
          <p className="text-xl font-bold text-[#f59e0b]">ResumeAI</p>
          <p className="mt-1 text-xs text-[#bec6e0]">Admin Workspace</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <Link href="/library" className="px-6 py-3 text-sm font-semibold text-[#bec6e0] hover:bg-white/10">
            信息库
          </Link>
          <Link
            href="/admin"
            className="border-l-4 border-[#f59e0b] bg-white/5 px-6 py-3 text-sm font-semibold text-white"
          >
            管理后台
          </Link>
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-[#bec6e0]">
          <p className="truncate font-semibold text-white">{admin.email}</p>
          <p>Unlimited usage</p>
        </div>
      </aside>
      <main className="min-h-screen pl-60">
        <header className="flex h-16 items-center justify-between border-b border-[#d8c3ad] bg-white px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">Admin</p>
            <h1 className="text-lg font-semibold">最小管理员后台</h1>
          </div>
          <p className="text-sm text-[#565e74]">用户、角色、额度和用量记录</p>
        </header>
        <AdminClient initialUsers={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString(), usageLogs: user.usageLogs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })) }))} />
      </main>
    </div>
  );
}
