import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password";
import { signSessionValue, verifySessionValue } from "../../src/lib/auth/session";

describe("password helpers", () => {
  it("verifies a hashed password", async () => {
    const hash = await hashPassword("Secret123!");

    await expect(verifyPassword("Secret123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("Wrong123!", hash)).resolves.toBe(false);
  });
});

describe("session helpers", () => {
  it("round trips a signed session", async () => {
    process.env.SESSION_SECRET = "12345678901234567890123456789012";

    const value = await signSessionValue({ userId: "u1", role: "ADMIN" });

    await expect(verifySessionValue(value)).resolves.toEqual({ userId: "u1", role: "ADMIN" });
  });
});
