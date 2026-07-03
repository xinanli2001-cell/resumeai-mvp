import { describe, expect, it } from "vitest";
import { scoreExperiences } from "../../src/lib/match/match-service";

describe("scoreExperiences", () => {
  it("ranks overlapping experiences first and keeps non-matches selectable", () => {
    const jd = {
      parsedSkills: ["Python", "NLP"],
      parsedKeywords: ["BERT", "sentiment analysis"],
      parsedRequirements: ["Build model evaluation pipelines"],
    };
    const experiences = [
      {
        id: "unrelated",
        title: "Campus ambassador",
        organization: "Uni",
        role: "",
        rawText: "Organized community events and wrote newsletters.",
        skills: ["Communication"],
        tags: [],
      },
      {
        id: "best",
        title: "ABSA classifier",
        organization: "Lab",
        role: "Developer",
        rawText: "Built a BERT sentiment analysis model with Python.",
        skills: ["Python", "BERT"],
        tags: ["NLP"],
      },
      {
        id: "partial",
        title: "Data dashboard",
        organization: "Startup",
        role: "",
        rawText: "Created Python dashboards for metrics review.",
        skills: ["Python", 42, ""],
        tags: "not-an-array",
      },
    ];

    const result = scoreExperiences(jd, experiences);

    expect(result.map((item) => item.experience.id)).toEqual(["best", "partial", "unrelated"]);
    expect(result[0]).toMatchObject({
      matchScore: expect.any(Number),
      recommended: true,
    });
    expect(result[0].matchReason).toContain("Python");
    expect(result[0].matchReason).toContain("BERT");
    expect(result[0].matchReason).toContain("sentiment analysis");
    expect(result[2]).toMatchObject({
      matchScore: 0,
      matchReason: "No direct JD skill or keyword overlap.",
      recommended: false,
    });
  });
});
