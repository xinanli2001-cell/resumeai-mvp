import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "../../src/lib/llm/mock";
import { breakdownFreeText } from "../../src/lib/import/import-service";
import { db } from "../../src/lib/db";

describe("breakdownFreeText", () => {
  it("returns an editable draft without persisting anything", async () => {
    const before = await db.experience.count();

    const draft = await breakdownFreeText("Built an ABSA project with BERT.", new MockLLMProvider());

    const after = await db.experience.count();
    expect(after).toBe(before);
    expect(draft.experiences).toHaveLength(1);
    expect(draft.experiences[0].pendingClaims.length).toBeGreaterThan(0);
  });
});
