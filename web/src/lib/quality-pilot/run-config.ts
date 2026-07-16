type QualityPilotConfig = {
  provider: string | undefined;
  hasApiKey: boolean;
};

export function assertRealQualityPilotConfig({ provider, hasApiKey }: QualityPilotConfig) {
  if (provider !== "deepseek") {
    throw new Error("Real AI quality pilot requires LLM_PROVIDER=deepseek.");
  }
  if (!hasApiKey) {
    throw new Error("Real AI quality pilot requires DEEPSEEK_API_KEY.");
  }
}
