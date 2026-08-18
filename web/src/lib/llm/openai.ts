import {
  ImportResultSchema,
  JdParseResultSchema,
  RewriteResultSchema,
  type ImportResult,
  type JdParseResult,
  type LLMProvider,
  type ResumeFileInput,
  type RewriteRequest,
  type RewriteResult,
} from "./types";
import { env } from "@/lib/config/env";

type ResponseContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string; detail?: "low" | "high" | "auto" }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" | "original" | "auto" };

const importResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["experiences"],
  properties: {
    experiences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "title",
          "organization",
          "role",
          "startDate",
          "endDate",
          "summary",
          "responsibilities",
          "achievements",
          "skills",
          "tags",
          "pendingClaims",
        ],
        properties: {
          type: { type: "string", enum: ["PROJECT", "INTERNSHIP", "WORK", "EDUCATION", "SKILL"] },
          title: { type: "string" },
          organization: { type: "string" },
          role: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          summary: { type: "string" },
          responsibilities: { type: "array", items: { type: "string" } },
          achievements: { type: "array", items: { type: "string" } },
          skills: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          pendingClaims: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const jdResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "company", "language", "requirements", "skills", "keywords"],
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    language: { type: "string", enum: ["zh", "en", "mixed"] },
    requirements: { type: "array", items: { type: "string" } },
    skills: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
  },
};

const rewriteResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rewrittenText", "pendingClaims"],
  properties: {
    rewrittenText: { type: "string" },
    pendingClaims: { type: "array", items: { type: "string" } },
  },
};

function dataUrl(mimeType: string, dataBase64: string) {
  return `data:${mimeType};base64,${dataBase64}`;
}

function extractOutputText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const maybeOutputText = (data as { output_text?: unknown }).output_text;
  if (typeof maybeOutputText === "string") return maybeOutputText;

  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content : [];
    })
    .map((content) => {
      if (typeof content !== "object" || content === null) return "";
      const text = (content as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

export class OpenAILLMProvider implements LLMProvider {
  readonly name = "openai" as const;

  private async responsesJson(
    content: ResponseContent[],
    schemaName: string,
    schema: object,
  ): Promise<unknown> {
    const config = env();
    const apiKey = config.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await fetch(`${config.OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.OPENAI_MODEL,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const data = await response.json();
    const outputText = extractOutputText(data);
    if (!outputText) {
      throw new Error("OpenAI returned an empty response");
    }

    return JSON.parse(outputText);
  }

  async extractStructuredExperience(rawText: string): Promise<ImportResult> {
    const raw = await this.responsesJson(
      [
        {
          type: "input_text",
          text:
            "Convert this candidate resume or experience text into structured resume material. " +
            "Never invent facts. Leave unknown fields empty and add the field or claim to pendingClaims. " +
            "Split clearly separate projects, jobs, education, and skill sections into separate experiences.\n\n" +
            rawText,
        },
      ],
      "resume_import",
      importResultJsonSchema,
    );

    return ImportResultSchema.parse(raw);
  }

  async extractStructuredExperienceFromFile(file: ResumeFileInput): Promise<ImportResult> {
    const isImage = file.mimeType.startsWith("image/");
    const filePart: ResponseContent = isImage
      ? { type: "input_image", image_url: dataUrl(file.mimeType, file.dataBase64), detail: "original" }
      : file.mimeType === "application/pdf"
        ? {
            type: "input_file",
            filename: file.filename,
            file_data: dataUrl(file.mimeType, file.dataBase64),
            detail: "high",
          }
        : {
            type: "input_file",
            filename: file.filename,
            file_data: dataUrl(file.mimeType, file.dataBase64),
          };

    const raw = await this.responsesJson(
      [
        filePart,
        {
          type: "input_text",
          text:
            "Extract this uploaded resume into structured, editable resume material for a job seeker. " +
            "Use layout and visual hierarchy when available. Preserve source truth: do not fabricate metrics, employers, dates, credentials, or outcomes. " +
            "If a field is missing, uncertain, visually ambiguous, or inferred from layout rather than explicit text, leave the field empty when needed and list it in pendingClaims. " +
            "Return separate experiences for separate projects, work entries, internships, education entries, and skill groups.",
        },
      ],
      "resume_import",
      importResultJsonSchema,
    );

    return ImportResultSchema.parse(raw);
  }

  async parseJobDescription(rawText: string): Promise<JdParseResult> {
    const raw = await this.responsesJson(
      [
        {
          type: "input_text",
          text:
            "Extract structured requirements from this job description. Return concise deduplicated skills and keywords.\n\n" +
            rawText,
        },
      ],
      "jd_parse",
      jdResultJsonSchema,
    );

    return JdParseResultSchema.parse(raw);
  }

  async rewriteExperience(request: RewriteRequest): Promise<RewriteResult> {
    const truthfulness =
      request.mode === "PACKAGING"
        ? "Packaging mode: strengthen phrasing and emphasize impact and job relevance, but never fabricate companies, certificates, projects, hard metrics, or unconfirmed facts."
        : "Default mode: suggest reasonable methodology or tech-stack framing only when supported; anything unsupported must be listed in pendingClaims.";
    const language =
      request.languageMode === "ZH"
        ? "Write in Chinese."
        : request.languageMode === "EN"
          ? "Write in English."
          : "Write Chinese first, then English, separated by a blank line.";
    const raw = await this.responsesJson(
      [
        {
          type: "input_text",
          text:
            "Rewrite one complete experience block using STAR. " +
            `${truthfulness} ${language}\n\n` +
            JSON.stringify({ jd: request.jd, experience: request.experience }),
        },
      ],
      "rewrite_result",
      rewriteResultJsonSchema,
    );

    return RewriteResultSchema.parse(raw);
  }
}
