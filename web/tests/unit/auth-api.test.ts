import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { POST as register } from "../../src/app/api/auth/register/route";

describe("registration route", () => {
  beforeEach(async () => {
    await db.usageLog.deleteMany();
    await db.experience.deleteMany();
    await db.profile.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates a user with an initialized profile", async () => {
    const response = await register(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: "new@example.com", password: "Secret123!" }),
      }),
    );

    expect(response.status).toBe(201);
    const user = await db.user.findUniqueOrThrow({
      where: { email: "new@example.com" },
      include: { profile: true },
    });
    expect(user.profile?.contactEmail).toBe("new@example.com");
    expect(user.profile?.languages).toEqual([]);
  });
});
