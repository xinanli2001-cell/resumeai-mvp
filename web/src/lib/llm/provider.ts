import { DeepSeekLLMProvider } from "./deepseek";
import { MockLLMProvider } from "./mock";
import type { LLMProvider } from "./types";
import { env } from "@/lib/config/env";

export function createProvider(): LLMProvider {
  const config = env();
  const useDeepSeek = config.LLM_PROVIDER === "deepseek" && Boolean(config.DEEPSEEK_API_KEY);

  return useDeepSeek ? new DeepSeekLLMProvider() : new MockLLMProvider();
}

let cached: LLMProvider | undefined;

export function getProvider(): LLMProvider {
  if (!cached) {
    cached = createProvider();
  }

  return cached;
}
