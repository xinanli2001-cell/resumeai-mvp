import { requireUser } from "@/lib/auth/guards";
import { listExperiences } from "@/lib/experience/experience-service";
import { getProfile } from "@/lib/profile/profile-service";
import { LibraryClient } from "./library-client";

export default async function LibraryPage() {
  const user = await requireUser();
  const [profile, experiences] = await Promise.all([getProfile(user.id), listExperiences(user.id)]);

  return (
    <LibraryClient
      initialProfile={{
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
      }}
      initialExperiences={experiences.map((experience) => ({
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
      }))}
    />
  );
}
