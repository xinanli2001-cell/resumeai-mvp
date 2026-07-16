import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const originalEnv = process.env;

vi.mock("../../src/lib/db", () => ({
  db: {
    $queryRaw: queryRaw,
  },
}));

vi.mock("../../src/lib/logging/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("health route", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://example",
      SESSION_SECRET: "",
      LLM_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  it("does not depend on database or production secrets", async () => {
    queryRaw.mockRejectedValue(new Error("database should not be called"));
    const { GET } = await import("../../src/app/api/health/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      appEnv: "staging",
      runtime: "node",
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
