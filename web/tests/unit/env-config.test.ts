import { afterEach, describe, expect, it } from "vitest";
import { loadEnv, resetEnvForTests } from "../../src/lib/config/env";

const originalEnv = process.env;

function withEnv(values: Record<string, string | undefined>) {
  process.env = { ...originalEnv, ...values };
}

describe("env config", () => {
  afterEach(() => {
    process.env = originalEnv;
    resetEnvForTests();
  });

  it("fails fast when production session secret is missing or too short", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://example",
      SESSION_SECRET: "short",
      LLM_PROVIDER: "mock",
    });

    expect(() => loadEnv()).toThrow("SESSION_SECRET must be >= 32 chars in production");
  });

  it("fails fast when production deepseek provider has no api key", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://example",
      SESSION_SECRET: "x".repeat(32),
      LLM_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "",
    });

    expect(() => loadEnv()).toThrow("DEEPSEEK_API_KEY required when LLM_PROVIDER=deepseek in production");
  });

  it("fails fast when production openai provider has no api key", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://example",
      SESSION_SECRET: "x".repeat(32),
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "",
    });

    expect(() => loadEnv()).toThrow("OPENAI_API_KEY required when LLM_PROVIDER=openai in production");
  });

  it("parses numeric variables with defaults and overrides", () => {
    withEnv({
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
      SESSION_SECRET: "dev-secret-at-least-32-characters",
      LLM_RATE_LIMIT_PER_MINUTE: undefined,
      MAX_TEXT_BYTES: undefined,
      MAX_RESUME_FILE_BYTES: undefined,
    });
    expect(loadEnv()).toMatchObject({
      LLM_RATE_LIMIT_PER_MINUTE: 10,
      MAX_TEXT_BYTES: 20000,
      MAX_RESUME_FILE_BYTES: 15 * 1024 * 1024,
    });

    withEnv({
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
      SESSION_SECRET: "dev-secret-at-least-32-characters",
      LLM_RATE_LIMIT_PER_MINUTE: "3",
      MAX_TEXT_BYTES: "100",
      MAX_RESUME_FILE_BYTES: "200",
    });
    expect(loadEnv()).toMatchObject({
      LLM_RATE_LIMIT_PER_MINUTE: 3,
      MAX_TEXT_BYTES: 100,
      MAX_RESUME_FILE_BYTES: 200,
    });
  });

  it("uses safe development defaults without throwing", () => {
    withEnv({
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
      SESSION_SECRET: "dev",
      LLM_PROVIDER: undefined,
      DEEPSEEK_API_KEY: undefined,
    });

    expect(loadEnv()).toMatchObject({
      APP_ENV: "local",
      LLM_PROVIDER: "mock",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-chat",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-5.6",
    });
  });

  it("defaults registration mode to open", () => {
    withEnv({
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
      REGISTRATION_MODE: undefined,
    });
    resetEnvForTests();

    expect(loadEnv().REGISTRATION_MODE).toBe("open");
  });

  it("accepts invite-only registration mode", () => {
    withEnv({
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
      REGISTRATION_MODE: "invite_only",
    });
    resetEnvForTests();

    expect(loadEnv().REGISTRATION_MODE).toBe("invite_only");
  });
});
