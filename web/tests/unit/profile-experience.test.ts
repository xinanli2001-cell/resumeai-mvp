import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import {
  archiveExperience,
  createExperience,
  normalizeExperienceInput,
  updateExperience,
} from "../../src/lib/experience/experience-service";

describe("normalizeExperienceInput", () => {
  it("keeps experience blocks as the smallest reusable unit", () => {
    const result = normalizeExperienceInput({
      type: "PROJECT",
      title: " ABSA ",
      rawText: " Built a sentiment analysis project from March to May. ",
      skills: ["Python", "BERT", ""],
      tags: ["NLP"],
    });

    expect(result).toMatchObject({
      type: "PROJECT",
      title: "ABSA",
      rawText: "Built a sentiment analysis project from March to May.",
      skills: ["Python", "BERT"],
      tags: ["NLP"],
      status: "ACTIVE",
    });
  });
});

describe("experience ownership", () => {
  beforeEach(async () => {
    await db.usageLog.deleteMany();
    await db.experience.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects updates and archives for experiences owned by another user", async () => {
    const owner = await db.user.create({
      data: {
        email: "owner@example.com",
        passwordHash: "hash",
        profile: { create: { languages: [] } },
      },
    });
    const other = await db.user.create({
      data: {
        email: "other@example.com",
        passwordHash: "hash",
        profile: { create: { languages: [] } },
      },
    });
    const experience = await createExperience(owner.id, {
      type: "PROJECT",
      title: "ABSA",
      rawText: "Original block",
    });

    await expect(
      updateExperience(other.id, experience.id, {
        type: "PROJECT",
        title: "Hijack",
        rawText: "Changed",
      }),
    ).rejects.toThrow("Experience not found");
    await expect(archiveExperience(other.id, experience.id)).rejects.toThrow("Experience not found");
  });
});
