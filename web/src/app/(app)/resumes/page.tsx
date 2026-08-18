import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listResumes } from "@/lib/resume/resume-service";

export default async function ResumesPage() {
  const user = await requireUser();
  const resumes = await listResumes(user.id);

  return (
    <div className="space-y-6 p-5 md:p-8">
      <section className="desk-slab p-5">
        <div className="magazine-rule mb-4 h-1 w-24 rounded-full" />
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">我的简历纸面</h2>
            <p className="mt-1 text-sm text-[#7a6457]">从已确认的折叠版本生成后，可在这里继续编辑、装订和复用模板。</p>
          </div>
          <Link href="/match" className="magazine-button-primary px-4 py-2.5 text-sm">
            从 JD 折痕生成
          </Link>
        </div>
      </section>

      <section className="desk-slab">
        {resumes.length === 0 ? (
          <div className="magazine-empty p-8 text-sm">
            <h3 className="text-xl font-black text-[#1c1714]">还没有简历纸面</h3>
            <p className="mt-2 leading-6">先完成 JD 匹配和改写确认，ResumeAI 会把确认后的素材折成可编辑的简历稿。</p>
          </div>
        ) : (
          resumes.map((resume) => (
            <Link
              key={resume.id}
              href={`/resume/${resume.id}`}
              className="desk-row block p-5 transition hover:bg-[#fff8ef]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black">{resume.title || "未命名简历"}</h3>
                  <p className="mt-1 text-sm text-[#7a6457]">
                    语言：{resume.language} · 状态：{resume.status}
                  </p>
                </div>
                <p className="rounded-full bg-[#f5e4cf] px-3 py-1 text-xs font-bold text-[#6a4632]">更新于 {resume.updatedAt.toLocaleString("zh-CN")}</p>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
