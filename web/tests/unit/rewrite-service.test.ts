import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { MockLLMProvider } from "../../src/lib/llm/mock";
import {
  canProceed,
  createRewriteSession,
  getRewriteSession,
  recordDecision,
} from "../../src/lib/rewrite/rewrite-service";

describe("rewrite service", () => {
  beforeEach(async () => {
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

  async function seedUser(quotaLimit = 20) {
    const user = await db.user.create({
      data: {
        email: `rewrite-${quotaLimit}@example.com`,
        passwordHash: "hash",
        quotaLimit,
        profile: { create: { languages: [] } },
      },
    });
    const jd = await db.jobDescription.create({
      data: {
        userId: user.id,
        rawText: "ML Intern\nPython BERT NLP",
        title: "ML Intern",
        parsedRequirements: ["build ML models"],
        parsedSkills: ["python", "bert"],
        parsedKeywords: ["nlp", "python", "bert"],
        language: "en",
      },
    });
    const first = await db.experience.create({
      data: {
        userId: user.id,
        type: "PROJECT",
        title: "ABSA Project",
        rawText: "Built BERT sentiment analysis with Python.",
        structuredFields: {},
        skills: ["Python", "BERT"],
        tags: ["NLP"],
        metrics: [],
      },
    });
    const second = await db.experience.create({
      data: {
        userId: user.id,
        type: "PROJECT",
        title: "Dashboard",
        rawText: "Built an analytics dashboard.",
        structuredFields: {},
        skills: ["React"],
        tags: ["Dashboard"],
        metrics: [],
      },
    });
    return { user, jd, first, second };
  }

  it("creates one pending rewritten block per selected experience with snapshots", async () => {
    const { user, jd, first, second } = await seedUser();

    const created = await createRewriteSession(
      user.id,
      {
        jdId: jd.id,
        selectedExperienceIds: [first.id, second.id],
        mode: "DEFAULT",
        languageMode: "EN",
      },
      new MockLLMProvider(),
    );

    const detail = await getRewriteSession(user.id, created.sessionId);
    expect(detail.blocks).toHaveLength(2);
    expect(detail.blocks.every((block) => block.decision === "PENDING")).toBe(true);
    expect(detail.blocks[0].originalSnapshot).toMatchObject({ title: expect.any(String), rawText: expect.any(String) });
    expect(detail.blocks[0].matchReason.length).toBeGreaterThan(0);
    expect(await canProceed(user.id, created.sessionId)).toBe(false);
  });

  it("consumes one rewrite quota for each generated experience block", async () => {
    const { user, jd, first, second } = await seedUser(20);

    await createRewriteSession(
      user.id,
      {
        jdId: jd.id,
        selectedExperienceIds: [first.id, second.id],
        mode: "DEFAULT",
        languageMode: "EN",
      },
      new MockLLMProvider(),
    );

    const updatedUser = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { usageLogs: { where: { actionType: "rewrite" }, orderBy: { createdAt: "asc" } } },
    });
    expect(updatedUser.quotaUsed).toBe(2);
    expect(updatedUser.usageLogs).toHaveLength(2);
    expect(updatedUser.usageLogs.map((log) => log.costUnits)).toEqual([1, 1]);
  });

  it("rejects an over-quota user before generating any rewrite", async () => {
    const { user, jd, first, second } = await seedUser(1);

    await expect(
      createRewriteSession(
        user.id,
        {
          jdId: jd.id,
          selectedExperienceIds: [first.id, second.id],
          mode: "DEFAULT",
          languageMode: "EN",
        },
        new MockLLMProvider(),
      ),
    ).rejects.toThrow("Quota exceeded");
    await expect(db.rewriteSession.count()).resolves.toBe(0);
    await expect(db.rewrittenExperience.count()).resolves.toBe(0);
  });

  it("records accepted, edited, and rejected decisions and gates progression", async () => {
    const { user, jd, first, second } = await seedUser();
    const created = await createRewriteSession(
      user.id,
      {
        jdId: jd.id,
        selectedExperienceIds: [first.id, second.id],
        mode: "DEFAULT",
        languageMode: "BILINGUAL",
      },
      new MockLLMProvider(),
    );
    const detail = await getRewriteSession(user.id, created.sessionId);
    const [firstBlock, secondBlock] = detail.blocks;

    await recordDecision(user.id, created.sessionId, firstBlock.id, {
      decision: "EDITED",
      userEditedText: "Edited STAR rewrite",
    });
    await recordDecision(user.id, created.sessionId, secondBlock.id, { decision: "REJECTED" });

    const updated = await getRewriteSession(user.id, created.sessionId);
    expect(updated.blocks.find((block) => block.id === firstBlock.id)).toMatchObject({
      decision: "EDITED",
      userEditedText: "Edited STAR rewrite",
    });
    expect(updated.blocks.find((block) => block.id === secondBlock.id)?.decision).toBe("REJECTED");
    await expect(canProceed(user.id, created.sessionId)).resolves.toBe(true);
  });

  it("rejects decision updates through the wrong session id", async () => {
    const { user, jd, first } = await seedUser();
    const firstSession = await createRewriteSession(
      user.id,
      {
        jdId: jd.id,
        selectedExperienceIds: [first.id],
        mode: "DEFAULT",
        languageMode: "EN",
      },
      new MockLLMProvider(),
    );
    const secondSession = await createRewriteSession(
      user.id,
      {
        jdId: jd.id,
        selectedExperienceIds: [first.id],
        mode: "DEFAULT",
        languageMode: "EN",
      },
      new MockLLMProvider(),
    );
    const detail = await getRewriteSession(user.id, firstSession.sessionId);
    const [block] = detail.blocks;

    await expect(
      recordDecision(user.id, secondSession.sessionId, block.id, { decision: "ACCEPTED" }),
    ).rejects.toThrow("Rewritten experience not found");
  });
});
