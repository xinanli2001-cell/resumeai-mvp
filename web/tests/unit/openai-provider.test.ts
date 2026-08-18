import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "../../src/lib/config/env";
import { OpenAILLMProvider } from "../../src/lib/llm/openai";

const originalEnv = process.env;
const originalFetch = globalThis.fetch;

describe("OpenAILLMProvider", () => {
  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    resetEnvForTests();
    vi.restoreAllMocks();
  });

  it("uses the advanced multimodal model and original image detail for uploaded resume images", async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "file:./dev.db",
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-5.6",
    };
    resetEnvForTests();

    const requests: unknown[] = [];
    globalThis.fetch = vi.fn(async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({ experiences: [] }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    await new OpenAILLMProvider().extractStructuredExperienceFromFile({
      filename: "resume.png",
      mimeType: "image/png",
      dataBase64: Buffer.from("fake image").toString("base64"),
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: "gpt-5.6" });
    const input = (requests[0] as { input: Array<{ content: unknown[] }> }).input;
    expect(input[0].content[0]).toMatchObject({
      type: "input_image",
      detail: "original",
    });
  });
});
