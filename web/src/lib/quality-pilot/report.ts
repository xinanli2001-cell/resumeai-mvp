import type { ImportResult, JdParseResult, RewriteResult } from "@/lib/llm/types";
import type { QualityPilotEvaluation } from "./types";

type QualityPilotReportInput = {
  generatedAt: string;
  providerName: "deepseek";
  model: string;
  evaluation: QualityPilotEvaluation;
  outputs: {
    importResult: ImportResult;
    jdResult: JdParseResult;
    rewriteResult: RewriteResult;
  };
};

function redactPotentialSecrets(value: string) {
  return value
    .replace(/(Bearer\s+)[^\s"\\]+/gi, "$1[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/(DEEPSEEK_API_KEY\s*[=:]\s*)[^\s"\\]+/gi, "$1[REDACTED]");
}

function codeBlock(value: unknown) {
  return `\`\`\`json\n${redactPotentialSecrets(JSON.stringify(value, null, 2))}\n\`\`\``;
}

export function renderQualityPilotReport({
  generatedAt,
  providerName,
  model,
  evaluation,
  outputs,
}: QualityPilotReportInput) {
  const checks = evaluation.checks
    .map((check) => `- **${check.status.toUpperCase()}** [${check.section}] ${check.label}: ${check.detail}`)
    .join("\n");

  return [
    "# ResumeAI Real AI Quality Pilot",
    "",
    `- Generated: ${generatedAt}`,
    `- Provider: ${providerName}`,
    `- Model: ${redactPotentialSecrets(model)}`,
    `- Summary: ${evaluation.summary.pass} pass, ${evaluation.summary.warning} warning, ${evaluation.summary.fail} fail`,
    "",
    "## Checks",
    "",
    checks,
    "",
    "## Human Review",
    "",
    "Warnings indicate coverage to review; failures indicate malformed output or a prohibited claim. Confirm factual accuracy before using a rewrite in a real resume.",
    "",
    "## Sanitized Outputs",
    "",
    "### Extraction",
    "",
    codeBlock(outputs.importResult),
    "",
    "### JD Parsing",
    "",
    codeBlock(outputs.jdResult),
    "",
    "### Rewrite",
    "",
    codeBlock(outputs.rewriteResult),
    "",
  ].join("\n");
}
