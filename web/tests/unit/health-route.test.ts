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
      SESSION_SECRET: "x".repeat(32),
      LLM_PROVIDER: "mock",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  it("returns quickly when the database probe hangs", async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));
    const { GET } = await import("../../src/app/api/health/route");

    const responsePromise = GET();
    await vi.advanceTimersByTimeAsync(2100);
    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      appEnv: "staging",
      checks: { database: "timeout" },
    });
  });
});
