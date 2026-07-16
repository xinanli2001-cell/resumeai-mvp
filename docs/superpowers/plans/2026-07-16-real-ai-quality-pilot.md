# Real AI Quality Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, repeatable DeepSeek quality pilot that evaluates extraction, JD parsing, and rewrite behavior using a de-identified fixed fixture.

**Architecture:** Keep all deterministic quality policy in a credential-free library module with unit tests. A small executable script loads the fixture, refuses mock or missing-key configuration, invokes the existing provider directly, then writes a sanitized Markdown report under a Git-ignored output directory. No product API, Prisma, or browser workflow changes are required.

**Tech Stack:** TypeScript, Zod, Vitest, tsx, existing `LLMProvider` implementations.

---

### Task 1: Define the fixture contract and quality evaluator with tests

**Files:**
- Create: `web/tests/unit/quality-pilot.test.ts`
- Create: `web/src/lib/quality-pilot/types.ts`
- Create: `web/src/lib/quality-pilot/evaluator.ts`
- Create: `web/src/lib/quality-pilot/report.ts`
- Create: `web/scripts/fixtures/real-ai-quality-pilot.json`

- [ ] **Step 1: Write failing tests for deterministic evaluation and report redaction**

```ts
it("fails a rewrite that contains a prohibited unsupported claim", () => {
  const result = evaluateQualityPilot(fixture, importResult, jdResult, {
    rewrittenText: "Delivered 50% revenue growth with ResumeAI.",
    pendingClaims: [],
  });

  expect(result.checks).toContainEqual(
    expect.objectContaining({ status: "fail", label: "unsupported claim: 50% revenue growth" }),
  );
});

it("redacts API-like values from a rendered report", () => {
  expect(renderQualityPilotReport(reportInput)).not.toContain("sk-secret-value-1234567890");
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd web && pnpm exec vitest run tests/unit/quality-pilot.test.ts`

Expected: FAIL because the quality-pilot modules do not exist yet.

- [ ] **Step 3: Implement the fixture schema, evaluator, and report renderer**

Define `QualityPilotFixtureSchema` with source text and expectation tokens,
then implement `evaluateQualityPilot` using case-insensitive token matching.
Mark missing required output and prohibited claims as failures; mark missing
coverage tokens as warnings. Render only provider/model metadata, check
results, human-review guidance, and sanitized model output.

- [ ] **Step 4: Add the de-identified fixed fixture**

Store one English software-project experience and one software-engineer JD in
`scripts/fixtures/real-ai-quality-pilot.json`. Include source skills, JD terms,
and prohibited claims such as `50% revenue growth`; do not include names,
emails, or real companies.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run: `cd web && pnpm exec vitest run tests/unit/quality-pilot.test.ts`

Expected: PASS with evaluator and report behavior covered without a network
request.

### Task 2: Add explicit real-provider execution and report persistence

**Files:**
- Create: `web/src/lib/quality-pilot/run-config.ts`
- Create: `web/scripts/real-ai-quality-pilot.ts`
- Modify: `web/package.json`
- Modify: `web/.gitignore`
- Modify: `web/tests/unit/quality-pilot.test.ts`

- [ ] **Step 1: Write a failing configuration-guard test**

```ts
it("rejects a quality pilot unless DeepSeek and a key are explicitly configured", () => {
  expect(() => assertRealQualityPilotConfig({ provider: "mock", hasApiKey: true }))
    .toThrow("LLM_PROVIDER=deepseek");
  expect(() => assertRealQualityPilotConfig({ provider: "deepseek", hasApiKey: false }))
    .toThrow("DEEPSEEK_API_KEY");
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd web && pnpm exec vitest run tests/unit/quality-pilot.test.ts`

Expected: FAIL because `assertRealQualityPilotConfig` does not exist.

- [ ] **Step 3: Implement the guard and executable script**

Add `assertRealQualityPilotConfig` to a pure module. In the script, load the
fixture, call `createProvider`, assert `provider.name === "deepseek"`, call
the three provider methods in sequence, evaluate the result, and write
`.reports/real-ai-pilot/<ISO-safe-timestamp>.md`. Exit non-zero when any
deterministic failure is present. Never print or write the API key.

- [ ] **Step 4: Expose the opt-in command and ignore reports**

Add `"quality:pilot": "tsx scripts/real-ai-quality-pilot.ts"` to
`package.json` and add `.reports/` to `.gitignore`.

- [ ] **Step 5: Run the focused test and configuration smoke check**

Run:

```bash
cd web
pnpm exec vitest run tests/unit/quality-pilot.test.ts
LLM_PROVIDER=mock pnpm quality:pilot
```

Expected: unit test PASS; command exits non-zero with a clear DeepSeek-only
message and makes no network request.

### Task 3: Verify, run the opt-in pilot, and publish

**Files:**
- Modify: none unless verification reveals a defect.

- [ ] **Step 1: Run regression verification**

Run:

```bash
cd web
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all suites pass in mock-only mode.

- [ ] **Step 2: Run the real pilot when the local DeepSeek environment is configured**

Run: `cd web && LLM_PROVIDER=deepseek pnpm quality:pilot`

Expected: one sanitized report under `.reports/real-ai-pilot/` and a concise
summary. If no local key is available, report the explicit configuration block
without treating it as a code failure.

- [ ] **Step 3: Review and publish**

Run `git diff --check`, stage only the quality-pilot code, tests, fixture,
package script, and documentation, commit with `feat: add real ai quality
pilot`, then push `codex/plan8-render-staging-config`. Keep the user-owned
`stitch_resumeai_workspace.zip` untracked.
