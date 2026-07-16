import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const testDatabaseUrl = "file:./resumeai.test.db";

export default function setupTestDatabase() {
  const databasePath = path.join(process.cwd(), "prisma", "resumeai.test.db");
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-journal`, { force: true });

  execFileSync("pnpm", ["db:migrate", "--name", "plan9_invitation_codes"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
