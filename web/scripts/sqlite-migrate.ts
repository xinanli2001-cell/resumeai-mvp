import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function readEnvValue(name: string) {
  if (process.env[name]) return process.env[name];

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

function schemaDiff(fromUrl?: string) {
  return run("pnpm", [
    "exec",
    "prisma",
    "migrate",
    "diff",
    ...(fromUrl ? ["--from-url", fromUrl] : ["--from-empty"]),
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ]);
}

function withSqliteCompatibility(sql: string) {
  return sql
    .replaceAll("DEFAULT {}", "DEFAULT '{}'")
    .replaceAll("DEFAULT []", "DEFAULT '[]'")
    .replace(
      '"maxUses" INTEGER NOT NULL,',
      '"maxUses" INTEGER NOT NULL CHECK ("maxUses" > 0),',
    )
    .replace(
      '"bonusQuota" INTEGER NOT NULL,',
      '"bonusQuota" INTEGER NOT NULL CHECK ("bonusQuota" > 0),',
    );
}

function hasExecutableStatements(sql: string) {
  return sql.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("--");
  });
}

const migrationHistoryTable = "_sqlite_migration_history";

function ensureMigrationHistory(dbPath: string) {
  run("sqlite3", [
    dbPath,
    `CREATE TABLE IF NOT EXISTS "${migrationHistoryTable}" (
      "migration_id" TEXT NOT NULL PRIMARY KEY,
      "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ]);
}

function hasAppliedMigration(dbPath: string, migrationId: string) {
  const escapedMigrationId = migrationId.replaceAll("'", "''");
  const result = spawnSync("sqlite3", [
    dbPath,
    `SELECT 1 FROM "${migrationHistoryTable}" WHERE "migration_id" = '${escapedMigrationId}';`,
  ], {
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim() === "1";
}

function applyAndRecordMigration(dbPath: string, migrationId: string, sql: string) {
  const escapedMigrationId = migrationId.replaceAll("'", "''");
  run(
    "sqlite3",
    [dbPath],
    `BEGIN IMMEDIATE;
${sql}
INSERT INTO "${migrationHistoryTable}" ("migration_id") VALUES ('${escapedMigrationId}');
COMMIT;`,
  );
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
if (!existingMigrationDir) {
  throw new Error(`No committed migration found for ${name}`);
}
const migrationId = existingMigrationDir;
const migrationPath = path.join(migrationsRoot, migrationId, "migration.sql");
if (!existsSync(migrationPath)) {
  throw new Error(`Committed migration SQL is missing at ${migrationPath}`);
}

const existingDatabase = hasUserTable(dbPath);
ensureMigrationHistory(dbPath);

if (hasAppliedMigration(dbPath, migrationId)) {
  console.log(`SQLite migration already applied ${migrationId} at ${dbPath}`);
} else if (existingDatabase) {
  applyAndRecordMigration(dbPath, migrationId, readFileSync(migrationPath, "utf8"));
  console.log(`Applied committed migration ${migrationId} to ${dbPath}`);
} else {
  const bootstrapSql = withSqliteCompatibility(schemaDiff());
  if (!hasExecutableStatements(bootstrapSql)) {
    throw new Error("Current Prisma schema did not produce a SQLite bootstrap schema");
  }
  applyAndRecordMigration(dbPath, migrationId, bootstrapSql);
  console.log(`Initialized current SQLite schema at ${dbPath}`);
}
