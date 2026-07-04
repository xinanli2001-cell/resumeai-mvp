import { requireUser } from "@/lib/auth/guards";
import { listExperiences } from "@/lib/experience/experience-service";
import { getProfile } from "@/lib/profile/profile-service";
import { getResume } from "@/lib/resume/resume-service";
import { TemplateConfigSchema } from "@/lib/template/template-config";
import { listTemplates } from "@/lib/template/template-service";
import { ResumeClient } from "./resume-client";

type Props = { params: Promise<{ id: string }> };

export default async function ResumePage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const [resume, templates, profile, experiences] = await Promise.all([
    getResume(user.id, id),
    listTemplates(user.id),
    getProfile(user.id),
    listExperiences(user.id),
  ]);

  return (
    <ResumeClient
      initialResume={JSON.parse(JSON.stringify(resume))}
      initialTemplates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        baseTemplateId: template.baseTemplateId,
        isSystem: template.isSystem,
        ownerUserId: template.ownerUserId,
        config: TemplateConfigSchema.parse(template.config),
      }))}
      library={{
        profile: {
          name: profile.name,
          location: profile.location,
          targetTitle: profile.targetTitle,
          summary: profile.summary,
          phone: profile.phone,
          contactEmail: profile.contactEmail,
          linkedin: profile.linkedin,
          github: profile.github,
          website: profile.website,
          workAuthorization: profile.workAuthorization,
          languages: Array.isArray(profile.languages) ? profile.languages.map(String) : [],
        },
        experiences: experiences.map((experience) => ({
          id: experience.id,
          type: experience.type,
          title: experience.title,
          organization: experience.organization,
          role: experience.role,
          startDate: experience.startDate,
          endDate: experience.endDate,
          rawText: experience.rawText,
          skills: Array.isArray(experience.skills) ? experience.skills.map(String) : [],
          tags: Array.isArray(experience.tags) ? experience.tags.map(String) : [],
          metrics: Array.isArray(experience.metrics) ? experience.metrics.map(String) : [],
        })),
      }}
    />
  );
}
