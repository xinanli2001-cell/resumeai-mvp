import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "../../src/lib/security/rate-limit";

describe("rate limit", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it("allows N calls in a rolling minute and rejects the next one", () => {
    let now = 1_000;
    const clock = () => now;

    expect(checkRateLimit("user:import", 2, clock)).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(checkRateLimit("user:import", 2, clock)).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(checkRateLimit("user:import", 2, clock)).toEqual({ allowed: false, retryAfterMs: 60_000 });

    now += 60_001;
    expect(checkRateLimit("user:import", 2, clock)).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it("isolates keys and reports retry time until the oldest hit leaves the window", () => {
    let now = 5_000;
    const clock = () => now;

    expect(checkRateLimit("a:rewrite", 1, clock).allowed).toBe(true);
    expect(checkRateLimit("b:rewrite", 1, clock).allowed).toBe(true);
    now += 10_000;

    expect(checkRateLimit("a:rewrite", 1, clock)).toEqual({ allowed: false, retryAfterMs: 50_000 });
  });
});
