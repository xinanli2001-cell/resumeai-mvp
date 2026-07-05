import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sqliteProvider = 'provider = "sqlite"';
const postgresProvider = 'provider = "postgresql"';

export function createPostgresSchema(source: string) {
  if (!source.includes(sqliteProvider)) {
    throw new Error("Expected sqlite datasource provider in prisma/schema.prisma");
  }
  return source.replace(sqliteProvider, postgresProvider);
}

export function writePostgresSchema({
  sourcePath = path.join("prisma", "schema.prisma"),
  outputPath = path.join("prisma", "generated", "schema.postgres.prisma"),
} = {}) {
  const source = readFileSync(sourcePath, "utf8");
  const generated = createPostgresSchema(source);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, generated);
  return outputPath;
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isMain) {
  const outputPath = writePostgresSchema();
  console.log(`Generated ${outputPath}`);
}
