# ResumeAI Real AI Quality Pilot Design

Date: 2026-07-16

## Goal

Provide a repeatable, operator-run quality check for ResumeAI's real DeepSeek
integration. The pilot validates the three AI contracts already used by the
product: experience extraction, job-description parsing, and experience
rewriting.

The pilot is an engineering and release-readiness tool. It does not expose a
new end-user feature, alter production user data, or replace the existing mock
LLM coverage.

## Scope

The pilot adds:

- One versioned, de-identified representative resume/JD fixture.
- A pure evaluator that records structural checks and quality signals for all
  three provider calls.
- An explicit `pnpm quality:pilot` command that calls the real configured
  DeepSeek provider and writes a timestamped Markdown report outside Git.
- Unit coverage for fixture parsing, score calculation, redaction, and report
  rendering.

It does not add an API route, database schema, UI control, automatic scheduled
calls, or a new provider abstraction.

## Safety And Configuration

`pnpm quality:pilot` is intentionally blocked unless both conditions are true:

- `LLM_PROVIDER=deepseek`
- `DEEPSEEK_API_KEY` is set

It prints a clear skipped/configuration error otherwise; it must never quietly
fall back to the mock provider. The script only uses the de-identified fixture
and never accepts a user resume as an argument. Reports must not include any
environment variable values, request headers, or API keys.

The existing unit and Playwright suites keep using MockLLMProvider. A real
network call is therefore opt-in and cannot make ordinary CI flaky or consume
model quota.

## Fixture And Flow

The fixture represents one bilingual early-career software project and one
matching software-engineer job description. It includes expectations that are
safe to publish:

- expected source facts and skills for extraction;
- expected JD skills and keywords;
- job-relevant terms that a rewrite should address;
- prohibited, unsupported claims that must not appear in a rewrite.

The script loads the fixture, creates the configured provider, and performs:

1. `extractStructuredExperience` with the fixture experience source.
2. `parseJobDescription` with the fixture JD source.
3. `rewriteExperience` using the extracted experience, parsed JD, packaging
   mode, and bilingual output.

No data is stored through Prisma or product APIs.

## Evaluation And Report

The evaluator produces deterministic checks from returned structured data:

- Extraction: non-empty experience, expected factual tokens and skills, and
  pending-claim coverage for unknown facts.
- JD parsing: non-empty title, expected skills/keywords, and language shape.
- Rewrite: non-empty text, source-fact coverage, JD-relevance coverage,
  language-mode shape, and absence of prohibited unsupported claims.

Signals are categorized as `pass`, `warning`, or `fail`. A malformed response,
missing required output, provider/network error, or prohibited claim is a
failure. Coverage misses are warnings for a human reviewer, not a claim that a
single stochastic model output is universally wrong.

The command prints a concise terminal summary and writes a Markdown report to
`.reports/real-ai-pilot/<timestamp>.md`. Each report records the provider and
model identifiers, pass/warning/fail totals, human-review notes, and sanitized
model output. The report directory is ignored by Git.

## Component Boundaries

- `scripts/fixtures/`: versioned de-identified source material and
  expectations.
- `src/lib/quality-pilot/`: fixture schema, deterministic evaluator, and
  Markdown report renderer; no environment access or network calls.
- `scripts/real-ai-quality-pilot.ts`: configuration guard, provider calls,
  file output, and exit status.

This keeps quality policy testable without credentials while keeping real model
access explicit at the command boundary.

## Acceptance Criteria

- `pnpm quality:pilot` refuses to run with `LLM_PROVIDER` other than
  `deepseek` or without `DEEPSEEK_API_KEY`.
- The command invokes the configured real provider exactly for extraction, JD
  parsing, and rewrite when valid credentials are present.
- A successful invocation writes one timestamped, key-free Markdown report
  under `.reports/real-ai-pilot/`.
- The report distinguishes deterministic failures from human-review warnings.
- Fixture expectations can detect an unsupported prohibited claim in rewritten
  text.
- Unit and Playwright test defaults remain mock-only and pass without a real
  credential.
