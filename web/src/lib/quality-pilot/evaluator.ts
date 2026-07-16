import type { ImportResult, JdParseResult, RewriteResult } from "@/lib/llm/types";
import type {
  QualityPilotCheck,
  QualityPilotCheckStatus,
  QualityPilotEvaluation,
  QualityPilotFixture,
} from "./types";

type QualityPilotEvaluationInput = {
  fixture: QualityPilotFixture;
  importResult: ImportResult;
  jdResult: JdParseResult;
  rewriteResult: RewriteResult;
};

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesToken(value: string, token: string) {
  return normalized(value).includes(normalized(token));
}

function searchableExperience(experience: ImportResult["experiences"][number]) {
  return JSON.stringify(experience);
}

function addCheck(
  checks: QualityPilotCheck[],
  section: QualityPilotCheck["section"],
  label: string,
  status: QualityPilotCheckStatus,
  detail: string,
) {
  checks.push({ section, label, status, detail });
}

function summarize(checks: QualityPilotCheck[]) {
  return checks.reduce<Record<QualityPilotCheckStatus, number>>(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, warning: 0, fail: 0 },
  );
}

export function evaluateQualityPilot({
  fixture,
  importResult,
  jdResult,
  rewriteResult,
}: QualityPilotEvaluationInput): QualityPilotEvaluation {
  const checks: QualityPilotCheck[] = [];
  const experience = importResult.experiences[0];

  if (!experience) {
    addCheck(checks, "extraction", "experience extracted", "fail", "No structured experience was returned.");
  } else {
    addCheck(checks, "extraction", "experience extracted", "pass", "At least one structured experience was returned.");
    const text = searchableExperience(experience);
    for (const token of fixture.experience.expected.sourceTokens) {
      addCheck(
        checks,
        "extraction",
        `extraction source coverage: ${token}`,
        includesToken(text, token) ? "pass" : "warning",
        includesToken(text, token) ? "Source token retained." : "Review whether the source fact was omitted.",
      );
    }
    for (const skill of fixture.experience.expected.skills) {
      const found = experience.skills.some((value) => includesToken(value, skill));
      addCheck(
        checks,
        "extraction",
        `extraction skill coverage: ${skill}`,
        found ? "pass" : "warning",
        found ? "Expected skill retained." : "Review whether the source skill was omitted.",
      );
    }
    for (const claim of fixture.experience.expected.pendingClaims) {
      const found = experience.pendingClaims.some((value) => includesToken(value, claim));
      addCheck(
        checks,
        "extraction",
        `pending claim: ${claim}`,
        found ? "pass" : "warning",
        found ? "Unknown field was flagged." : "Review whether an unknown field needs confirmation.",
      );
    }
  }

  addCheck(
    checks,
    "jd",
    "job title extracted",
    jdResult.title.trim() ? "pass" : "fail",
    jdResult.title.trim() ? "A job title was returned." : "No job title was returned.",
  );
  const jdText = JSON.stringify(jdResult);
  for (const skill of fixture.jobDescription.expected.skills) {
    const found = includesToken(jdText, skill);
    addCheck(
      checks,
      "jd",
      `jd skill coverage: ${skill}`,
      found ? "pass" : "warning",
      found ? "Expected JD skill retained." : "Review whether the JD skill was omitted.",
    );
  }
  for (const keyword of fixture.jobDescription.expected.keywords) {
    const found = includesToken(jdText, keyword);
    addCheck(
      checks,
      "jd",
      `jd keyword coverage: ${keyword}`,
      found ? "pass" : "warning",
      found ? "Expected JD keyword retained." : "Review whether the JD keyword was omitted.",
    );
  }
  addCheck(
    checks,
    "jd",
    `jd language: ${fixture.jobDescription.expected.language}`,
    jdResult.language === fixture.jobDescription.expected.language ? "pass" : "warning",
    jdResult.language === fixture.jobDescription.expected.language
      ? "Expected language was returned."
      : `Returned ${jdResult.language}; review language classification.`,
  );

  const rewrittenText = rewriteResult.rewrittenText.trim();
  addCheck(
    checks,
    "rewrite",
    "rewrite generated",
    rewrittenText ? "pass" : "fail",
    rewrittenText ? "A rewrite was returned." : "No rewrite text was returned.",
  );
  for (const token of fixture.rewrite.expected.sourceTokens) {
    const found = includesToken(rewrittenText, token);
    addCheck(
      checks,
      "rewrite",
      `rewrite source coverage: ${token}`,
      found ? "pass" : "warning",
      found ? "Source fact retained." : "Review whether the rewrite lost a source fact.",
    );
  }
  for (const term of fixture.rewrite.expected.jdTerms) {
    const found = includesToken(rewrittenText, term);
    addCheck(
      checks,
      "rewrite",
      `rewrite JD relevance: ${term}`,
      found ? "pass" : "warning",
      found ? "JD-relevant term included." : "Review whether the rewrite reflects the JD.",
    );
  }
  for (const claim of fixture.rewrite.expected.prohibitedClaims) {
    const found = includesToken(rewrittenText, claim);
    addCheck(
      checks,
      "rewrite",
      `unsupported claim: ${claim}`,
      found ? "fail" : "pass",
      found ? "The rewrite contains a prohibited unsupported claim." : "No prohibited claim was found.",
    );
  }

  return { checks, summary: summarize(checks) };
}
