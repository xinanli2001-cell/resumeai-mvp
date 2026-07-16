"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";

type AppShellUser = { email: string; role: string; quotaUsed: number; quotaLimit: number };
type NavItem = { href: string; label: string; shortLabel: string };

const navItems: NavItem[] = [
  { href: "/library", label: "信息库", shortLabel: "资" },
  { href: "/match", label: "JD 匹配", shortLabel: "JD" },
  { href: "/resumes", label: "我的简历", shortLabel: "简" },
  { href: "/settings", label: "设置", shortLabel: "设" },
];

function isActive(pathname: string, href: string) {
  if (href === "/resumes") return pathname === "/resumes" || pathname.startsWith("/resume/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, user }: { children: React.ReactNode; user: AppShellUser }) {
  const pathname = usePathname();
  const isEditor = pathname.startsWith("/resume/");
  const items = user.role === "ADMIN" ? [...navItems.slice(0, 3), { href: "/admin", label: "管理后台", shortLabel: "管" }, navItems[3]] : navItems;

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-[#d9e4f7] bg-white md:flex">
        <Link href="/resumes" className="flex h-16 items-center justify-center border-b border-[#d9e4f7] text-2xl font-black text-[#004ac6]" aria-label="ResumeAI 首页">
          R
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-2 px-2 py-4" aria-label="主导航">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 border text-[10px] font-semibold transition ${active ? "border-[#b9d0ff] bg-[#eff4ff] text-[#004ac6]" : "border-transparent text-[#52637a] hover:border-[#d9e4f7] hover:bg-[#f8faff] hover:text-[#004ac6]"}`}
              >
                <span className="grid h-6 min-w-6 place-items-center text-xs font-bold">{item.shortLabel}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#d9e4f7] p-2">
          <p className="mb-2 truncate px-1 text-[10px] text-[#52637a]" title={user.email}>{user.email}</p>
          <LogoutButton compact />
        </div>
      </aside>

      <div className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-[#d9e4f7] bg-white px-4 md:hidden">
        <Link href="/resumes" className="font-black text-[#004ac6]">ResumeAI</Link>
        <nav className="flex items-center gap-3 text-xs font-semibold text-[#52637a]" aria-label="移动导航">
          {items.slice(0, 4).map((item) => <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "text-[#004ac6]" : ""}>{item.label}</Link>)}
        </nav>
      </div>

      <main className="min-h-screen md:pl-20">
        {!isEditor ? (
          <header className="flex min-h-16 items-center justify-between border-b border-[#d9e4f7] bg-white px-5 md:px-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">ResumeAI Workspace</p>
              <h1 className="mt-0.5 text-base font-semibold">求职材料工作台</h1>
            </div>
            <p className="hidden text-sm text-[#52637a] lg:block">信息库、JD 改写与精确简历编辑</p>
          </header>
        ) : null}
        {children}
      </main>
    </div>
  );
}
