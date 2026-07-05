import { describe, expect, it } from "vitest";
import { createPostgresSchema } from "../../scripts/create-postgres-schema";

describe("createPostgresSchema", () => {
  it("switches only the datasource provider from sqlite to postgresql", () => {
    const source = [
      "datasource db {",
      '  provider = "sqlite"',
      '  url      = env("DATABASE_URL")',
      "}",
      "",
      "model User {",
      "  id String @id",
      "}",
    ].join("\n");

    const generated = createPostgresSchema(source);

    expect(generated).toContain('provider = "postgresql"');
    expect(generated).toContain('url      = env("DATABASE_URL")');
    expect(generated).toContain("model User");
    expect(generated).not.toContain('provider = "sqlite"');
  });

  it("throws when the sqlite datasource provider is missing", () => {
    expect(() => createPostgresSchema("datasource db {}")).toThrow("sqlite datasource provider");
  });
});
