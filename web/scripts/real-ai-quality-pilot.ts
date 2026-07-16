import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProvider } from "../src/lib/llm/provider";
import {
  evaluateQualityPilot,
  QualityPilotFixtureSchema,
  renderQualityPilotReport,
} from "../src/lib/quality-pilot";
import { assertRealQualityPilotConfig } from "../src/lib/quality-pilot/run-config";

function timestampForFile(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function loadFixture() {
  const fixturePath = path.join(process.cwd(), "scripts/fixtures/real-ai-quality-pilot.json");
  const raw = await readFile(fixturePath, "utf8");
  return QualityPilotFixtureSchema.parse(JSON.parse(raw));
}

async function main() {
  assertRealQualityPilotConfig({
    provider: process.env.LLM_PROVIDER,
    hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY),
  });

  const fixture = await loadFixture();
  const provider = createProvider();
  if (provider.name !== "deepseek") {
    throw new Error("Real AI quality pilot did not initialize the DeepSeek provider.");
  }

  const importResult = await provider.extractStructuredExperience(fixture.experience.rawText);
  const experience = importResult.experiences[0];
  if (!experience) {
    throw new Error("DeepSeek returned no structured experience; rewrite cannot be evaluated.");
  }

  const jdResult = await provider.parseJobDescription(fixture.jobDescription.rawText);
  const rewriteResult = await provider.rewriteExperience({
    experience: {
      type: experience.type,
      title: experience.title,
      organization: experience.organization,
      role: experience.role,
      rawText: fixture.experience.rawText,
      skills: experience.skills,
      tags: experience.tags,
      metrics: experience.achievements,
    },
    jd: jdResult,
    mode: "PACKAGING",
    languageMode: "BILINGUAL",
  });

  const evaluation = evaluateQualityPilot({ fixture, importResult, jdResult, rewriteResult });
  const generatedAt = new Date();
  const report = renderQualityPilotReport({
    generatedAt: generatedAt.toISOString(),
    providerName: provider.name,
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    evaluation,
    outputs: { importResult, jdResult, rewriteResult },
  });
  const reportDirectory = path.join(process.cwd(), ".reports/real-ai-pilot");
  const reportPath = path.join(reportDirectory, `${timestampForFile(generatedAt)}.md`);

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(reportPath, report, "utf8");

  console.log(
    `Real AI quality pilot complete: ${evaluation.summary.pass} pass, ${evaluation.summary.warning} warning, ${evaluation.summary.fail} fail.`,
  );
  console.log(`Report: ${reportPath}`);

  if (evaluation.summary.fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Real AI quality pilot failed: ${message.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]")}`);
  process.exitCode = 1;
});
