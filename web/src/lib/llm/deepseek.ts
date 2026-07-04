import {
  ImportResultSchema,
  JdParseResultSchema,
  RewriteResultSchema,
  type ImportResult,
  type JdParseResult,
  type LLMProvider,
  type RewriteRequest,
  type RewriteResult,
} from "./types";
import { env } from "@/lib/config/env";

type ChatMessage = { role: "system" | "user"; content: string };

export class DeepSeekLLMProvider implements LLMProvider {
  readonly name = "deepseek" as const;

  private async chatJson(messages: ChatMessage[]): Promise<unknown> {
    const config = env();
    const baseUrl = config.DEEPSEEK_BASE_URL;
    const model = config.DEEPSEEK_MODEL;
    const apiKey = config.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("DeepSeek returned an empty response");
    }

    return JSON.parse(content);
  }

  async extractStructuredExperience(rawText: string): Promise<ImportResult> {
    const raw = await this.chatJson([
      {
        role: "system",
        content:
          "You convert a candidate's raw experience text into structured resume data. " +
          "Return JSON matching: { experiences: [{ type, title, organization, role, startDate, endDate, summary, responsibilities[], achievements[], skills[], tags[], pendingClaims[] }] }. " +
          "type is one of PROJECT, INTERNSHIP, WORK, EDUCATION, SKILL. " +
          "NEVER invent facts. Any field you cannot derive from the text must be left empty and its name added to pendingClaims.",
      },
      { role: "user", content: rawText },
    ]);

    return ImportResultSchema.parse(raw);
  }

  async parseJobDescription(rawText: string): Promise<JdParseResult> {
    const raw = await this.chatJson([
      {
        role: "system",
        content:
          "Extract structured requirements from a job description. " +
          "Return JSON: { title, company, language (zh|en|mixed), requirements[], skills[], keywords[] }. " +
          "skills and keywords should be concise, deduplicated, lowercase where reasonable.",
      },
      { role: "user", content: rawText },
    ]);

    return JdParseResultSchema.parse(raw);
  }

  async rewriteExperience(request: RewriteRequest): Promise<RewriteResult> {
    const truthfulness =
      request.mode === "PACKAGING"
        ? "Packaging mode: you may strengthen phrasing and emphasize impact and job relevance, but you must NOT fabricate companies, certificates, projects, hard metrics, or any unconfirmed fact."
        : "Default mode: you may suggest reasonable methodology/tech-stack framing, but anything not supported by the source must be listed in pendingClaims, not asserted.";
    const language =
      request.languageMode === "ZH"
        ? "Write the rewrite in Chinese."
        : request.languageMode === "EN"
          ? "Write the rewrite in English."
          : "Write the rewrite in Chinese first, then an English version, separated by a blank line.";
    const raw = await this.chatJson([
      {
        role: "system",
        content:
          "Rewrite one complete experience block using STAR (Situation, Task, Action, Result). " +
          "Return JSON: { rewrittenText, pendingClaims[] }. " +
          `${truthfulness} ${language}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          jd: request.jd,
          experience: request.experience,
        }),
      },
    ]);

    return RewriteResultSchema.parse(raw);
  }
}
