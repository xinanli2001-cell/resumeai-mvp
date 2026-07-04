import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import {
  assembleResumeContent,
  createResumeFromSession,
  getResume,
  updateResume,
} from "../../src/lib/resume/resume-service";

const profile = {
  name: "Demo Student",
  targetTitle: "ML Intern",
  location: "Sydney",
  phone: "",
  contactEmail: "s@example.com",
  linkedin: "",
  github: "",
  website: "",
  summary: "Applied ML student.",
};

const blocks = [
  {
    id: "r1",
    decision: "ACCEPTED",
    rewrittenText: "STAR accepted",
    userEditedText: "",
    originalSnapshot: {
      type: "PROJECT",
      title: "ABSA",
      organization: "Uni",
      role: "Lead",
      startDate: "2024-03",
      endDate: "2024-05",
    },
  },
  {
    id: "r2",
    decision: "EDITED",
    rewrittenText: "ai draft",
    userEditedText: "my edited text",
    originalSnapshot: {
      type: "INTERNSHIP",
      title: "Intern",
      organization: "Co",
      role: "SWE",
      startDate: "",
      endDate: "",
    },
  },
  {
    id: "r3",
    decision: "REJECTED",
    rewrittenText: "nope",
    userEditedText: "",
    originalSnapshot: { type: "PROJECT", title: "X", organization: "", role: "", startDate: "", endDate: "" },
  },
  {
    id: "r4",
    decision: "PENDING",
    rewrittenText: "",
    userEditedText: "",
    originalSnapshot: { type: "WORK", title: "Y", organization: "", role: "", startDate: "", endDate: "" },
  },
] as const;

describe("assembleResumeContent", () => {
  it("includes only confirmed blocks and uses the right text source", () => {
    const content = assembleResumeContent(profile, blocks);
    const items = content.sections.flatMap((section) => section.items);
    const ids = items.map((item) => item.sourceRewrittenId);

    expect(ids).toContain("r1");
    expect(ids).toContain("r2");
    expect(ids).not.toContain("r3");
    expect(ids).not.toContain("r4");
    expect(items.find((item) => item.sourceRewrittenId === "r1")?.body).toBe("STAR accepted");
    expect(items.find((item) => item.sourceRewrittenId === "r2")?.body).toBe("my edited text");
    expect(content.header.name).toBe("Demo Student");
    expect(content.header.email).toBe("s@example.com");
  });
});

describe("resume service", () => {
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

  async function seedConfirmedSession() {
    const user = await db.user.create({
      data: {
        email: "resume-user@example.com",
        passwordHash: "hash",
        profile: {
          create: {
            name: "Resume User",
            targetTitle: "Data Analyst",
            contactEmail: "resume-user@example.com",
            languages: [],
          },
        },
      },
    });
    const jd = await db.jobDescription.create({
      data: {
        userId: user.id,
        rawText: "Data analyst role",
        parsedRequirements: [],
        parsedSkills: [],
        parsedKeywords: [],
      },
    });
    const session = await db.rewriteSession.create({
      data: {
        userId: user.id,
        jdId: jd.id,
        selectedExperienceIds: [],
        languageMode: "BILINGUAL",
        status: "READY",
      },
    });
    await db.rewrittenExperience.createMany({
      data: [
        {
          sessionId: session.id,
          originalSnapshot: {
            type: "PROJECT",
            title: "Churn Model",
            organization: "Uni",
            role: "Analyst",
            startDate: "2025-01",
            endDate: "2025-03",
          },
          rewrittenText: "accepted text",
          pendingClaims: [],
          decision: "ACCEPTED",
        },
        {
          sessionId: session.id,
          originalSnapshot: {
            type: "WORK",
            title: "Ops Dashboard",
            organization: "Company",
            role: "Intern",
            startDate: "",
            endDate: "",
          },
          rewrittenText: "draft text",
          userEditedText: "edited text",
          pendingClaims: [],
          decision: "EDITED",
        },
        {
          sessionId: session.id,
          originalSnapshot: { type: "PROJECT", title: "Hidden", organization: "", role: "", startDate: "", endDate: "" },
          rewrittenText: "rejected text",
          pendingClaims: [],
          decision: "REJECTED",
        },
      ],
    });
    const template = await db.template.create({
      data: {
        id: "system-test",
        name: "System Test",
        isSystem: true,
        config: { heading: { style: "bar" } },
      },
    });
    return { user, session, template };
  }

  it("creates a resume snapshot from confirmed rewrite blocks without quota usage", async () => {
    const { user, session } = await seedConfirmedSession();

    const created = await createResumeFromSession(user.id, session.id);
    const detail = await getResume(user.id, created.resumeId);
    const items = detail.content.sections.flatMap((section) => section.items);

    expect(detail.language).toBe("bilingual");
    expect(detail.sessionId).toBe(session.id);
    expect(items.map((item) => item.body)).toEqual(["accepted text", "edited text"]);
    expect(await db.usageLog.count()).toBe(0);
  });

  it("keeps resume content isolated from later session/profile edits and template switches", async () => {
    const { user, session, template } = await seedConfirmedSession();
    const created = await createResumeFromSession(user.id, session.id);
    const before = await getResume(user.id, created.resumeId);

    await db.profile.update({ where: { userId: user.id }, data: { name: "Changed Name" } });
    await db.rewrittenExperience.updateMany({
      where: { sessionId: session.id },
      data: { rewrittenText: "changed source text" },
    });
    const otherTemplate = await db.template.create({
      data: {
        id: "system-other",
        name: "Other",
        isSystem: true,
        config: { heading: { style: "underline" } },
      },
    });

    const updated = await updateResume(user.id, created.resumeId, { templateId: otherTemplate.id });

    expect(updated.templateId).toBe(otherTemplate.id);
    expect(updated.content).toEqual(before.content);
    expect(updated.templateId).not.toBe(template.id);
  });

  it("rejects creating a resume when no blocks are confirmed", async () => {
    const { user, session } = await seedConfirmedSession();
    await db.rewrittenExperience.updateMany({ where: { sessionId: session.id }, data: { decision: "PENDING" } });

    await expect(createResumeFromSession(user.id, session.id)).rejects.toThrow("No confirmed experience");
  });
});
