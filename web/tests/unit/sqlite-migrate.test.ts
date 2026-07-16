import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const projectRoot = process.cwd();
const legacyMigrationPath = path.join(
  projectRoot,
  "prisma/migrations/20260704051427_plan3_editor_templates/migration.sql",
);
const temporaryDirectories: string[] = [];

function run(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; input?: string } = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    ...options,
  });
  expect(result.status).toBe(0);
  return result.stdout;
}

describe("sqlite migrate", () => {
  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { force: true, recursive: true }));
  });

  it("applies an invitation schema delta to an existing SQLite database idempotently", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "resumeai-sqlite-migrate-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "legacy.db");
    const databaseUrl = `file:${databasePath}`;

    run("sqlite3", [databasePath], { input: readFileSync(legacyMigrationPath, "utf8") });

    const command = ["exec", "tsx", "scripts/sqlite-migrate.ts", "--name", "plan9_invitation_codes"];
    const env = { ...process.env, DATABASE_URL: databaseUrl };
    run("pnpm", command, { env });
    const secondRun = run("pnpm", command, { env });
    expect(secondRun).toContain("already matches prisma/schema.prisma");

    const tables = run("sqlite3", [databasePath, "select name from sqlite_master where type='table' and name like 'Invitation%';"])
      .trim()
      .split("\n")
      .sort();
    expect(tables).toEqual(["InvitationCode", "InvitationRedemption"]);

    const invalidInvitation = spawnSync(
      "sqlite3",
      [
        databasePath,
        `INSERT INTO "InvitationCode" ("id", "code", "label", "maxUses", "usedCount", "bonusQuota", "active", "createdAt", "updatedAt")
         VALUES ('invalid', 'INVALID', 'Invalid', 0, 0, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      ],
      { encoding: "utf8" },
    );
    expect(invalidInvitation.status).not.toBe(0);

    const invalidBonus = spawnSync(
      "sqlite3",
      [
        databasePath,
        `INSERT INTO "InvitationCode" ("id", "code", "label", "maxUses", "usedCount", "bonusQuota", "active", "createdAt", "updatedAt")
         VALUES ('invalid-bonus', 'INVALID-BONUS', 'Invalid', 1, 0, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      ],
      { encoding: "utf8" },
    );
    expect(invalidBonus.status).not.toBe(0);
  });

  it("initializes a fresh SQLite database from the complete current schema", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "resumeai-sqlite-migrate-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "fresh.db");

    run("pnpm", ["exec", "tsx", "scripts/sqlite-migrate.ts", "--name", "plan9_invitation_codes"], {
      env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
    });

    const tables = run(
      "sqlite3",
      [databasePath, "select name from sqlite_master where type='table' and name in ('User', 'InvitationCode', 'InvitationRedemption') order by name;"],
    )
      .trim()
      .split("\n");
    expect(tables).toEqual(["InvitationCode", "InvitationRedemption", "User"]);
  });
});
