import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function readEnvValue(name: string) {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return process.env[name];

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));
  if (!line) return process.env[name];

  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^["']|["']$/g, "");
}

function migrationName() {
  const args = process.argv.slice(2);
  const nameIndex = args.indexOf("--name");
  const rawName = nameIndex >= 0 ? args[nameIndex + 1] : args[0];
  return (rawName ?? "init").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sqliteDatabasePath() {
  const databaseUrl = readEnvValue("DATABASE_URL") ?? "file:./dev.db";
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("sqlite-migrate only supports SQLite file: DATABASE_URL values");
  }

  const filePath = databaseUrl.slice("file:".length);
  if (path.isAbsolute(filePath)) return filePath;

  return path.resolve(process.cwd(), "prisma", filePath);
}

function run(command: string, args: string[], input?: string) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    input,
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }

  return result.stdout;
}

function hasUserTable(dbPath: string) {
  if (!existsSync(dbPath)) return false;
  const result = spawnSync("sqlite3", [
    dbPath,
    "select name from sqlite_master where type='table' and name='User';",
  ], {
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim() === "User";
}

const dbPath = sqliteDatabasePath();
mkdirSync(path.dirname(dbPath), { recursive: true });

const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
mkdirSync(migrationsRoot, { recursive: true });

const name = migrationName();
const existingMigrationDir = readdirSync(migrationsRoot)
  .filter((item) => item.endsWith(`_${name}`))
  .sort()
  .at(0);
const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const migrationDir = existingMigrationDir
  ? path.join(migrationsRoot, existingMigrationDir)
  : path.join(migrationsRoot, `${timestamp}_${name}`);
const migrationPath = path.join(migrationDir, "migration.sql");

mkdirSync(migrationDir, { recursive: true });

const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : run("pnpm", [
      "exec",
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ]);

writeFileSync(migrationPath, sql);

if (hasUserTable(dbPath)) {
  console.log(`SQLite database already initialized at ${dbPath}`);
} else {
  run("sqlite3", [dbPath], sql);
  console.log(`Applied migration ${path.relative(process.cwd(), migrationPath)} to ${dbPath}`);
}
