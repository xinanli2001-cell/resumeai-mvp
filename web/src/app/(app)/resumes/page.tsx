import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listResumes } from "@/lib/resume/resume-service";

export default async function ResumesPage() {
  const user = await requireUser();
  const resumes = await listResumes(user.id);

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#855300]">Resume Editor</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">我的简历版本</h2>
            <p className="mt-1 text-sm text-[#565e74]">从已确认的改写 session 生成后，可在这里继续编辑与复用模板。</p>
          </div>
          <Link href="/match" className="rounded bg-[#855300] px-4 py-2 text-sm font-semibold text-white">
            从 JD 改写生成
          </Link>
        </div>
      </section>

      <section className="grid gap-3">
        {resumes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d8c3ad] bg-white p-8 text-sm text-[#565e74]">
            暂无简历。请先完成 JD 匹配和改写确认，再进入简历编辑。
          </div>
        ) : (
          resumes.map((resume) => (
            <Link
              key={resume.id}
              href={`/resume/${resume.id}`}
              className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm hover:border-[#f59e0b]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{resume.title || "未命名简历"}</h3>
                  <p className="mt-1 text-sm text-[#565e74]">
                    语言：{resume.language} · 状态：{resume.status}
                  </p>
                </div>
                <p className="text-xs text-[#565e74]">更新于 {resume.updatedAt.toLocaleString("zh-CN")}</p>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
