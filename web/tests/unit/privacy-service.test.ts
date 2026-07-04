import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { deleteAccount, deleteUserData } from "../../src/lib/privacy/privacy-service";

describe("privacy service", () => {
  beforeEach(async () => {
    await db.resume.deleteMany();
    await db.template.deleteMany();
    await db.usageLog.deleteMany();
    await db.rewrittenExperience.deleteMany();
    await db.rewriteSession.deleteMany();
    await db.jobDescription.deleteMany();
    await db.experience.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function seedUserWithData(email: string) {
    const user = await db.user.create({
      data: {
        email,
        passwordHash: "hash",
        quotaUsed: 3,
        profile: {
          create: {
            name: "Private User",
            location: "Sydney",
            targetTitle: "Engineer",
            summary: "Secret summary",
            phone: "123",
            contactEmail: email,
            linkedin: "linkedin",
            github: "github",
            website: "site",
            workAuthorization: "visa",
            languages: ["English"],
          },
        },
      },
    });
    const experience = await db.experience.create({
      data: {
        userId: user.id,
        type: "PROJECT",
        title: "Private Project",
        rawText: "private text",
        structuredFields: {},
        skills: [],
        tags: [],
        metrics: [],
      },
    });
    const jd = await db.jobDescription.create({
      data: {
        userId: user.id,
        rawText: "private jd",
        parsedRequirements: [],
        parsedSkills: [],
        parsedKeywords: [],
      },
    });
    const session = await db.rewriteSession.create({
      data: {
        userId: user.id,
        jdId: jd.id,
        selectedExperienceIds: [experience.id],
      },
    });
    await db.rewrittenExperience.create({
      data: {
        sessionId: session.id,
        sourceExperienceId: experience.id,
        originalSnapshot: { title: "Private Project" },
        pendingClaims: [],
      },
    });
    const template = await db.template.create({
      data: { ownerUserId: user.id, name: "Private Template", config: {} },
    });
    await db.resume.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        templateId: template.id,
        title: "Private Resume",
        contentSnapshot: { header: {}, sections: [] },
      },
    });
    await db.usageLog.create({
      data: { userId: user.id, actionType: "import", costUnits: 1, status: "SUCCESS" },
    });
    return user;
  }

  it("deletes only the current user's personal data and keeps the account plus system templates", async () => {
    const user = await seedUserWithData("privacy-user@example.com");
    const other = await seedUserWithData("privacy-other@example.com");
    const systemTemplate = await db.template.create({
      data: { id: "privacy-system", name: "System", isSystem: true, config: {} },
    });

    const result = await deleteUserData(user.id);

    expect(result.deleted.experiences).toBe(1);
    expect(result.deleted.jobDescriptions).toBe(1);
    expect(result.deleted.rewriteSessions).toBe(1);
    expect(result.deleted.rewrittenExperiences).toBe(1);
    expect(result.deleted.resumes).toBe(1);
    expect(result.deleted.templates).toBe(1);
    await expect(db.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({ id: user.id });
    await expect(db.user.findUnique({ where: { id: other.id } })).resolves.toMatchObject({ id: other.id });
    await expect(db.template.findUnique({ where: { id: systemTemplate.id } })).resolves.toMatchObject({
      isSystem: true,
    });
    await expect(db.experience.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(db.jobDescription.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(db.resume.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(db.template.count({ where: { ownerUserId: user.id } })).resolves.toBe(0);
    await expect(db.experience.count({ where: { userId: other.id } })).resolves.toBe(1);
    const profile = await db.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile).toMatchObject({
      name: "",
      contactEmail: "",
      summary: "",
      workAuthorization: "",
    });
    expect(profile.languages).toEqual([]);
  });

  it("deletes an account and cascades only that user's data", async () => {
    const user = await seedUserWithData("delete-user@example.com");
    const other = await seedUserWithData("delete-other@example.com");
    await db.template.create({ data: { id: "account-system", name: "System", isSystem: true, config: {} } });

    await deleteAccount(user.id);

    await expect(db.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
    await expect(db.user.findUnique({ where: { id: other.id } })).resolves.toMatchObject({ id: other.id });
    await expect(db.experience.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(db.jobDescription.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(db.resume.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(db.template.count({ where: { isSystem: true } })).resolves.toBe(1);
    await expect(db.experience.count({ where: { userId: other.id } })).resolves.toBe(1);
  });
});
