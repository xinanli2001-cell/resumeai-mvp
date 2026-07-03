import type { ImportResult, LLMProvider } from "@/lib/llm/types";

export async function breakdownFreeText(
  rawText: string,
  provider: LLMProvider,
): Promise<ImportResult> {
  const text = rawText.trim();
  if (!text) throw new Error("rawText is required");
  return provider.extractStructuredExperience(text);
}
