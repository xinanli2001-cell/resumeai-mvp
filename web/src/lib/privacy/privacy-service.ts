import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const emptyProfile: Prisma.ProfileUpdateInput = {
  name: "",
  location: "",
  targetTitle: "",
  summary: "",
  phone: "",
  contactEmail: "",
  linkedin: "",
  github: "",
  website: "",
  workAuthorization: "",
  languages: [],
};

export async function deleteUserData(userId: string) {
  return db.$transaction(async (tx) => {
    const [rewrittenExperiences, rewriteSessions, jobDescriptions, experiences, resumes, templates, usageLogs] =
      await Promise.all([
        tx.rewrittenExperience.count({ where: { session: { userId } } }),
        tx.rewriteSession.count({ where: { userId } }),
        tx.jobDescription.count({ where: { userId } }),
        tx.experience.count({ where: { userId } }),
        tx.resume.count({ where: { userId } }),
        tx.template.count({ where: { ownerUserId: userId, isSystem: false } }),
        tx.usageLog.count({ where: { userId } }),
      ]);

    await tx.resume.deleteMany({ where: { userId } });
    await tx.template.deleteMany({ where: { ownerUserId: userId, isSystem: false } });
    await tx.jobDescription.deleteMany({ where: { userId } });
    await tx.experience.deleteMany({ where: { userId } });
    await tx.rewriteSession.deleteMany({ where: { userId } });
    await tx.usageLog.deleteMany({ where: { userId } });
    await tx.profile.upsert({
      where: { userId },
      update: emptyProfile,
      create: { userId, languages: [] },
    });

    return {
      deleted: {
        rewrittenExperiences,
        rewriteSessions,
        jobDescriptions,
        experiences,
        resumes,
        templates,
        usageLogs,
      },
    };
  });
}

export async function deleteAccount(userId: string) {
  await db.user.delete({ where: { id: userId } });
}
