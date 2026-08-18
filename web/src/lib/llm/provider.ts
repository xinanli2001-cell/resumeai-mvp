import { DeepSeekLLMProvider } from "./deepseek";
import { MockLLMProvider } from "./mock";
import { OpenAILLMProvider } from "./openai";
import type { LLMProvider } from "./types";
import { env } from "@/lib/config/env";

export function createProvider(): LLMProvider {
  const config = env();
  const useDeepSeek = config.LLM_PROVIDER === "deepseek" && Boolean(config.DEEPSEEK_API_KEY);
  const useOpenAI = config.LLM_PROVIDER === "openai" && Boolean(config.OPENAI_API_KEY);

  if (useOpenAI) return new OpenAILLMProvider();
  if (useDeepSeek) return new DeepSeekLLMProvider();
  return new MockLLMProvider();
}

let cached: LLMProvider | undefined;

export function getProvider(): LLMProvider {
  if (!cached) {
    cached = createProvider();
  }

  return cached;
}
