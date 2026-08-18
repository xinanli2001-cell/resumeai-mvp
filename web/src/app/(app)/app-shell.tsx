"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";

type AppShellUser = { email: string; role: string; quotaUsed: number; quotaLimit: number };
type NavItem = { href: string; label: string; shortLabel: string };

const navItems: NavItem[] = [
  { href: "/library", label: "信息库", shortLabel: "库" },
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
  const quotaLabel = `${user.quotaUsed}/${user.quotaLimit}`;

  return (
    <div className="min-h-screen text-[#1c1714]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-28 flex-col border-r border-[#d6b39b] bg-[#1c1714] text-white md:flex">
        <Link href="/library" className="flex h-24 flex-col justify-center border-b border-white/10 px-4" aria-label="ResumeAI 首页">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#c72413] text-2xl font-black leading-none text-white">R</span>
          <span className="mt-2 text-[11px] font-bold text-white/72">ResumeAI</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-2 px-3 py-4" aria-label="主导航">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex min-h-[68px] w-full flex-col justify-center rounded-xl border px-3 text-[11px] font-bold transition ${
                  active
                    ? "border-[#d6b39b] bg-[#fff8ef] text-[#1c1714]"
                    : "border-transparent text-white/62 hover:border-white/18 hover:bg-white/8 hover:text-white"
                }`}
              >
                <span className={active ? "text-lg font-black text-[#c72413]" : "text-lg font-black text-[#f2d9c8]"}>{item.shortLabel}</span>
                <span className="mt-1 leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <p className="text-[10px] font-bold text-[#f2d9c8]">改写额度 {quotaLabel}</p>
          <p className="mb-3 mt-1 truncate text-[10px] text-white/62" title={user.email}>{user.email}</p>
          <LogoutButton compact />
        </div>
      </aside>

      <div className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[#d6b39b] bg-[#fffdf8]/95 px-4 backdrop-blur md:hidden">
        <Link href="/library" className="font-black text-[#1c1714]">ResumeAI</Link>
        <nav className="flex min-w-0 items-center gap-2 overflow-x-auto text-xs font-bold text-[#7a6457]" aria-label="移动导航">
          {items.slice(0, 4).map((item) => (
            <Link key={item.href} href={item.href} className={`shrink-0 rounded-full px-2.5 py-1.5 ${isActive(pathname, item.href) ? "bg-[#c72413] text-white" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-h-screen md:pl-28">
        {!isEditor ? (
          <header className="border-b border-[#d6b39b] bg-[#fffdf8]/90 px-5 py-5 backdrop-blur md:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black leading-tight text-[#1c1714] md:text-3xl">折纸材料台</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#7a6457]">铺开真实经历，用目标 JD 标出折痕，再确认每一段 AI 改写后进入简历纸面。</p>
              </div>
              <div className="hidden items-center gap-2 text-xs font-bold text-[#7a6457] lg:flex">
                <span className="fold-step-pill px-3 py-1.5">资料平面</span>
                <span className="h-px w-8 bg-[#d6b39b]" />
                <span className="fold-step-pill px-3 py-1.5">JD 折痕</span>
                <span className="h-px w-8 bg-[#d6b39b]" />
                <span className="fold-step-pill px-3 py-1.5">改写折叠</span>
                <span className="h-px w-8 bg-[#d6b39b]" />
                <span className="fold-step-pill px-3 py-1.5">简历成形</span>
              </div>
            </div>
          </header>
        ) : null}
        {children}
      </main>
    </div>
  );
}
