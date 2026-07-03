import { DeepSeekLLMProvider } from "./deepseek";
import { MockLLMProvider } from "./mock";
import type { LLMProvider } from "./types";

export function createProvider(): LLMProvider {
  const useDeepSeek =
    process.env.LLM_PROVIDER === "deepseek" && Boolean(process.env.DEEPSEEK_API_KEY);

  return useDeepSeek ? new DeepSeekLLMProvider() : new MockLLMProvider();
}

let cached: LLMProvider | undefined;

export function getProvider(): LLMProvider {
  if (!cached) {
    cached = createProvider();
  }

  return cached;
}
