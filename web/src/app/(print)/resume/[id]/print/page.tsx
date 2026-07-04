import { notFound } from "next/navigation";
import { ResumeDocument } from "@/components/resume/resume-document";
import { requireUser } from "@/lib/auth/guards";
import { getResume } from "@/lib/resume/resume-service";
import { TemplateConfigSchema } from "@/lib/template/template-config";
import { PrintClient } from "./print-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResumePrintPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const resume = await getResume(user.id, id).catch(() => null);
  if (!resume) notFound();

  const config = resume.template?.config ?? TemplateConfigSchema.parse({});

  return (
    <main className="print-page">
      <PrintClient />
      <div className="print-resume">
        <ResumeDocument content={resume.content} config={config} />
      </div>
    </main>
  );
}
