import { Prisma, RewriteDecision, ResumeStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  ResumeContent,
  ResumeContentSchema,
  ResumeItemSchema,
  ResumeSection,
} from "@/lib/resume/resume-content";
import { TemplateConfigSchema } from "@/lib/template/template-config";
import { getTemplateForUser } from "@/lib/template/template-service";

type ProfileLike = {
  name?: string;
  targetTitle?: string;
  location?: string;
  phone?: string;
  contactEmail?: string;
  email?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  summary?: string;
};

type RewriteBlockLike = {
  id: string;
  decision: string;
  rewrittenText: string;
  userEditedText: string;
  originalSnapshot: unknown;
};

type ExperienceSnapshot = {
  type?: string;
  title?: string;
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
};

const sectionTitles: Record<ResumeSection["type"], string> = {
  SUMMARY: "个人简介",
  EDUCATION: "教育经历",
  PROJECT: "项目经历",
  INTERNSHIP: "实习经历",
  WORK: "工作经历",
  SKILL: "职业能力",
  CUSTOM: "自定义",
};

const sectionOrder: ResumeSection["type"][] = [
  "SUMMARY",
  "EDUCATION",
  "PROJECT",
  "INTERNSHIP",
  "WORK",
  "SKILL",
];

function asSnapshot(value: unknown): ExperienceSnapshot {
  if (!value || typeof value !== "object") return {};
  return value as ExperienceSnapshot;
}

function normalizeSectionType(type: string | undefined): ResumeSection["type"] {
  if (type === "EDUCATION" || type === "PROJECT" || type === "INTERNSHIP" || type === "WORK" || type === "SKILL") {
    return type;
  }
  return "CUSTOM";
}

function dateRange(snapshot: ExperienceSnapshot) {
  return [snapshot.startDate, snapshot.endDate].filter(Boolean).join(" - ");
}

function subheading(snapshot: ExperienceSnapshot) {
  return [snapshot.organization, snapshot.role].filter(Boolean).join(" · ");
}

function languageFromMode(languageMode: string) {
  if (languageMode === "EN") return "en";
  if (languageMode === "BILINGUAL") return "bilingual";
  return "zh";
}

export function assembleResumeContent(profile: ProfileLike, blocks: readonly RewriteBlockLike[]): ResumeContent {
  const sections = new Map<ResumeSection["type"], ResumeSection>();

  if (profile.summary?.trim()) {
    sections.set("SUMMARY", {
      id: "section-summary",
      type: "SUMMARY",
      title: sectionTitles.SUMMARY,
      visible: true,
      items: [
        ResumeItemSchema.parse({
          id: "summary-profile",
          body: profile.summary.trim(),
        }),
      ],
    });
  }

  for (const block of blocks) {
    if (block.decision !== "ACCEPTED" && block.decision !== "EDITED") continue;
    const body = block.decision === "EDITED" ? block.userEditedText : block.rewrittenText;
    if (!body.trim()) continue;

    const snapshot = asSnapshot(block.originalSnapshot);
    const type = normalizeSectionType(snapshot.type);
    const section =
      sections.get(type) ??
      ({
        id: `section-${type.toLowerCase()}`,
        type,
        title: sectionTitles[type],
        visible: true,
        items: [],
      } satisfies ResumeSection);

    section.items.push(
      ResumeItemSchema.parse({
        id: `${type.toLowerCase()}-${block.id}`,
        heading: snapshot.title ?? "",
        subheading: subheading(snapshot),
        dateRange: dateRange(snapshot),
        body: body.trim(),
        sourceRewrittenId: block.id,
      }),
    );
    sections.set(type, section);
  }

  return ResumeContentSchema.parse({
    header: {
      name: profile.name ?? "",
      targetTitle: profile.targetTitle ?? "",
      location: profile.location ?? "",
      phone: profile.phone ?? "",
      email: profile.contactEmail ?? profile.email ?? "",
      linkedin: profile.linkedin ?? "",
      github: profile.github ?? "",
      website: profile.website ?? "",
    },
    sections: [
      ...sectionOrder.flatMap((type) => {
        const section = sections.get(type);
        return section ? [section] : [];
      }),
      ...Array.from(sections.values()).filter((section) => !sectionOrder.includes(section.type)),
    ],
  });
}

export async function createResumeFromSession(
  userId: string,
  sessionId: string,
  opts: { templateId?: string; title?: string } = {},
) {
  const session = await db.rewriteSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      jd: true,
      rewrittenExperiences: {
        where: { decision: { in: [RewriteDecision.ACCEPTED, RewriteDecision.EDITED] } },
        orderBy: { createdAt: "asc" },
      },
      user: { include: { profile: true } },
    },
  });
  if (!session) throw new Error("Rewrite session not found");
  if (session.rewrittenExperiences.length === 0) throw new Error("No confirmed experience");

  const content = assembleResumeContent(session.user.profile ?? {}, session.rewrittenExperiences);
  const template = opts.templateId
    ? await getTemplateForUser(userId, opts.templateId)
    : await db.template.findFirst({ where: { isSystem: true }, orderBy: { createdAt: "asc" } });

  const resume = await db.resume.create({
    data: {
      userId,
      sessionId,
      title: opts.title?.trim() || session.jd.title || session.user.profile?.targetTitle || "我的简历",
      language: languageFromMode(session.languageMode),
      templateId: template?.id,
      contentSnapshot: content as Prisma.InputJsonObject,
    },
  });

  return { resumeId: resume.id };
}

export async function listResumes(userId: string) {
  return db.resume.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      language: true,
      status: true,
      templateId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getResume(userId: string, id: string) {
  const resume = await db.resume.findFirst({
    where: { id, userId },
    include: { template: true },
  });
  if (!resume) throw new Error("Resume not found");

  return {
    id: resume.id,
    userId: resume.userId,
    sessionId: resume.sessionId,
    title: resume.title,
    language: resume.language,
    templateId: resume.templateId,
    status: resume.status,
    content: ResumeContentSchema.parse(resume.contentSnapshot),
    template: resume.template
      ? {
          ...resume.template,
          config: TemplateConfigSchema.parse(resume.template.config),
        }
      : null,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
  };
}

export async function updateResume(
  userId: string,
  id: string,
  patch: {
    content?: ResumeContent;
    templateId?: string;
    title?: string;
    language?: "zh" | "en" | "bilingual";
    status?: "DRAFT" | "FINALIZED";
  },
) {
  const existing = await db.resume.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Resume not found");

  const data: Prisma.ResumeUpdateInput = {};
  if (patch.content) {
    data.contentSnapshot = ResumeContentSchema.parse(patch.content) as Prisma.InputJsonObject;
  }
  if (patch.templateId !== undefined) {
    const template = patch.templateId ? await getTemplateForUser(userId, patch.templateId) : null;
    data.template = template ? { connect: { id: template.id } } : { disconnect: true };
  }
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.language !== undefined) data.language = patch.language;
  if (patch.status !== undefined) data.status = patch.status as ResumeStatus;

  await db.resume.update({ where: { id: existing.id }, data });
  return getResume(userId, id);
}
