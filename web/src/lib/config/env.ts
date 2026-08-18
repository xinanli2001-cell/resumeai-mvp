import { z } from "zod";

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().default(""),
  LLM_PROVIDER: z.enum(["mock", "deepseek", "openai"]).default("mock"),
  DEEPSEEK_API_KEY: z.string().default(""),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-5.6"),
  LLM_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  MAX_TEXT_BYTES: z.coerce.number().int().positive().default(20000),
  MAX_RESUME_FILE_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  REGISTRATION_MODE: z.enum(["open", "invite_only"]).default("open"),
});

export type AppEnv = z.infer<typeof RawEnvSchema>;

export function loadEnv() {
  const parsed = RawEnvSchema.parse(process.env);
  if (parsed.NODE_ENV === "production") {
    if (parsed.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET must be >= 32 chars in production");
    }
    if (parsed.LLM_PROVIDER === "deepseek" && !parsed.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY required when LLM_PROVIDER=deepseek in production");
    }
    if (parsed.LLM_PROVIDER === "openai" && !parsed.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY required when LLM_PROVIDER=openai in production");
    }
  }
  return parsed;
}

let cached: AppEnv | undefined;

export function env() {
  if (!cached) cached = loadEnv();
  return cached;
}

export function resetEnvForTests() {
  cached = undefined;
}
