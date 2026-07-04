import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

function readEnvValue(name: string) {
  const envPath = path.join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${name}=`));
    if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  }
  return process.env[name];
}

function timestamp() {
  return (process.argv[2] ?? process.env.BACKUP_TIMESTAMP ?? new Date().toISOString())
    .replace(/\D/g, "")
    .slice(0, 14);
}

function sqlitePath(databaseUrl: string) {
  const filePath = databaseUrl.slice("file:".length);
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), "prisma", filePath);
}

const databaseUrl = readEnvValue("DATABASE_URL") ?? "file:./dev.db";
const backupsDir = path.join(process.cwd(), "backups");
mkdirSync(backupsDir, { recursive: true });

if (databaseUrl.startsWith("file:")) {
  const source = sqlitePath(databaseUrl);
  if (!existsSync(source)) {
    throw new Error(`SQLite database not found at ${source}`);
  }
  const destination = path.join(backupsDir, `resumeai-sqlite-${timestamp()}.db`);
  copyFileSync(source, destination);
  console.log(`SQLite backup written to ${path.relative(process.cwd(), destination)}`);
} else if (databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")) {
  const destination = path.join("backups", `resumeai-postgres-${timestamp()}.dump`);
  console.log(`Run this command from a trusted shell:\npg_dump "$DATABASE_URL" --format=custom --file=${destination}`);
} else {
  throw new Error("Unsupported DATABASE_URL for backup");
}
