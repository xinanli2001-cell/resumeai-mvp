import { describe, expect, it, vi } from "vitest";
import { redact, logger } from "../../src/lib/logging/logger";

describe("logger redaction", () => {
  it("deep-redacts secret-like keys while preserving normal fields", () => {
    const redacted = redact({
      message: "hello",
      password: "secret",
      passwordHash: "hash",
      authorization: "Bearer token",
      apiKey: "key",
      DEEPSEEK_API_KEY: "deepseek",
      SESSION_SECRET: "session",
      cookie: "resume_session=abc",
      nested: {
        token: "jwt",
        normal: "safe",
      },
      list: [{ accessToken: "abc" }, { value: 1 }],
    });

    expect(redacted).toEqual({
      message: "hello",
      password: "[REDACTED]",
      passwordHash: "[REDACTED]",
      authorization: "[REDACTED]",
      apiKey: "[REDACTED]",
      DEEPSEEK_API_KEY: "[REDACTED]",
      SESSION_SECRET: "[REDACTED]",
      cookie: "[REDACTED]",
      nested: { token: "[REDACTED]", normal: "safe" },
      list: [{ accessToken: "[REDACTED]" }, { value: 1 }],
    });
  });

  it("serializes normal log messages with redacted metadata", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("login attempt", { email: "safe@example.com", password: "secret" });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("login attempt");
    expect(spy.mock.calls[0][0]).toContain("[REDACTED]");
    expect(spy.mock.calls[0][0]).not.toContain("secret");
    spy.mockRestore();
  });
});
