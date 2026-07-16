import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { removeSqliteDatabaseFiles } from "../global-setup";

const temporaryDirectories: string[] = [];

describe("test database global setup", () => {
  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => {
      rmSync(directory, { force: true, recursive: true });
    });
  });

  it("removes the test database and every SQLite journal sidecar", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "resumeai-global-setup-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "resumeai.test.db");
    const databaseFiles = [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`];
    databaseFiles.forEach((file) => writeFileSync(file, "stale SQLite state"));

    removeSqliteDatabaseFiles(databasePath);

    databaseFiles.forEach((file) => expect(existsSync(file)).toBe(false));
  });
});
