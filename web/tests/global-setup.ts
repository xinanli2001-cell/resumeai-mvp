import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const testDatabaseUrl = "file:./resumeai.test.db";

export function removeSqliteDatabaseFiles(databasePath: string) {
  [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`].forEach((file) => {
    rmSync(file, { force: true });
  });
}

export default function setupTestDatabase() {
  const databasePath = path.join(process.cwd(), "prisma", "resumeai.test.db");
  removeSqliteDatabaseFiles(databasePath);

  execFileSync("pnpm", ["db:migrate", "--name", "plan9_invitation_codes"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
